import {
  db,
  storeDe,
  type AccesoBoveda,
  type Adjunto,
  type Conexion,
  type EjecucionDiagnostico,
  type HistorialEntrada,
  type TipoEntidadHistorial,
} from './db'
import { resumenConexion } from './conexiones'
import { supabase } from './supabase'
import { programarSync } from './sync'
import { type EntidadPorTabla, type TablaEditable } from './tablas'

// Punto unico de escritura de la app. Toda creacion, edicion o
// eliminacion pasa por aqui para que siempre ocurran las tres cosas:
// 1. Se guarda en la base local (la app nunca espera a la red).
// 2. Se registra el historial (quien, cuando, que cambio y motivo).
// 3. Se encola el cambio para subirlo al servidor al haber conexion.

type Guardable<T> = Omit<T, 'updatedAt' | 'updatedBy' | 'eliminadoEn'> & {
  eliminadoEn?: string | null
}

interface UsuarioActual {
  id: string | null
  nombre: string
}

export function nuevoId(): string {
  return crypto.randomUUID()
}

export async function guardarRegistro<T extends TablaEditable>(
  tabla: T,
  entidad: Guardable<EntidadPorTabla[T]>,
  motivo = '',
): Promise<void> {
  const usuario = await obtenerUsuarioActual()
  const ahora = new Date().toISOString()
  const store = storeDe(tabla)

  await db.transaction('rw', [db.table(tabla), db.historial, db.cambiosPendientes], async () => {
    const anterior = await store.get(entidad.id as string)
    const guardada = {
      ...entidad,
      eliminadoEn: entidad.eliminadoEn ?? null,
      updatedAt: ahora,
      updatedBy: usuario.id,
    } as EntidadPorTabla[T]

    const entradas = construirHistorial(tabla, anterior, guardada, usuario, ahora, motivo)
    // Guardar si la entidad realmente cambio, aunque el cambio no genere
    // historial (por ejemplo ubicacionId, que se registra a traves de su
    // copia legible `ubicacion`). Antes se usaba `entradas.length === 0`
    // como proxy de "sin cambios", pero eso saltaba el guardado cuando lo
    // unico que cambiaba era un campo suprimido del historial (el vinculo
    // de ubicacion durante la migracion N3, cuando el texto ya coincidia
    // con el nombre de la ubicacion).
    if (anterior && !huboCambios(anterior, guardada)) return

    await store.put(guardada)
    await db.historial.bulkAdd(entradas)
    await encolarCambioDeEntidad(tabla, guardada, ahora, anterior?.updatedAt ?? null)
    await encolarEntradasDeHistorial(entradas)
  })

  sincronizarPronto()
}

export async function eliminarRegistro(
  tabla: TablaEditable,
  id: string,
  motivo = '',
): Promise<void> {
  const usuario = await obtenerUsuarioActual()
  const ahora = new Date().toISOString()
  const store = storeDe(tabla)

  await db.transaction('rw', [db.table(tabla), db.historial, db.cambiosPendientes], async () => {
    const anterior = await store.get(id)
    if (!anterior || anterior.eliminadoEn) return

    const eliminada = { ...anterior, eliminadoEn: ahora, updatedAt: ahora, updatedBy: usuario.id }
    const entradas = entradasEliminacion(tabla, eliminada, usuario, ahora, motivo)

    await store.put(eliminada)
    await db.historial.bulkAdd(entradas)
    await encolarCambioDeEntidad(tabla, eliminada, ahora, anterior.updatedAt ?? null)
    await encolarEntradasDeHistorial(entradas)
  })

  sincronizarPronto()
}

