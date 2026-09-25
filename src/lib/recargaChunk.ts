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

// ----------------------------------------------------------------
// Sin conexion no se recarga ni se reinstala (tarea 259)
// ----------------------------------------------------------------
//
// Desde la 259, Importar y Etiquetas no vienen en el precache: se bajan
// la primera vez que se abren con conexion. Abrirlas sin conexion antes de
// eso falla por falta de red, no por una version vieja, y el remedio de
// siempre seria contraproducente: recargar no trae nada, y reinstalar tira el service
// worker y las caches justo cuando no se pueden volver a bajar, asi que
// el telefono se quedaria sin la app entera. Lo mismo pasaba ya si
// Android desalojaba un trozo de la cache y el tecnico estaba sin red.

export function sinConexion(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

const ESPERA_SERVIDOR_MS = 4000

// `navigator.onLine` solo sabe si hay red, no si llega al servidor (un
// portal cautivo, una red sin salida). /version.json sirve de prueba
// porque nunca se sirve de una cache: va fuera del precache y con
// `no-store` en vercel.json.
export async function servidorResponde(): Promise<boolean> {
  if (sinConexion()) return false
  const controlador = typeof AbortController === 'undefined' ? null : new AbortController()
  const temporizador = controlador ? setTimeout(() => controlador.abort(), ESPERA_SERVIDOR_MS) : null
  try {
    const respuesta = await fetch('/version.json', { cache: 'no-store', signal: controlador?.signal })
    return respuesta.ok
  } catch {
    return false
  } finally {
    if (temporizador) clearTimeout(temporizador)
  }
}

// Recarga la pagina una vez y devuelve si lo hizo. Si ya se recargo hace
// poco, o no hay conexion (recargar no traeria nada), devuelve false para
// que el llamador decida.
export function recargarUnaVezPorChunk(): boolean {
  if (sinConexion()) return false
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

// 'reinstalando': se dio de baja el service worker, se borraron las caches
// y se esta recargando. 'ya_intentado': se hizo hace poco y no se repite.
// 'sin_servidor': el servidor no responde y no se toco nada.
export type ResultadoReinstalacion = 'reinstalando' | 'ya_intentado' | 'sin_servidor'

// Da de baja los service workers, borra las caches y recarga, pero solo si
// el servidor responde: sin el, la app no se podria volver a bajar.
export async function reinstalarYRecargar(): Promise<ResultadoReinstalacion> {
  if (yaSeIntentoReinstalar()) return 'ya_intentado'
  if (!(await servidorResponde())) return 'sin_servidor'
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
  return 'reinstalando'
}
