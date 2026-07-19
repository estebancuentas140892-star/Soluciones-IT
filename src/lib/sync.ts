import type { RealtimeChannel } from '@supabase/supabase-js'
import { db, type CambioPendiente, type Perfil } from './db'
import { supabase } from './supabase'
import { contarArchivosPendientes, esErrorDeRed, procesarArchivosPendientes } from './archivosPendientes'
import {
  aEntidadLocal,
  aFilaRemota,
  configTablas,
  storeDe,
  TABLAS_SINCRONIZADAS,
  type TablaSincronizada,
} from './tablas'

// Sincronizacion bidireccional con Supabase:
// 1. Sube la cola de cambios pendientes en orden de creacion.
// 2. Descarga las novedades de cada tabla usando un cursor sobre la
//    columna de tiempo que pone el servidor (updated_at/recibido_en).
// El cursor se retrasa unos minutos en cada consulta para no perder
// filas que se confirmaron fuera de orden; volver a recibir una fila
// ya aplicada es inofensivo porque la escritura local es idempotente.

const MARGEN_CURSOR_MS = 5 * 60 * 1000
const TAMANO_PAGINA = 1000

// ----------------------------------------------------------------
// Estado observable (para mostrar en la interfaz)
// ----------------------------------------------------------------

export interface EstadoSync {
  enCurso: boolean
  ultimaSync: string | null
  cambiosPendientes: number
  cambiosConError: number
  ultimoError: string | null
  // El canal de tiempo real esta conectado: los cambios del resto del
  // equipo llegan en el momento, no solo por el sondeo cada 2 minutos.
  tiempoReal: boolean
  // No hay sesion iniciada en el momento de sincronizar: antes
  // ejecutarSync retornaba en silencio y no habia forma de saberlo
  // desde la interfaz sin abrir la consola del navegador.
  sinSesion: boolean
  // Mensajes de la ultima pasada de subida donde un companiero edito
  // la misma ficha mientras el cambio local esperaba para subirse. Se
  // sube igual (gana la ultima escritura, ver ARQUITECTURA.md), pero
  // se avisa aqui en vez de pisarlo en silencio. Se reemplaza entero en
  // cada pasada, igual que ultimoError.
  conflictosRecientes: string[]
}

let estado: EstadoSync = {
  enCurso: false,
  ultimaSync: null,
  cambiosPendientes: 0,
  cambiosConError: 0,
  ultimoError: null,
  tiempoReal: false,
  sinSesion: false,
  conflictosRecientes: [],
}

const suscriptores = new Set<() => void>()

export function obtenerEstadoSync(): EstadoSync {
  return estado
}

export function suscribirSync(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

function actualizarEstado(cambios: Partial<EstadoSync>): void {
  estado = { ...estado, ...cambios }
  for (const escucha of suscriptores) escucha()
}

async function actualizarContadores(): Promise<void> {
  const pendientes = await db.cambiosPendientes.toArray()
  // Los archivos en cola tambien son "cambios por subir" a los ojos
  // del tecnico: entran al mismo contador del indicador.
  const archivos = await contarArchivosPendientes()
  actualizarEstado({
    cambiosPendientes: pendientes.length + archivos.total,
    cambiosConError: pendientes.filter((c) => c.error !== null).length + archivos.conError,
  })
}

// ----------------------------------------------------------------
// Orquestacion
// ----------------------------------------------------------------

let syncActual: Promise<void> | null = null
let repetirAlTerminar = false
let temporizador: ReturnType<typeof setTimeout> | null = null

export function sincronizar(): Promise<void> {
  if (syncActual) {
    // Llego un cambio mientras habia una sincronizacion en curso:
    // al terminar se ejecuta otra pasada para no dejarlo atras.
    repetirAlTerminar = true
    return syncActual
  }
  syncActual = ejecutarSync().finally(() => {
    syncActual = null
    if (repetirAlTerminar) {
      repetirAlTerminar = false
      void sincronizar()
    }
  })
  return syncActual
}

// Agrupa varios cambios seguidos en una sola sincronizacion.
export function programarSync(retrasoMs = 800): void {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    temporizador = null
    void sincronizar()
  }, retrasoMs)
}