// Nota manual de una intervencion sobre un dispositivo (ejemplo:
// "cambio de disco", "reinstalacion de Windows"), para lo que el
// historial automatico no captura porque no proviene de editar un
// campo de la ficha. Se mezcla en el mismo "Ver historial" del
// dispositivo (campo 'intervencion'). Devuelve el id de la entrada
// para que la interfaz pueda adjuntarle una foto opcional (tabla
// `adjuntos` con entidadTipo 'historial').
export async function registrarIntervencion(
  dispositivoId: string,
  descripcion: string,
  motivo = '',
): Promise<string> {
  const usuario = await obtenerUsuarioActual()
  const ahora = new Date().toISOString()
  const entrada = crearEntrada({ tipo: 'dispositivo', id: dispositivoId }, usuario, ahora, motivo, {
    campo: 'intervencion',
    valorAnterior: '',
    valorNuevo: descripcion,
  })

  await db.transaction('rw', [db.historial, db.cambiosPendientes], async () => {
    await db.historial.add(entrada)
    await encolarEntradasDeHistorial([entrada])
  })

  sincronizarPronto()
  return entrada.id
}

// Registro inmutable de un diagnostico terminado o abandonado (Modo
// Diagnostico Inteligente). Mismo patron que las entradas de
// historial: se agrega localmente y se encola para subir; nunca se
// edita. Es la base de las estadisticas futuras.
export async function registrarEjecucionDiagnostico(
  datos: Omit<EjecucionDiagnostico, 'id' | 'usuario' | 'usuarioNombre' | 'fechaHora'>,
): Promise<void> {
  const usuario = await obtenerUsuarioActual()
  const ejecucion: EjecucionDiagnostico = {
    ...datos,
    id: nuevoId(),
    usuario: usuario.id,
    usuarioNombre: usuario.nombre,
    fechaHora: new Date().toISOString(),
  }

  await db.transaction('rw', [db.ejecuciones_diagnostico, db.cambiosPendientes], async () => {
    await db.ejecuciones_diagnostico.add(ejecucion)
    await db.cambiosPendientes.add({
      id: nuevoId(),
      tabla: 'ejecuciones_diagnostico',
      entidadId: ejecucion.id,
      payload: ejecucion,
      creadoEn: ejecucion.fechaHora,
      error: null,
      intentos: 0,
    })
  })

  sincronizarPronto()
}

// Auditoria de la boveda (fase B3): registro inmutable de que hizo el
// tecnico con una credencial. Mismo patron que registrarEjecucionDiagnostico
// (se agrega localmente y se encola para subir; nunca se edita). Es
// trazabilidad de buena fe: se registra desde el cliente al momento
// de la accion, no impide nada por si sola.
export async function registrarAccesoBoveda(
  // `entidadTipo` es opcional y cae a 'credencial' (grupo P1): la
  // inmensa mayoria de las llamadas son sobre una credencial y no
  // tienen por que nombrarlo. Los campos protegidos lo pasan explicito.
  datos: Omit<AccesoBoveda, 'id' | 'usuario' | 'usuarioNombre' | 'fechaHora' | 'entidadTipo'> & {
    entidadTipo?: AccesoBoveda['entidadTipo']
  },
): Promise<void> {
  const usuario = await obtenerUsuarioActual()
  const acceso: AccesoBoveda = {
    ...datos,
    entidadTipo: datos.entidadTipo ?? 'credencial',
    id: nuevoId(),
    usuario: usuario.id,
    usuarioNombre: usuario.nombre,
    fechaHora: new Date().toISOString(),
  }

  await db.transaction('rw', [db.accesos_boveda, db.cambiosPendientes], async () => {
    await db.accesos_boveda.add(acceso)
    await db.cambiosPendientes.add({
      id: nuevoId(),
      tabla: 'accesos_boveda',
      entidadId: acceso.id,
      payload: acceso,
      creadoEn: acceso.fechaHora,
      error: null,
      intentos: 0,
    })
  })

  sincronizarPronto()
}

// ----------------------------------------------------------------
// Historial
// ----------------------------------------------------------------

// `ubicacionId` (grupo N3) y `responsableId` (hallazgo T1) no generan su
// propia entrada: su companero legible (`ubicacion`/`responsable`, la
// copia del nombre) ya registra el cambio de forma entendible, sin
// volcar un UUID en el historial. `reemplazaA` (hallazgo L3) tampoco: se
// fija una sola vez al crear el equipo (la propia "creacion" ya alcanza)
// y su trazabilidad real es la fila "Reemplaza a" de la ficha, no el
// historial.
const CAMPOS_SIN_HISTORIAL = new Set([
  'id',
  'updatedAt',
  'updatedBy',
  'eliminadoEn',
  'ubicacionId',
  'responsableId',
  'reemplazaA',
])

