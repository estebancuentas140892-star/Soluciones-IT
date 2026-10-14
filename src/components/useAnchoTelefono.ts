import { useSyncExternalStore } from 'react'
import { esAnchoTelefono, suscribirAnchoTelefono } from '../lib/anchoTelefono'

/**
 * ¿Se está viendo con ancho de teléfono (< 768 px)? Para lo que el rediseño
 * "1b Pulgar" decide en JavaScript y no en CSS (tarea 338): dónde va el
 * buscador de una raíz, en el dock de abajo o arriba como siempre. Cambia
 * en vivo al girar el teléfono o estrechar la ventana.
 */
export function useAnchoTelefono(): boolean {
  return useSyncExternalStore(suscribirAnchoTelefono, esAnchoTelefono, () => true)
}