// ----------------------------------------------------------------
// Tiempo real (Supabase Realtime)
// ----------------------------------------------------------------
//
// El canal de Realtime se usa solo como SEÑAL: cuando un compañero
// cambia algo, se dispara una descarga (programarSync, agrupada) en
// vez de aplicar el payload del evento. Asi la descarga sigue el mismo
// camino de siempre, que respeta RLS por consulta: nunca llega a este
// dispositivo un dato que no deberia ver (por ejemplo una credencial
// sin permiso de boveda), aunque el evento de Realtime lo mencione.
// Reduce el retraso entre dispositivos de hasta 2 minutos (el sondeo)
// a uno o dos segundos, y el sondeo queda como red de seguridad por si
// el canal se cae.

let canalRealtime: RealtimeChannel | null = null

function suscribirRealtime(): void {
  if (!supabase || canalRealtime) return
  canalRealtime = supabase
    .channel('cambios-equipo')
    // Sin `table`: se escuchan todos los cambios del esquema public que
    // esten en la publicacion supabase_realtime (ver schema.sql). Un
    // solo canal para todas las tablas mantiene bajo el numero de
    // conexiones (relevante en el plan gratuito).
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      // Alguien del equipo cambio algo: se descarga en la proxima
      // pasada. programarSync agrupa una rafaga de eventos (guardar un
      // articulo escribe el articulo y su historial) en una sola sync.
      programarSync()
    })
    .subscribe((estadoCanal) => {
      const conectado = estadoCanal === 'SUBSCRIBED'
      actualizarEstado({ tiempoReal: conectado })
      // Al (re)conectar, una sincronizacion para recuperar lo que haya
      // cambiado mientras el canal estuvo caido (una desconexion breve
      // no debe dejar datos viejos hasta el proximo sondeo).
      if (conectado) void sincronizar()
    })
}

function desuscribirRealtime(): void {
  if (!canalRealtime) return
  void supabase?.removeChannel(canalRealtime)
  canalRealtime = null
  actualizarEstado({ tiempoReal: false })
}

// Se llama una vez al arrancar la app.
export function iniciarSync(): void {
  window.addEventListener('online', () => void sincronizar())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizar()
  })
  setInterval(() => {
    if (navigator.onLine) void sincronizar()
  }, 2 * 60 * 1000)

  // El canal de tiempo real vive atado a la sesion: se suscribe cuando
  // hay usuario y se corta al cerrar sesion. onAuthStateChange emite un
  // evento inicial con la sesion existente al arrancar, asi que cubre
  // tambien el caso de abrir la app ya autenticado. supabase-js renueva
  // solo el token del canal al refrescar la sesion.
  if (supabase) {
    supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (sesion) suscribirRealtime()
      else desuscribirRealtime()
    })
  }

  void sincronizar()
}

async function ejecutarSync(): Promise<void> {
  if (!supabase) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await actualizarContadores()
    return
  }

  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    actualizarEstado({ sinSesion: true })
    await actualizarContadores()
    return
  }

  actualizarEstado({ enCurso: true, ultimoError: null, sinSesion: false })
  try {
    // Los archivos van antes que las filas: asi un adjunto creado sin
    // conexion ya existe en Storage cuando su fila llega al servidor
    // y el resto del equipo puede verlo de inmediato.
    await procesarArchivosPendientes()
    await subirCambiosPendientes()
    const erroresDeTabla = await descargarTodasLasTablas()
    actualizarEstado({
      ultimaSync: new Date().toISOString(),
      ultimoError: erroresDeTabla.length > 0 ? resumenErroresDeTabla(erroresDeTabla) : null,
    })
  } catch (err) {
    actualizarEstado({ ultimoError: err instanceof Error ? err.message : String(err) })
  } finally {
    actualizarEstado({ enCurso: false })
    await actualizarContadores()
  }
}