// Campos que el servidor reescribe en cada guardado: no cuentan como un
// cambio real de la ficha (a diferencia de un campo suprimido del
// historial como ubicacionId, que si es un cambio aunque no se registre).
const CAMPOS_META = new Set(['updatedAt', 'updatedBy'])

// Si la entidad cambio de verdad respecto a la anterior, ignorando solo
// los campos meta que siempre se reescriben. Decide si vale la pena
// guardar, con independencia de si el cambio genera historial.
function huboCambios(
  anterior: EntidadPorTabla[TablaEditable],
  nueva: EntidadPorTabla[TablaEditable],
): boolean {
  const a = anterior as unknown as Record<string, unknown>
  const b = nueva as unknown as Record<string, unknown>
  for (const campo of Object.keys(b)) {
    if (CAMPOS_META.has(campo)) continue
    if (valorComparable(a[campo]) !== valorComparable(b[campo])) return true
  }
  return false
}

function construirHistorial(
  tabla: TablaEditable,
  anterior: EntidadPorTabla[TablaEditable] | undefined,
  nueva: EntidadPorTabla[TablaEditable],
  usuario: UsuarioActual,
  ahora: string,
  motivo: string,
): HistorialEntrada[] {
  // Una conexion se registra en el historial de sus dos extremos: al
  // abrir la ficha de cualquiera de los dos dispositivos se ve el
  // cambio de cableado. Las conexiones solo se crean o se eliminan
  // (para corregir un puerto se quita y se vuelve a agregar).
  if (tabla === 'conexiones') {
    if (anterior) return []
    const conexion = nueva as unknown as Conexion
    const resumen = resumenConexion(conexion)
    return extremosDispositivo(conexion).map((dispositivoId) =>
      crearEntrada({ tipo: 'dispositivo', id: dispositivoId }, usuario, ahora, motivo, {
        campo: 'conexion',
        valorAnterior: '',
        valorNuevo: resumen,
      }),
    )
  }

  // Los adjuntos se registran sobre la ficha a la que pertenecen,
  // como una sola entrada (se agregan o se quitan, no se editan). Una
  // foto colgada de una intervencion manual (entidadTipo 'historial')
  // no genera su propia entrada: seria historial sobre el historial,
  // y la intervencion ya quedo registrada al crearla.
  if (tabla === 'adjuntos') {
    if (anterior) return []
    const adjunto = nueva as unknown as Adjunto
    if (adjunto.entidadTipo === 'historial') return []
    return [
      crearEntrada({ tipo: adjunto.entidadTipo, id: adjunto.entidadId }, usuario, ahora, motivo, {
        campo: 'adjunto',
        valorAnterior: '',
        valorNuevo: resumenDe(nueva),
      }),
    ]
  }

  const destino = destinoHistorial(tabla, nueva)

  if (!anterior) {
    return [
      crearEntrada(destino, usuario, ahora, motivo, {
        campo: 'creacion',
        valorAnterior: '',
        valorNuevo: resumenDe(nueva),
      }),
    ]
  }

  const entradas: HistorialEntrada[] = []
  const anteriorPlano = anterior as unknown as Record<string, unknown>
  const nuevaPlano = nueva as unknown as Record<string, unknown>
  for (const campo of Object.keys(nuevaPlano)) {
    if (CAMPOS_SIN_HISTORIAL.has(campo)) continue
    // La comparacion usa los valores reales; el enmascarado de las
    // credenciales se aplica solo al texto que queda en el historial.
    if (valorComparable(anteriorPlano[campo]) === valorComparable(nuevaPlano[campo])) continue
    entradas.push(
      crearEntrada(destino, usuario, ahora, motivo, {
        campo,
        valorAnterior: formatearValor(campo, anteriorPlano[campo]),
        valorNuevo: formatearValor(campo, nuevaPlano[campo]),
      }),
    )
  }
  return entradas
}

