import { useLayoutEffect } from 'react'

// Memoria de scroll por ruta (tarea 187, regla R20: "volver es volver al
// mismo sitio"). Vive en un Map de módulo, fuera de React: Chasis se
// desmonta y se vuelve a montar en cada navegación (cada pantalla monta
// el suyo), así que un estado de componente no sobreviviría de una
// pestaña a la siguiente.
const posiciones = new Map<string, number>()

// La app restaura la posición ella misma, por ruta lógica. Con la
// restauración automática del navegador encendida (el valor por
// defecto) las dos compiten: el navegador reposiciona por entrada de
// historial mientras el contenido todavía está cargando, el oyente de
// scroll de abajo apunta ese valor intermedio como si fuera la posición
// del técnico, y volver aterrizaba en un sitio que nadie eligió.
if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

export function guardarScroll(pathname: string, y: number): void {
  posiciones.set(pathname, y)
}

export function obtenerScroll(pathname: string): number | undefined {
  return posiciones.get(pathname)
}

// Cuánto se insiste en restaurar la posición antes de rendirse.
//
// EL PROBLEMA QUE RESUELVE (criterio A03, medido el 2026-09-09): la
// versión anterior restauraba al montar y reintentaba UNA vez tras dos
// fotogramas. En el catálogo de Guías eso no alcanza: la lista sale de
// Dexie, así que en esos dos fotogramas la página todavía mide una
// pantalla y `scrollTo(900)` se recorta a 0. Volver desde una guía
// dejaba al técnico arriba del todo, con la lista entera por delante
// otra vez.
//
// Ahora se reintenta mientras el documento siga creciendo, con dos
// frenos: un tope de tiempo y, sobre todo, el primer gesto del usuario.
// Si toca la pantalla antes de que los datos lleguen, manda él.
//
// POR QUÉ NO BASTA CON `requestAnimationFrame` (medido el 2026-09-09,
// sección 7 del encargo). El reintento colgaba SOLO del rAF, y el rAF
// no corre cuando el documento no se está pintando: una ventana tapada,
// una pestaña en segundo plano, la app que vuelve de estar oculta. En
// esos casos se ejecutaba el `scrollTo` inicial contra un documento que
// todavía medía una pantalla, el navegador lo recortaba a 0 y no había
// un segundo intento NUNCA, así que volver al catálogo aterrizaba
// arriba del todo. Medido aquí: dos llamadas a `scrollTo(1300)` con el
// documento en 780 px de alto y ni una tercera, mientras la lista
// crecía a 4232 poco después.
//
// El respaldo es un temporizador, no un `ResizeObserver`: `html` y
// `body` miden exactamente la pantalla (el alto que crece es el
// `scrollHeight` del documento, no la caja de ningún elemento), así que
// un observador de tamaño sobre ellos no se dispara jamás.
const MS_MAX_RESTAURACION = 1200

// Cada cuánto reintenta el respaldo. 50 ms es imperceptible para quien
// mira y suficientemente espaciado para no competir con el rAF cuando
// el documento sí se está pintando.
const MS_REINTENTO = 50

// Margen de tolerancia: si la posición alcanzada queda a menos de esto
// del objetivo, se da por buena (la lista puede haber cambiado de alto
// por una fila menos, y saltar por 3 px no aporta nada).
const TOLERANCIA_PX = 4

/**
 * Restaura la posición guardada de `pathname` al montar (sin animar: es
 * un salto, no una transición) y la mantiene al día mientras se hace
 * scroll.
 */
export function useMemoriaScroll(pathname: string): void {
  useLayoutEffect(() => {
    const objetivo = obtenerScroll(pathname) ?? 0
    const limite = Date.now() + MS_MAX_RESTAURACION
    let restaurando = objetivo > 0
    let cuadro = 0

    window.scrollTo({ top: objetivo, behavior: 'auto' })

    // Reintenta hasta llegar al objetivo, o hasta que el documento deje
    // de poder crecer, o hasta que se acabe el tiempo.
    function insistir() {
      if (!restaurando) return
      if (Math.abs(window.scrollY - objetivo) <= TOLERANCIA_PX || Date.now() > limite) {
        restaurando = false
        clearInterval(reloj)
        return
      }
      window.scrollTo({ top: objetivo, behavior: 'auto' })
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(insistir)
    }
    if (restaurando) cuadro = requestAnimationFrame(insistir)

    // Respaldo que no depende de que se pinte: mientras el documento no
    // haya crecido lo suficiente, se vuelve a intentar. `insistir` ya
    // trae sus dos frenos (la tolerancia y el tope de tiempo), así que
    // esto no puede pelearse con el técnico ni quedarse para siempre.
    const reloj = restaurando ? setInterval(() => insistir(), MS_REINTENTO) : 0

    let pendiente = false
    function alDesplazar() {
      if (pendiente) return
      pendiente = true
      requestAnimationFrame(() => {
        // Mientras se restaura, los `scrollTo` de arriba disparan este
        // mismo evento: guardar entonces machacaría el objetivo con una
        // posición intermedia.
        if (!restaurando) guardarScroll(pathname, window.scrollY)
        pendiente = false
      })
    }

    // Cualquier gesto real del usuario cancela la restauración: si ya
    // empezó a moverse, mandarlo de vuelta sería pelearse con él.
    function alGesto() {
      restaurando = false
    }

    window.addEventListener('scroll', alDesplazar, { passive: true })
    window.addEventListener('wheel', alGesto, { passive: true })
    window.addEventListener('touchstart', alGesto, { passive: true })
    window.addEventListener('keydown', alGesto)

    return () => {
      cancelAnimationFrame(cuadro)
      clearInterval(reloj)
      restaurando = false
      window.removeEventListener('scroll', alDesplazar)
      window.removeEventListener('wheel', alGesto)
      window.removeEventListener('touchstart', alGesto)
      window.removeEventListener('keydown', alGesto)
      // ÚLTIMA OPORTUNIDAD DE GUARDAR, PERO NUNCA UN CERO (la causa real
      // del criterio A03, medida el 2026-09-09).
      //
      // React aplica los cambios del DOM ANTES de correr las limpiezas:
      // al salir del catálogo, la pantalla nueva ya sustituyó la lista
      // larga, el documento se quedó en una pantalla de alto y el
      // navegador recortó `scrollY` a 0. La limpieza guardaba ese 0
      // encima del 900 que el propio oyente de scroll ya había
      // guardado, así que volver siempre caía arriba del todo.
      //
      // El oyente de scroll es quien lleva el dato al día; esto solo
      // cubre el caso de salir sin que llegara a dispararse, y por eso
      // un 0 aquí no puede pisar una posición real.
      if (window.scrollY > 0) guardarScroll(pathname, window.scrollY)
    }
  }, [pathname])
}
