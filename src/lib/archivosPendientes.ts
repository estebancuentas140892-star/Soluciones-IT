import { db } from './db'
import { supabase } from './supabase'
import { eliminarDeCacheOffline, guardarEnCacheOffline } from './adjuntosOffline'

// Cola de subida de archivos (fotos, manuales) a Supabase Storage.
// Cierra la ultima excepcion del modo offline: antes, adjuntar un
// archivo exigia internet en ese momento. Ahora, si la subida directa
// no es posible, el archivo queda guardado en el telefono (IndexedDB)
// y disponible al instante desde el cache offline; el motor de
// sincronizacion (src/lib/sync.ts) sube los pendientes al recuperar
// conexion, antes de procesar la cola de cambios, para que la fila
// del adjunto no llegue al servidor antes que su archivo.

export type ResultadoSubida = 'subido' | 'encolado'

// Un fallo de red se reintenta solo; cualquier otro rechazo del
// servidor (permisos, tamano) se registra para mostrarlo en el
// indicador en vez de reintentar a ciegas para siempre.
export function esErrorDeRed(mensaje: string): boolean {
  // Solo cuenta como "sin red" cuando el navegador lo afirma: en Node
  // (pruebas) navigator.onLine es undefined y no significa offline.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return /fetch|network|conexi/i.test(mensaje)
}

// Bucket por defecto (fotos y manuales de artículos/dispositivos). El
// bóveda de archivos seguros (fase P5) usa uno propio y privado: ver
// BUCKET_ARCHIVOS_BOVEDA en src/features/boveda/archivoSeguro.ts. La
// referencia de cada archivo debe arrancar con un prefijo propio de su
// productor (`dispositivos/...`, `articulos/...`, `credenciales/...`)
// para que nunca colisione entre buckets: ni la cola local
// (`archivosPendientes`, clave `referencia`) ni el cache offline
// (`adjuntosOffline.ts`, clave derivada de `referencia`) guardan el
// bucket como parte de su clave.
const BUCKET_POR_DEFECTO = 'adjuntos'

// Sube el archivo directo a Storage si hay conexion; si no la hay (o
// se corta a mitad de camino), lo deja en la cola local. Un rechazo
// real del servidor estando en linea se propaga para que la interfaz
// lo muestre como error de subida, igual que antes. `upsert` solo lo
// pasa en true la deduplicacion por hash (subirConDeduplicacion): ahi
// la referencia ES el hash del contenido, asi que sobrescribir un
// archivo con el mismo nombre siempre son los mismos bytes (cierra la
// carrera de dos tecnicos subiendo el mismo archivo nuevo a la vez,
// donde el segundo llegaria despues de que el primero ya lo creo).
export async function subirOEncolarArchivo(
  referencia: string,
  archivo: Blob,
  nombre: string,
  bucket: string = BUCKET_POR_DEFECTO,
  upsert = false,
): Promise<ResultadoSubida> {
  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    await encolarArchivo(referencia, archivo, nombre, bucket)
    return 'encolado'
  }

  const { error } = await supabase.storage.from(bucket).upload(referencia, archivo, { upsert })
  if (!error) return 'subido'
  if (esErrorDeRed(error.message)) {
    await encolarArchivo(referencia, archivo, nombre, bucket)
    return 'encolado'
  }
  throw new Error(error.message)
}

export async function encolarArchivo(
  referencia: string,
  archivo: Blob,
  nombre: string,
  bucket: string = BUCKET_POR_DEFECTO,
): Promise<void> {
  await db.archivosPendientes.put({
    referencia,
    contenido: archivo,
    tipo: archivo.type,
    nombre,
    bucket,
    creadoEn: new Date().toISOString(),
    error: null,
    intentos: 0,
  })
  // La copia offline hace que la ficha muestre el archivo de
  // inmediato, sin esperar a que exista en el servidor.
  await guardarEnCacheOffline(referencia, archivo)
}

// Se llama al eliminar un adjunto: si su archivo seguia en la cola,
// ya no hay nada que subir.
export async function eliminarArchivoPendiente(referencia: string): Promise<void> {
  await db.archivosPendientes.delete(referencia)
  await eliminarDeCacheOffline(referencia)
}

// ----------------------------------------------------------------
// Deduplicacion por hash (tarea 123, decision D3 de
// PROPUESTA_JORNADA_TECNICO.md)
// ----------------------------------------------------------------
//
// No existe una entidad "Archivo" independiente (decision ya tomada,
// ver la propuesta): la deduplicacion se resuelve por completo dentro
// de la referencia de Storage, el campo que ya existe, sin columna ni
// tabla nueva. Dos archivos con el mismo contenido terminan en la
// MISMA referencia ('compartidos/<hash>'), sin importar que tecnico ni
// que ficha los subio: Adjuntos.tsx (fotos/manuales de articulo,
// dispositivo o intervencion) y el FotoEditor de DispositivoForm.tsx
// la usan por igual. El archivo seguro cifrado de la boveda (fase P5)
// queda fuera a proposito: cada cifrado usa un IV distinto aunque el
// contenido original sea el mismo, asi que el hash del texto cifrado
// nunca coincidiria entre dos subidas.
const PREFIJO_COMPARTIDO = 'compartidos'