// Descarga los perfiles y cada tabla de TABLAS_SINCRONIZADAS por
// separado: si una falla (esquema sin aplicar, columna faltante, RLS),
// no debe impedir que el resto del equipo reciba las demas (antes, la
// primera tabla que fallaba abortaba todo el lote). Solo un error de
// RED aborta el lote completo: reintentar de inmediato tabla por tabla
// seria inutil, va a fallar igual hasta que vuelva la señal. Devuelve
// los mensajes de las tablas que fallaron por otro motivo, para
// mostrarlos en el panel de sincronizacion.
async function descargarTodasLasTablas(): Promise<string[]> {
  const errores: string[] = []
  await intentarDescarga('perfiles', descargarPerfiles, errores)
  // El verificador de la boveda va ANTES del resto de tablas: es
  // best effort (nunca lanza) y no debe quedarse sin descargar porque
  // una tabla nueva (al final de la lista) falle por esquema sin
  // aplicar.
  await descargarBovedaMeta()
  for (const tabla of TABLAS_SINCRONIZADAS) {
    await intentarDescarga(tabla, () => descargarTabla(tabla), errores)
  }
  return errores
}

// La clasificacion de red se hace sobre el mensaje CRUDO del error, sin
// el nombre de la tabla ya antepuesto: "conexiones" contiene la
// subcadena "conexi" que esErrorDeRed tambien busca (para "sin
// conexión"), asi que anteponerlo ANTES de clasificar clasificaba mal
// esa tabla en particular como error de red (encontrado verificando en
// navegador contra el proyecto real de Supabase).
export async function intentarDescarga(
  etiqueta: string,
  tarea: () => Promise<void>,
  errores: string[],
): Promise<void> {
  try {
    await tarea()
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    if (esErrorDeRed(mensaje)) throw err
    errores.push(`${etiqueta}: ${mensaje}`)
  }
}

function resumenErroresDeTabla(errores: string[]): string {
  return errores.length === 1
    ? errores[0]
    : `${errores.length} tablas no se pudieron descargar: ${errores.join(' | ')}`
}

// ----------------------------------------------------------------
// Subida (push)
// ----------------------------------------------------------------

async function subirCambiosPendientes(): Promise<void> {
  if (!supabase) return
  const pendientes = await db.cambiosPendientes.orderBy('creadoEn').toArray()
  const conflictos: string[] = []

  for (const cambio of pendientes) {
    const tabla = cambio.tabla as TablaSincronizada
    const config = configTablas[tabla]
    const fila = aFilaRemota(tabla, cambio.payload)

    if (!config.soloInsercion && cambio.baseActualizadoEn) {
      const mensaje = await mensajeSiHayConflicto(tabla, cambio)
      if (mensaje) conflictos.push(mensaje)
    }

    const { error } = config.soloInsercion
      ? await supabase.from(tabla).insert(fila)
      : await supabase.from(tabla).upsert(fila)

    if (!error || esDuplicado(error.code)) {
      await db.cambiosPendientes.delete(cambio.id)
    } else if (esErrorDeRed(error.message)) {
      // Se corto la conexion: los cambios quedan en cola y se
      // reintentan en la siguiente sincronizacion.
      throw new Error('Sin conexión con el servidor')
    } else {
      // El servidor rechazo este cambio (por ejemplo, por permisos).
      // Se anota el error, se conserva el cambio y se sigue con el resto.
      await registrarErrorDeCambio(cambio, error.message)
    }
  }

  actualizarEstado({ conflictosRecientes: conflictos })
}

