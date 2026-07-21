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

// Devuelve el Blob crudo ya cacheado, o null si todavia no esta
// disponible offline. Separada de obtenerUrlOffline (que la envuelve
// con URL.createObjectURL) porque el archivo seguro (fase P5) necesita
// los bytes crudos para descifrarlos, no una URL.
export async function obtenerBlobOffline(referencia: string): Promise<Blob | null> {
  if (typeof caches === 'undefined') return null
  const cache = await caches.open(NOMBRE_CACHE)
  const respuesta = await cache.match(claveDe(referencia))
  return respuesta ? await respuesta.blob() : null
}

// Devuelve una URL local (blob:) para mostrar un adjunto ya
// descargado, o null si todavia no esta disponible offline. Quien la
// use debe liberarla con URL.revokeObjectURL al dejar de mostrarla.
export async function obtenerUrlOffline(referencia: string): Promise<string | null> {
  const blob = await obtenerBlobOffline(referencia)
  return blob ? URL.createObjectURL(blob) : null
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

// Sirve un archivo para verlo/descargarlo ya mismo (fase P5, "Archivo
// seguro"): cache offline primero (sin tocar la red); si no esta,
// pide una URL firmada del BUCKET dado (a diferencia del resto de este
// archivo, que siempre usa 'adjuntos') y hace fetch, cacheando de paso
// para la proxima vez. A diferencia de cachearSiHaceFalta (que no
// bloquea la vista, que ya se muestra con la URL firmada), aqui SI hay
// que esperar el Blob completo: hace falta para descifrarlo antes de
// poder mostrar u ofrecer nada. Lanza si no hay forma de conseguirlo
// (sin conexion y sin cache, o el servidor lo rechaza).
export async function obtenerBlobParaVer(
  referencia: string,
  bucket: string,
  duracionSegundos = 120,
): Promise<Blob> {
  const enCache = await obtenerBlobOffline(referencia)
  if (enCache) return enCache

  if (!supabase) throw new Error('La aplicación aún no está conectada al servidor.')
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(referencia, duracionSegundos)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo obtener el enlace del archivo.')

  const respuesta = await fetch(data.signedUrl)
  if (!respuesta.ok) throw new Error('No se pudo descargar el archivo.')
  const blob = await respuesta.blob()
  await guardarEnCacheOffline(referencia, blob)
  return blob
}

async function descargarUno(referencia: string): Promise<void> {
  if (!supabase) throw new Error('La aplicación aún no está conectada al servidor.')
  const { data, error } = await supabase.storage.from('adjuntos').createSignedUrl(referencia, UNA_HORA)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo obtener el enlace del adjunto.')
  await fetchYGuardar(referencia, data.signedUrl)
}

// Todo lo que debe quedar disponible sin conexion: los adjuntos de
// las fichas, todo lo que vive como referencia dentro del JSON del
// procedimiento (archivos del paso, imagenes intercaladas en los
// bloques y la imagen de portada) y la foto principal de cada
// dispositivo (fase Dis2). Exportada para poder probarla sin depender
// de Cache Storage (hallazgo tarea 114: hasta aqui faltaba la foto del
// dispositivo, asi que nunca entraba a este cache offline).
export async function referenciasParaOffline(): Promise<string[]> {
  const referencias = new Set<string>()

  const adjuntos = await db.adjuntos.filter((a) => !a.eliminadoEn).toArray()
  for (const adjunto of adjuntos) referencias.add(adjunto.referencia)

  const articulos = await db.articulos.filter((a) => !a.eliminadoEn).toArray()
  for (const articulo of articulos) {
    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    if (!procedimiento) continue
    if (procedimiento.portada) referencias.add(procedimiento.portada.referencia)
    for (const paso of procedimiento.pasos) {
      for (const adjunto of paso.adjuntos) referencias.add(adjunto.referencia)
      for (const bloque of paso.bloques) {
        if (bloque.adjunto) referencias.add(bloque.adjunto.referencia)
      }
    }
  }

  const dispositivos = await db.dispositivos.filter((d) => !d.eliminadoEn).toArray()
  for (const dispositivo of dispositivos) {
    if (dispositivo.foto) referencias.add(dispositivo.foto.referencia)
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
