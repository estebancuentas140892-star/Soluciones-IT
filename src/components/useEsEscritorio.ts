import { useSyncExternalStore } from 'react'

// ¿Se ve la app como escritorio (desde 768 px)? Lo usan la hoja y el
// diálogo comunes (tarea 291) para elegir entre la hoja pegada abajo del
// teléfono y el diálogo centrado o junto a su control.
//
// El punto de quiebre del teléfono es el mismo de las pestañas del chasis
// (`md`, 768 px).
const CONSULTA_ESCRITORIO = '(min-width: 768px)'

function suscribirEscritorio(escucha: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const consulta = window.matchMedia(CONSULTA_ESCRITORIO)
  consulta.addEventListener('change', escucha)
  return () => consulta.removeEventListener('change', escucha)
}

function esEscritorio(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_ESCRITORIO).matches
}

export function useEsEscritorio(): boolean {
  return useSyncExternalStore(suscribirEscritorio, esEscritorio, () => false)
}