// Compara la version actual del servidor contra la version sobre la
// que partio este cambio (capturada al encolarlo, ver
// encolarCambioDeEntidad en repositorio.ts). Si el servidor ya tiene
// algo mas nuevo, un companiero edito la misma ficha mientras este
// cambio esperaba para subirse. No cambia la resolucion (gana la
// ultima escritura de todas formas, ver ARQUITECTURA.md seccion 7):
// solo evita que pase en silencio. Si la comprobacion misma falla (sin
// conexion, tabla sin esquema aplicado), se sube igual sin avisar:
// mejor eso que bloquear una subida por un chequeo que no es
// indispensable.
async function mensajeSiHayConflicto(
  tabla: TablaSincronizada,
  cambio: CambioPendiente,
): Promise<string | null> {
  if (!supabase || !cambio.baseActualizadoEn) return null
  try {
    const { data } = await supabase
      .from(tabla)
      .select('updated_at')
      .eq('id', cambio.entidadId)
      .maybeSingle()
    const actualizadoEnRemoto = typeof data?.updated_at === 'string' ? data.updated_at : null
    if (!esConflicto(cambio.baseActualizadoEn, actualizadoEnRemoto)) return null
    return `Se sobrescribió una edición más reciente de un compañero en "${tituloDeCambio(cambio)}" (${tabla}).`
  } catch {
    return null
  }
}

// Pura (sin red) para poder probarla sola: dos marcas de tiempo ISO
// que vienen de la misma columna de Postgres (updated_at) se pueden
// comparar como texto, igual que ya hace el cursor de descarga.
export function esConflicto(baseActualizadoEn: string, actualizadoEnRemoto: string | null): boolean {
  return actualizadoEnRemoto !== null && actualizadoEnRemoto > baseActualizadoEn
}

function tituloDeCambio(cambio: CambioPendiente): string {
  const payload = cambio.payload as { titulo?: unknown; nombre?: unknown } | null
  const titulo = typeof payload?.titulo === 'string' ? payload.titulo : undefined
  const nombre = typeof payload?.nombre === 'string' ? payload.nombre : undefined
  return titulo || nombre || cambio.entidadId
}

// Una entrada de historial que ya se habia subido (pero no se alcanzo
// a quitar de la cola) provoca un error de clave duplicada: es senal
// de exito, no de fallo.
function esDuplicado(codigo: string | undefined): boolean {
  return codigo === '23505'
}

async function registrarErrorDeCambio(cambio: CambioPendiente, mensaje: string): Promise<void> {
  await db.cambiosPendientes.update(cambio.id, { error: mensaje, intentos: cambio.intentos + 1 })
}

// Descarta un cambio atascado de la cola (panel de sincronizacion,
// tarea 68). Es la salida de emergencia cuando el servidor rechaza un
// cambio de forma permanente: sin esto, la ficha queda para siempre
// con el punto rojo y ademas deja de recibir las novedades del equipo
// (la regla anti pisado de aplicarFilasRemotas la salta mientras tenga
// un cambio pendiente). Tras quitarlo de la cola se intenta, con la
// mejor voluntad, restaurar la version del servidor de esa ficha para
// que este dispositivo no siga mostrando el cambio descartado; sin
// conexion se queda la version local hasta la proxima sincronizacion.
export async function descartarCambioPendiente(id: string): Promise<void> {
  const cambio = await db.cambiosPendientes.get(id)
  if (!cambio) return
  await db.cambiosPendientes.delete(id)

  try {
    const tabla = cambio.tabla as TablaSincronizada
    if (supabase && configTablas[tabla] && !configTablas[tabla].soloInsercion) {
      const { data, error } = await supabase.from(tabla).select('*').eq('id', cambio.entidadId)
      if (!error && data) {
        if (data.length > 0) {
          await aplicarFilasRemotas(tabla, data as Record<string, unknown>[])
        } else {
          // La fila nunca llego al servidor (era una creacion que
          // fallo): se retira tambien la copia local para que ambos
          // lados queden iguales.
          await db.table(tabla).delete(cambio.entidadId)
        }
      }
    }
  } catch {
    // Sin conexion o sin servidor: el descarte de la cola ya vale por
    // si mismo; la ficha convergera en la proxima sincronizacion en la
    // que otro companiero la toque.
  }

  await actualizarContadores()
}

// ----------------------------------------------------------------
// Descarga (pull)
// ----------------------------------------------------------------

