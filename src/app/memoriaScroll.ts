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
const MS_MAX_RESTAURACION = 1200

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
        return
      }
      window.scrollTo({ top: objetivo, behavior: 'auto' })
      cuadro = requestAnimationFrame(insistir)
    }
    if (restaurando) cuadro = requestAnimationFrame(insistir)

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
