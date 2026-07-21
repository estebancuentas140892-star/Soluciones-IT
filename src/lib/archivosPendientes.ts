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
// lo muestre como error de subida, igual que antes.
export async function subirOEncolarArchivo(
  referencia: string,
  archivo: Blob,
  nombre: string,
  bucket: string = BUCKET_POR_DEFECTO,
): Promise<ResultadoSubida> {
  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    await encolarArchivo(referencia, archivo, nombre, bucket)
    return 'encolado'
  }

  const { error } = await supabase.storage.from(bucket).upload(referencia, archivo)
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
