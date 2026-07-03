import { db } from './db'
import { normalizarProcedimiento } from './procedimiento'
import { supabase } from './supabase'

// Contenido real de los adjuntos (fotos, manuales) guardado en Cache
// Storage, aparte del precache de vite-plugin-pwa (que solo cubre
// los archivos propios de la app). La clave es sintetica y estable,
// basada en la referencia de Storage: nunca se usa la URL firmada
// como clave porque cambia cada vez que se pide una nueva y expira a
// la hora (ver AdjuntoItem en src/components/Adjuntos.tsx).
const NOMBRE_CACHE = 'adjuntos-offline-v1'
const UNA_HORA = 60 * 60

// Separada del resto para poder probarla sin depender de APIs del
// navegador (Cache Storage no existe en las pruebas con Vitest).
export function claveDe(referencia: string): string {
  return `https://adjuntos-offline.local/${encodeURIComponent(referencia)}`
}

export async function estaDisponibleOffline(referencia: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  const cache = await caches.open(NOMBRE_CACHE)
  return (await cache.match(claveDe(referencia))) !== undefined
}

// Devuelve una URL local (blob:) para mostrar un adjunto ya
// descargado, o null si todavia no esta disponible offline. Quien la
// use debe liberarla con URL.revokeObjectURL al dejar de mostrarla.
export async function obtenerUrlOffline(referencia: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null
  const cache = await caches.open(NOMBRE_CACHE)
  const respuesta = await cache.match(claveDe(referencia))
  if (!respuesta) return null
  return URL.createObjectURL(await respuesta.blob())
}

async function fetchYGuardar(referencia: string, urlFirmada: string): Promise<void> {
  const respuesta = await fetch(urlFirmada)
  if (!respuesta.ok) throw new Error('No se pudo descargar el adjunto.')
  const cache = await caches.open(NOMBRE_CACHE)
  await cache.put(claveDe(referencia), respuesta)
}

// Deja disponible offline un archivo que ya esta en el telefono (por
// ejemplo, una foto adjuntada sin conexion que espera en la cola de
// subida): asi la ficha lo muestra al instante sin tocar la red.
export async function guardarEnCacheOffline(referencia: string, contenido: Blob): Promise<void> {
  if (typeof caches === 'undefined') return
  const cache = await caches.open(NOMBRE_CACHE)
  await cache.put(claveDe(referencia), new Response(contenido, { headers: { 'Content-Type': contenido.type || 'application/octet-stream' } }))
}

// Al eliminar un adjunto se libera tambien su copia offline.
export async function eliminarDeCacheOffline(referencia: string): Promise<void> {
  if (typeof caches === 'undefined') return
  const cache = await caches.open(NOMBRE_CACHE)
  await cache.delete(claveDe(referencia))
}

// Guarda un adjunto en el cache durable la primera vez que se ve, sin
// bloquear la vista previa (que ya se muestra con la URL firmada).
// Si ya estaba descargado o algo falla, no hace nada: se reintenta
// la proxima vez que se vea o con "Descargar todo para offline".
export async function cachearSiHaceFalta(referencia: string, urlFirmada: string): Promise<void> {
  if (typeof caches === 'undefined') return
  if (await estaDisponibleOffline(referencia)) return
  try {
    await fetchYGuardar(referencia, urlFirmada)
  } catch {
    // Sin conexion o error de red: no es grave.
  }
}

async function descargarUno(referencia: string): Promise<void> {
  if (!supabase) throw new Error('La aplicación aún no está conectada al servidor.')
  const { data, error } = await supabase.storage.from('adjuntos').createSignedUrl(referencia, UNA_HORA)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo obtener el enlace del adjunto.')
  await fetchYGuardar(referencia, data.signedUrl)
}

// Todo lo que debe quedar disponible sin conexion: los adjuntos de
// las fichas y las capturas de los pasos de los procedimientos (que
// no son filas de adjuntos: viven como referencia dentro del paso).
async function referenciasParaOffline(): Promise<string[]> {
  const referencias = new Set<string>()

  const adjuntos = await db.adjuntos.filter((a) => !a.eliminadoEn).toArray()
  for (const adjunto of adjuntos) referencias.add(adjunto.referencia)

  const articulos = await db.articulos.filter((a) => !a.eliminadoEn).toArray()
  for (const articulo of articulos) {
    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    if (!procedimiento) continue
    for (const paso of procedimiento.pasos) {
      if (paso.imagen) referencias.add(paso.imagen)
    }
  }

  return [...referencias]
}

// ----------------------------------------------------------------
// Progreso observable (para el boton en la interfaz)
// ----------------------------------------------------------------

export interface ProgresoDescarga {
  enCurso: boolean
  total: number
  completados: number
  fallidos: number
  ultimaDescarga: string | null
}

let progreso: ProgresoDescarga = {
  enCurso: false,
  total: 0,
  completados: 0,
  fallidos: 0,
  ultimaDescarga: null,
}

const suscriptores = new Set<() => void>()

export function obtenerProgresoDescarga(): ProgresoDescarga {
  return progreso
}

export function suscribirProgresoDescarga(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => suscriptores.delete(escucha)
}

function actualizarProgreso(cambios: Partial<ProgresoDescarga>): void {
  progreso = { ...progreso, ...cambios }
  for (const escucha of suscriptores) escucha()
}

// Descarga todos los adjuntos que aun no esten disponibles offline.
// Sigue adelante si alguno falla (por ejemplo, por señal intermitente)
// para no dejar sin descargar el resto.
export async function descargarTodoOffline(): Promise<void> {
  if (progreso.enCurso) return

  const referencias = await referenciasParaOffline()
  const pendientes: string[] = []
  for (const referencia of referencias) {
    if (!(await estaDisponibleOffline(referencia))) pendientes.push(referencia)
  }

  if (pendientes.length === 0) {
    actualizarProgreso({ total: 0, completados: 0, fallidos: 0, ultimaDescarga: new Date().toISOString() })
    return
  }

  actualizarProgreso({ enCurso: true, total: pendientes.length, completados: 0, fallidos: 0 })

  let completados = 0
  let fallidos = 0
  for (const referencia of pendientes) {
    try {
      await descargarUno(referencia)
      completados += 1
    } catch {
      fallidos += 1
    }
    actualizarProgreso({ completados, fallidos })
  }

  actualizarProgreso({ enCurso: false, ultimaDescarga: new Date().toISOString() })
}