// SHA-256 en hexadecimal del contenido. Es hash de CONTENIDO, no de
// metadatos: dos archivos con el mismo nombre pero distinto contenido
// nunca coinciden, y dos archivos identicos con nombres distintos
// (por ejemplo "manual.pdf" y "manual_v2.pdf" subidos por tecnicos
// distintos) si.
export async function calcularHashArchivo(archivo: Blob): Promise<string> {
  const buffer = await archivo.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function referenciaCompartida(hash: string): string {
  return `${PREFIJO_COMPARTIDO}/${hash}`
}

// ¿Ya existe un archivo con esta referencia en el bucket? Solo mira
// metadatos (list), nunca descarga el contenido. Sin conexion (o si
// el bucket no responde) se asume que no existe: la subida normal
// sigue su curso: como mucho sube un archivo que ya estaba, y
// subirUnoAStorage ya usa upsert para tolerarlo.
async function existeEnStorage(referencia: string, bucket: string = BUCKET_POR_DEFECTO): Promise<boolean> {
  if (!supabase) return false
  const separador = referencia.lastIndexOf('/')
  const carpeta = separador === -1 ? '' : referencia.slice(0, separador)
  const nombre = referencia.slice(separador + 1)
  const { data, error } = await supabase.storage.from(bucket).list(carpeta, { search: nombre, limit: 1 })
  if (error) return false
  return (data ?? []).some((archivo) => archivo.name === nombre)
}

// ¿Hay algun adjunto activo (sincronizado desde cualquier tecnico) o
// la foto de algun dispositivo que ya apunte a esta referencia? Sirve
// para dos cosas: decidir si hace falta subir bytes nuevos (evita
// tocar la red si el contenido ya se conoce localmente, aunque no haya
// conexion) y, al eliminar un adjunto, no borrar del bucket un archivo
// que otra ficha todavia esta usando.
export async function referenciaEnUso(referencia: string): Promise<boolean> {
  const enAdjuntos = await db.adjuntos.filter((a) => !a.eliminadoEn && a.referencia === referencia).first()
  if (enAdjuntos) return true
  const enFotoDispositivo = await db.dispositivos
    .filter((d) => !d.eliminadoEn && d.foto?.referencia === referencia)
    .first()
  return enFotoDispositivo !== undefined
}

export interface ResultadoSubidaDeduplicada {
  referencia: string
  resultado: ResultadoSubida
  // true cuando el contenido ya existia (en uso localmente o ya
  // presente en Storage): no se subieron bytes nuevos.
  reutilizado: boolean
}

// Punto de entrada para Adjuntos.tsx y el FotoEditor de
// DispositivoForm.tsx: calcula el hash del contenido, arma su
// referencia compartida y, si ya existe, la reutiliza en vez de subir
// de nuevo. Si no hay forma de saberlo (por ejemplo sin conexion y sin
// ningun adjunto local que lo confirme), sigue el camino normal de
// subirOEncolarArchivo con esa misma referencia: si el contenido
// resulta subirse dos veces desde telefonos distintos, el segundo
// intento hace upsert sobre el mismo objeto en vez de duplicarlo.
export async function subirConDeduplicacion(archivo: Blob, nombre: string): Promise<ResultadoSubidaDeduplicada> {
  const hash = await calcularHashArchivo(archivo)
  const referencia = referenciaCompartida(hash)

  if (await referenciaEnUso(referencia)) {
    return { referencia, resultado: 'subido', reutilizado: true }
  }
  if (await existeEnStorage(referencia)) {
    return { referencia, resultado: 'subido', reutilizado: true }
  }

  const resultado = await subirOEncolarArchivo(referencia, archivo, nombre, BUCKET_POR_DEFECTO, true)
  return { referencia, resultado, reutilizado: false }
}

export async function contarArchivosPendientes(): Promise<{ total: number; conError: number }> {
  const pendientes = await db.archivosPendientes.toArray()
  return { total: pendientes.length, conError: pendientes.filter((a) => a.error !== null).length }
}

// ----------------------------------------------------------------
// Procesamiento de la cola (lo invoca el motor de sincronizacion)
// ----------------------------------------------------------------

export type SubidorDeArchivos = (
  referencia: string,
  contenido: Blob,
  tipo: string,
  bucket: string,
) => Promise<{ message: string } | null>

// upsert: si un intento anterior subio el archivo pero no alcanzo a
// quitarlo de la cola, el reintento no debe fallar por duplicado.
async function subirUnoAStorage(
  referencia: string,
  contenido: Blob,
  tipo: string,
  bucket: string,
): Promise<{ message: string } | null> {
  if (!supabase) return { message: 'La aplicación aún no está conectada al servidor.' }
  const { error } = await supabase.storage
    .from(bucket)
    .upload(referencia, contenido, { contentType: tipo || undefined, upsert: true })
  return error ? { message: error.message } : null
}

// Sube los archivos pendientes en orden de llegada. Con un corte de
// red se interrumpe (el resto queda para la proxima pasada); un
// rechazo del servidor se anota en el archivo y se sigue con los
// demas, igual que la cola de cambios de sync.ts.
export async function procesarArchivosPendientes(subirUno: SubidorDeArchivos = subirUnoAStorage): Promise<void> {
  const pendientes = await db.archivosPendientes.orderBy('creadoEn').toArray()

  for (const archivo of pendientes) {
    const error = await subirUno(archivo.referencia, archivo.contenido, archivo.tipo, archivo.bucket ?? BUCKET_POR_DEFECTO)
    if (!error) {
      await db.archivosPendientes.delete(archivo.referencia)
    } else if (esErrorDeRed(error.message)) {
      throw new Error('Sin conexión con el servidor')
    } else {
      await db.archivosPendientes.update(archivo.referencia, {
        error: error.message,
        intentos: archivo.intentos + 1,
      })
    }
  }
}