function crearEntrada(
  destino: { tipo: TipoEntidadHistorial; id: string },
  usuario: UsuarioActual,
  ahora: string,
  motivo: string,
  cambio: { campo: string; valorAnterior: string; valorNuevo: string },
): HistorialEntrada {
  return {
    id: nuevoId(),
    entidadTipo: destino.tipo,
    entidadId: destino.id,
    usuario: usuario.id,
    usuarioNombre: usuario.nombre,
    fechaHora: ahora,
    campo: cambio.campo,
    valorAnterior: cambio.valorAnterior,
    valorNuevo: cambio.valorNuevo,
    motivo,
  }
}

// El historial de un campo protegido cuelga del PROPIO campo
// ('campo_protegido' + su id), nunca del dispositivo. No es una
// preferencia: la RLS restringe la lectura de las entradas
// 'campo_protegido' a quien tiene permiso de boveda, mientras que las
// de 'dispositivo' las lee cualquier tecnico. Colgarlas del equipo
// filtraria el nombre del dato protegido y quien lo cambio en el "Ver
// historial" normal de la ficha, que es publico para el equipo.
const TIPO_POR_TABLA: Record<Exclude<TablaEditable, 'adjuntos' | 'conexiones'>, TipoEntidadHistorial> =
  {
    categorias: 'categoria',
    articulos: 'articulo',
    dispositivos: 'dispositivo',
    credenciales: 'credencial',
    diagnosticos: 'diagnostico',
    ubicaciones: 'ubicacion',
    campos_protegidos: 'campo_protegido',
    personas: 'persona',
  }

// No incluye 'adjuntos': el destino de un adjunto se resuelve aparte
// (ver ambas llamadas) porque puede apuntar a 'historial', que no es
// un TipoEntidadHistorial valido y ahi no genera entrada propia.
function destinoHistorial(
  tabla: Exclude<TablaEditable, 'conexiones' | 'adjuntos'>,
  entidad: EntidadPorTabla[TablaEditable],
): { tipo: TipoEntidadHistorial; id: string } {
  return { tipo: TIPO_POR_TABLA[tabla], id: entidad.id }
}

// Los dos dispositivos que toca una conexion (uno solo si por error
// apunta a si mismo). Cada uno recibe su entrada de historial.
function extremosDispositivo(conexion: Conexion): string[] {
  return conexion.origenId === conexion.destinoId
    ? [conexion.origenId]
    : [conexion.origenId, conexion.destinoId]
}

// Entradas de historial al eliminar: una por dispositivo en las
// conexiones (ambos extremos), una sola para el resto de tablas.
function entradasEliminacion(
  tabla: TablaEditable,
  eliminada: EntidadPorTabla[TablaEditable],
  usuario: UsuarioActual,
  ahora: string,
  motivo: string,
): HistorialEntrada[] {
  if (tabla === 'conexiones') {
    const conexion = eliminada as unknown as Conexion
    const resumen = resumenConexion(conexion)
    return extremosDispositivo(conexion).map((dispositivoId) =>
      crearEntrada({ tipo: 'dispositivo', id: dispositivoId }, usuario, ahora, motivo, {
        campo: 'conexion',
        valorAnterior: resumen,
        valorNuevo: '',
      }),
    )
  }
  // Mismo criterio que al crear: una foto colgada de una intervencion
  // (entidadTipo 'historial') no deja su propia entrada al borrarse.
  if (tabla === 'adjuntos') {
    const adjunto = eliminada as unknown as Adjunto
    if (adjunto.entidadTipo === 'historial') return []
    return [
      crearEntrada({ tipo: adjunto.entidadTipo, id: adjunto.entidadId }, usuario, ahora, motivo, {
        campo: 'adjunto',
        valorAnterior: resumenDe(eliminada),
        valorNuevo: '',
      }),
    ]
  }

  const destino = destinoHistorial(tabla, eliminada)
  return [
    crearEntrada(destino, usuario, ahora, motivo, {
      campo: 'eliminacion',
      valorAnterior: resumenDe(eliminada),
      valorNuevo: '',
    }),
  ]
}

