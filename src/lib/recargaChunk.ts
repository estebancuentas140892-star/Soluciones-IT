// Recuperacion ante el fallo tipico de una PWA con carga diferida:
// tras publicar una version nueva, el navegador aun tiene en memoria el
// index.html viejo y pide un trozo (chunk) con un nombre que ya no
// existe en el servidor. El import dinamico falla y, sin manejo, la app
// se queda con la pantalla en blanco. La solucion es recargar una sola
// vez para tomar el index.html nuevo.

const CLAVE = 'recarga-por-chunk'
// Si ya se recargo hace menos de esto, no volver a intentar: evita un
// bucle de recargas cuando el problema no es de version (por ejemplo,
// sin conexion). En ese caso el error se maneja con la interfaz de
// reintento manual del ErrorBoundary.
const VENTANA_MS = 10_000

// Mensajes de import dinamico fallido segun el navegador. Se listan de
// forma explicita para no confundirlos con otros errores de red de la
// app (una peticion a Supabase que falla no debe recargar la pagina).
const PATRON_CHUNK =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|chunkloaderror/i

export function esErrorDeChunk(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error)
  return PATRON_CHUNK.test(mensaje)
}

// Recarga la pagina una vez y devuelve si lo hizo. Si ya se recargo hace
// poco, devuelve false para que el llamador muestre el reintento manual.
export function recargarUnaVezPorChunk(): boolean {
  try {
    const ahora = Date.now()
    const previo = Number(sessionStorage.getItem(CLAVE) ?? '0')
    if (ahora - previo < VENTANA_MS) return false
    sessionStorage.setItem(CLAVE, String(ahora))
  } catch {
    // Si sessionStorage no esta disponible, recargar de todos modos:
    // es mejor una recarga extra que una pantalla en blanco.
  }
  window.location.reload()
  return true
}

// ----------------------------------------------------------------
// Segundo intento: reinstalar la aplicacion desde el servidor
// ----------------------------------------------------------------
//
// El caso que la recarga simple NO resuelve, y que dejaba el telefono
// muerto en bucle: el service worker sirve las navegaciones desde SU
// index.html precacheado (`NavigationRoute` + `createHandlerBoundToURL`).
// Si a ese build le falta un trozo en la cache (Android desaloja caches
// cuando aprieta el almacenamiento) la app lo pide a la red, y ahi ya no
// existe: cada despliegue nuevo retira los assets del anterior. Entonces
// recargar vuelve a leer el MISMO index.html roto de la cache, falla
// igual, y el boton "Recargar" no lleva a ninguna parte.
//
// La salida es tirar la instalacion y bajarla de nuevo: dar de baja los
// service workers y borrar las caches del navegador.
//
// NO SE TOCA INDEXEDDB, y es deliberado: ahi viven el avance de los
// procedimientos, los favoritos, la cola de subida y la boveda. Se borra
// solo lo que se puede volver a bajar del servidor.

const CLAVE_REINSTALAR = 'reinstalacion-por-chunk'

// Cuanto se espera antes de permitir otra reinstalacion. Mas larga que
// VENTANA_MS a proposito: si tras reinstalar sigue fallando, el problema
// no es la cache y repetirlo solo gasta datos del tecnico.
const VENTANA_REINSTALAR_MS = 60_000

export function yaSeIntentoReinstalar(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(CLAVE_REINSTALAR) ?? '0') < VENTANA_REINSTALAR_MS
  } catch {
    return false
  }
}

// Da de baja los service workers, borra las caches y recarga. Devuelve
// false sin hacer nada si ya se intento hace poco.
export async function reinstalarYRecargar(): Promise<boolean> {
  if (yaSeIntentoReinstalar()) return false
  try {
    sessionStorage.setItem(CLAVE_REINSTALAR, String(Date.now()))
  } catch {
    // Sin sessionStorage se pierde el freno, pero la recarga posterior
    // es lo que importa.
  }
  // Cada paso va en su try: que falle uno (permisos, navegador viejo,
  // modo privado) no puede impedir los demas ni la recarga final.
  try {
    if ('serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registros.map((r) => r.unregister()))
    }
  } catch {
    // sin service worker que dar de baja
  }
  try {
    if ('caches' in window) {
      const nombres = await caches.keys()
      await Promise.all(nombres.map((n) => caches.delete(n)))
    }
  } catch {
    // sin Cache Storage disponible
  }
  window.location.reload()
  return true
}
