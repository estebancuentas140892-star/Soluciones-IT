// EL CONTENIDO NUEVO EMPIEZA ARRIBA (encargo del 2026-09-10, tarea 4).
//
// La ejecución no scrollea la ventana: el contenido vive dentro de un
// contenedor del chasis, y ese contenedor conservaba el desplazamiento
// de la tarea anterior, así que la tarea siguiente aparecía empezada
// por la mitad. Se sube el primer ancestro que de verdad puede
// desplazarse, y también la ventana por si el chasis cambia.
export function subirElContenedor(desde: Element | null) {
  for (let nodo = desde?.parentElement ?? null; nodo; nodo = nodo.parentElement) {
    const desbordamiento = getComputedStyle(nodo).overflowY
    const puedeDesplazarse =
      (desbordamiento === 'auto' || desbordamiento === 'scroll') &&
      nodo.scrollHeight > nodo.clientHeight
    if (puedeDesplazarse) {
      nodo.scrollTop = 0
      return
    }
  }
  window.scrollTo({ top: 0 })
}