function valorComparable(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  // Un array de objetos (por ejemplo dispositivosAfectados) no puede
  // unirse con join: todo objeto se vuelve el texto "[object Object]"
  // sin importar su contenido, así que dos listas distintas
  // parecerían iguales y el cambio no quedaría registrado.
  if (Array.isArray(valor)) {
    return valor.map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
  }
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

function formatearValor(campo: string, valor: unknown): string {
  // Las credenciales y los campos protegidos viajan y se guardan
  // cifrados; en el historial no tiene sentido mostrar el bloque
  // cifrado completo, y volcarlo ahi lo sacaria del unico lugar donde
  // el secreto esta protegido de verdad.
  if (campo === 'datosCifrados' || campo === 'valorCifrado') return valor ? '(cifrado)' : ''
  // Los nombres de los dispositivos afectados y de los equipos con
  // acceso a una credencial (grupo N3) son lo legible para un humano en
  // el historial, no el JSON con sus id.
  if (campo === 'dispositivosAfectados' || campo === 'dispositivos') {
    return nombresDispositivosAfectados(valor)
  }
  // Los nodos de un diagnostico son un arbol JSON: en el historial
  // basta un resumen del tamano, no el volcado completo.
  if (campo === 'nodos') {
    if (!Array.isArray(valor) || valor.length === 0) return ''
    return valor.length === 1 ? '1 pregunta' : `${valor.length} preguntas`
  }
  return valorComparable(valor)
}

function nombresDispositivosAfectados(valor: unknown): string {
  if (!Array.isArray(valor)) return ''
  return valor
    .map((v) => {
      const nombre = (v as { nombre?: unknown } | null)?.nombre
      return typeof nombre === 'string' ? nombre : ''
    })
    .filter(Boolean)
    .join(', ')
}

function resumenDe(entidad: unknown): string {
  const datos = entidad as { titulo?: string; nombre?: string }
  return datos.titulo ?? datos.nombre ?? ''
}

// ----------------------------------------------------------------
// Cola de cambios pendientes
// ----------------------------------------------------------------

// Si la misma ficha se edita varias veces sin internet, se conserva
// un solo cambio pendiente con la version mas reciente.
async function encolarCambioDeEntidad(
  tabla: TablaEditable,
  entidad: EntidadPorTabla[TablaEditable],
  ahora: string,
  baseActualizadoEn: string | null,
): Promise<void> {
  const existente = await db.cambiosPendientes
    .where('[tabla+entidadId]')
    .equals([tabla, entidad.id])
    .first()

  if (existente) {
    // Se conserva el baseActualizadoEn original: sigue siendo la
    // version del servidor de la que partio esta edicion, aunque la
    // ficha se haya vuelto a tocar sin conexion antes de subirse.
    await db.cambiosPendientes.update(existente.id, { payload: entidad, error: null, intentos: 0 })
  } else {
    await db.cambiosPendientes.add({
      id: nuevoId(),
      tabla,
      entidadId: entidad.id,
      payload: entidad,
      creadoEn: ahora,
      error: null,
      intentos: 0,
      baseActualizadoEn,
    })
  }
}

async function encolarEntradasDeHistorial(entradas: HistorialEntrada[]): Promise<void> {
  await db.cambiosPendientes.bulkAdd(
    entradas.map((entrada) => ({
      id: nuevoId(),
      tabla: 'historial',
      entidadId: entrada.id,
      payload: entrada,
      creadoEn: entrada.fechaHora,
      error: null,
      intentos: 0,
    })),
  )
}

// ----------------------------------------------------------------
// Usuario actual
// ----------------------------------------------------------------

async function obtenerUsuarioActual(): Promise<UsuarioActual> {
  if (!supabase) return { id: null, nombre: '' }
  const { data } = await supabase.auth.getSession()
  const usuario = data.session?.user
  if (!usuario) return { id: null, nombre: '' }
  const perfil = await db.perfiles.get(usuario.id)
  const nombre = perfil?.nombre || usuario.email?.split('@')[0] || ''
  return { id: usuario.id, nombre }
}

function sincronizarPronto(): void {
  // Solo en el navegador: en las pruebas no hay que programar nada.
  if (typeof window !== 'undefined') programarSync()
}