async function descargarTabla(tabla: TablaSincronizada): Promise<void> {
  if (!supabase) return
  const config = configTablas[tabla]
  const claveCursor = `cursor_${tabla}`
  const cursor = (await db.syncMeta.get(claveCursor))?.valor ?? null
  const desde = cursor ? new Date(Date.parse(cursor) - MARGEN_CURSOR_MS).toISOString() : null

  let offset = 0
  let mayorRecibido = cursor

  for (;;) {
    let consulta = supabase
      .from(tabla)
      .select('*')
      .order(config.columnaCursor, { ascending: true })
      .range(offset, offset + TAMANO_PAGINA - 1)
    if (desde) consulta = consulta.gte(config.columnaCursor, desde)

    const { data, error } = await consulta
    if (error) throw new Error(error.message)

    const filas = (data ?? []) as Record<string, unknown>[]
    if (filas.length > 0) {
      await aplicarFilasRemotas(tabla, filas)
      const ultimo = filas[filas.length - 1][config.columnaCursor]
      if (typeof ultimo === 'string' && (!mayorRecibido || ultimo > mayorRecibido)) {
        mayorRecibido = ultimo
      }
    }
    if (filas.length < TAMANO_PAGINA) break
    offset += TAMANO_PAGINA
  }

  if (mayorRecibido && mayorRecibido !== cursor) {
    await db.syncMeta.put({ clave: claveCursor, valor: mayorRecibido })
  }
}

// Aplica filas recibidas del servidor a la base local. Si una ficha
// tiene un cambio local pendiente de subir, se conserva la version
// local: se subira en la siguiente pasada y despues convergeran.
export async function aplicarFilasRemotas(
  tabla: TablaSincronizada,
  filas: Record<string, unknown>[],
): Promise<void> {
  const store = storeDe(tabla)
  const soloInsercion = configTablas[tabla].soloInsercion

  await db.transaction('rw', [db.table(tabla), db.cambiosPendientes], async () => {
    for (const fila of filas) {
      const entidad = aEntidadLocal(tabla, fila)
      if (!soloInsercion) {
        const pendientes = await db.cambiosPendientes
          .where('[tabla+entidadId]')
          .equals([tabla, entidad.id])
          .count()
        if (pendientes > 0) continue
      }
      await store.put(entidad)
    }
  })
}

// Copia local del verificador de la contrasena maestra. Se descarga
// para TODOS los tecnicos autenticados (desde el 2026-07-17 la RLS de
// boveda_meta permite leerlo sin permiso de boveda, porque tambien
// autoriza las eliminaciones sensibles). Best effort a proposito: la
// tabla puede no existir todavia en el servidor o la RLS vieja puede
// devolver vacio (esquema sin aplicar); nada de eso debe frenar la
// sincronizacion. Nunca se borra la copia local: el verificador solo
// se reemplaza por lo que diga el servidor.
async function descargarBovedaMeta(): Promise<void> {
  if (!supabase) return
  try {
    const { data, error } = await supabase.from('boveda_meta').select('*')
    if (error || !data) return
    for (const fila of data) {
      const verificador = typeof fila.verificador === 'string' ? fila.verificador : ''
      if (!verificador) continue
      await db.bovedaMeta.put({
        id: String(fila.id),
        verificador,
        updatedAt: String(fila.updated_at ?? new Date().toISOString()),
      })
    }
  } catch {
    // Sin conexion o esquema sin aplicar: se reintenta en la proxima.
  }
}

async function descargarPerfiles(): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.from('perfiles').select('*')
  if (error) throw new Error(error.message)

  const perfiles: Perfil[] = (data ?? []).map((fila) => ({
    id: String(fila.id),
    nombre: String(fila.nombre ?? ''),
    correo: String(fila.correo ?? ''),
    puedeVerBoveda: Boolean(fila.puede_ver_boveda),
  }))

  await db.transaction('rw', db.perfiles, async () => {
    await db.perfiles.clear()
    await db.perfiles.bulkPut(perfiles)
  })
}
