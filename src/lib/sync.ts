import { db, type CambioPendiente, type Perfil } from './db'
import { supabase } from './supabase'
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
}

let estado: EstadoSync = {
  enCurso: false,
  ultimaSync: null,
  cambiosPendientes: 0,
  cambiosConError: 0,
  ultimoError: null,
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
  actualizarEstado({
    cambiosPendientes: pendientes.length,
    cambiosConError: pendientes.filter((c) => c.error !== null).length,
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

// Se llama una vez al arrancar la app.
export function iniciarSync(): void {
  window.addEventListener('online', () => void sincronizar())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizar()
  })
  setInterval(() => {
    if (navigator.onLine) void sincronizar()
  }, 2 * 60 * 1000)
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
    await actualizarContadores()
    return
  }

  actualizarEstado({ enCurso: true, ultimoError: null })
  try {
    await subirCambiosPendientes()
    await descargarPerfiles()
    for (const tabla of TABLAS_SINCRONIZADAS) {
      await descargarTabla(tabla)
    }
    actualizarEstado({ ultimaSync: new Date().toISOString() })
  } catch (err) {
    actualizarEstado({ ultimoError: err instanceof Error ? err.message : String(err) })
  } finally {
    actualizarEstado({ enCurso: false })
    await actualizarContadores()
  }
}

// ----------------------------------------------------------------
// Subida (push)
// ----------------------------------------------------------------

async function subirCambiosPendientes(): Promise<void> {
  if (!supabase) return
  const pendientes = await db.cambiosPendientes.orderBy('creadoEn').toArray()

  for (const cambio of pendientes) {
    const tabla = cambio.tabla as TablaSincronizada
    const config = configTablas[tabla]
    const fila = aFilaRemota(tabla, cambio.payload)

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
}

// Una entrada de historial que ya se habia subido (pero no se alcanzo
// a quitar de la cola) provoca un error de clave duplicada: es senal
// de exito, no de fallo.
function esDuplicado(codigo: string | undefined): boolean {
  return codigo === '23505'
}

function esErrorDeRed(mensaje: string): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return /fetch|network|conexi/i.test(mensaje)
}

async function registrarErrorDeCambio(cambio: CambioPendiente, mensaje: string): Promise<void> {
  await db.cambiosPendientes.update(cambio.id, { error: mensaje, intentos: cambio.intentos + 1 })
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
    if (error) throw new Error(`Error al descargar ${tabla}: ${error.message}`)

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

async function descargarPerfiles(): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.from('perfiles').select('*')
  if (error) throw new Error(`Error al descargar perfiles: ${error.message}`)

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
