import { useSyncExternalStore } from 'react'

// ¿HAY RED? La escucha de `navigator.onLine` que comparten la pastilla de
// sincronización de la barra (`PastillaSync`) y la franja de sin conexión del
// teléfono (`FranjaEstadoSistema`, tarea 342): una sola forma de saberlo.

function suscribirRed(escucha: () => void): () => void {
  window.addEventListener('online', escucha)
  window.addEventListener('offline', escucha)
  return () => {
    window.removeEventListener('online', escucha)
    window.removeEventListener('offline', escucha)
  }
}

/** ¿Hay red? Cambia en vivo con los eventos `online` y `offline`. */
export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirRed, () => navigator.onLine)
}
