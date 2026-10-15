import { useCallback, useSyncExternalStore } from 'react'

// LO POCO DEL CHASIS QUE SE DECIDE EN JAVASCRIPT (tarea 339, handoff de
// tableta y escritorio). Casi todo cambia por ancho con variantes `md:` y
// `xl:` en CSS, pero hay cosas que no pueden existir dos veces y esconder
// una con CSS no basta:
//
//   - el buscador de una raíz: en el dock por debajo de 768 px, en la barra
//     superior desde 768. Dos `CampoBusqueda` vivos serían dos `ref`, dos
//     focos y dos lecturas de `visualViewport` para un solo campo;
//   - la acción principal de un documento: en su barra fija en el teléfono,
//     en la cabecera desde 768. La barra fija publica además el hueco del
//     aviso de versión nueva, que escondido con CSS dejaría el aviso sin
//     verse.
//
// Mismos cortes que el chasis: `md` (48rem, 768 px) y `xl` (80rem, 1280 px).
// Sin `matchMedia` (un entorno sin ventana) se considera teléfono: la app se
// diseña primero para él.
export const ANCHO_TABLETA = '(min-width: 48rem)'
export const ANCHO_ESCRITORIO = '(min-width: 80rem)'
// Dos cortes más, para lo que una pantalla reparte en columnas cuando el
// reparto cambia su estructura y no solo su forma (la Agenda, tarea 339):
// la tableta en horizontal (1024, contenedor de 896) y el escritorio amplio.
export const ANCHO_TABLETA_HORIZONTAL = '(min-width: 64rem)'
export const ANCHO_AMPLIO = '(min-width: 105rem)'

/**
 * ¿La ventana cumple `consulta` AHORA? Para decidir en un gesto o al cerrar
 * (la hoja del teléfono, tarea 341), donde no hace falta suscribirse. Sin
 * `matchMedia`, nunca: es el teléfono.
 */
export function coincide(consulta: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(consulta).matches
}

/**
 * ¿La ventana cumple `consulta`? Cambia en vivo al girar la tableta o
 * estrechar la ventana. Por defecto, desde 768 px (tableta y escritorio).
 */
export function useEsAncho(consulta: string = ANCHO_TABLETA): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
      const lista = window.matchMedia(consulta)
      // Algunas pruebas fingen `matchMedia` con un objeto mínimo.
      if (typeof lista.addEventListener !== 'function') return () => {}
      lista.addEventListener('change', avisar)
      return () => lista.removeEventListener('change', avisar)
    },
    [consulta],
  )
  return useSyncExternalStore(
    suscribir,
    () => coincide(consulta),
    () => false,
  )
}
