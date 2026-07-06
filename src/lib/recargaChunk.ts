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
