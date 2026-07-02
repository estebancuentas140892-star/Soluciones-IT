import { db, type HistorialEntrada, type TipoEntidadHistorial } from './db'
import { supabase } from './supabase'
import { programarSync } from './sync'
import { storeDe, type EntidadPorTabla, type TablaEditable } from './tablas'

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
    if (anterior && entradas.length === 0) return

    await store.put(guardada)
    await db.historial.bulkAdd(entradas)
    await encolarCambioDeEntidad(tabla, guardada, ahora)
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
    const destino = destinoHistorial(tabla, eliminada)
    const entrada = crearEntrada(destino, usuario, ahora, motivo, {
      campo: tabla === 'adjuntos' ? 'adjunto' : 'eliminacion',
      valorAnterior: resumenDe(eliminada),
      valorNuevo: '',
    })

    await store.put(eliminada)
    await db.historial.add(entrada)
    await encolarCambioDeEntidad(tabla, eliminada, ahora)
    await encolarEntradasDeHistorial([entrada])
  })

  sincronizarPronto()
}

// ----------------------------------------------------------------
// Historial
// ----------------------------------------------------------------

const CAMPOS_SIN_HISTORIAL = new Set(['id', 'updatedAt', 'updatedBy', 'eliminadoEn'])

function construirHistorial(
  tabla: TablaEditable,
  anterior: EntidadPorTabla[TablaEditable] | undefined,
  nueva: EntidadPorTabla[TablaEditable],
  usuario: UsuarioActual,
  ahora: string,
  motivo: string,
): HistorialEntrada[] {
  const destino = destinoHistorial(tabla, nueva)

  // Los adjuntos se registran sobre la ficha a la que pertenecen,
  // como una sola entrada (se agregan o se quitan, no se editan).
  if (tabla === 'adjuntos') {
    if (anterior) return []
    return [
      crearEntrada(destino, usuario, ahora, motivo, {
        campo: 'adjunto',
        valorAnterior: '',
        valorNuevo: resumenDe(nueva),
      }),
    ]
  }

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

const TIPO_POR_TABLA: Record<Exclude<TablaEditable, 'adjuntos'>, TipoEntidadHistorial> = {
  categorias: 'categoria',
  articulos: 'articulo',
  dispositivos: 'dispositivo',
  credenciales: 'credencial',
}

function destinoHistorial(
  tabla: TablaEditable,
  entidad: EntidadPorTabla[TablaEditable],
): { tipo: TipoEntidadHistorial; id: string } {
  if (tabla === 'adjuntos') {
    const adjunto = entidad as EntidadPorTabla['adjuntos']
    return { tipo: adjunto.entidadTipo, id: adjunto.entidadId }
  }
  return { tipo: TIPO_POR_TABLA[tabla], id: entidad.id }
}

function valorComparable(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (Array.isArray(valor)) return valor.join(', ')
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

function formatearValor(campo: string, valor: unknown): string {
  // Las credenciales viajan y se guardan cifradas; en el historial
  // no tiene sentido mostrar el bloque cifrado completo.
  if (campo === 'datosCifrados') return valor ? '(cifrado)' : ''
  return valorComparable(valor)
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
): Promise<void> {
  const existente = await db.cambiosPendientes
    .where('[tabla+entidadId]')
    .equals([tabla, entidad.id])
    .first()

  if (existente) {
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
