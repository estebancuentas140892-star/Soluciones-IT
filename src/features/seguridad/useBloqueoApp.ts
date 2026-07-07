import { useSyncExternalStore } from 'react'
import { bloqueoAppDesbloqueado, suscribirBloqueoApp } from './bloqueoApp'

// Refleja en React el estado del bloqueo de la app: los componentes se
// actualizan solos al desbloquear o bloquear.
export function useBloqueoAppDesbloqueado(): boolean {
  return useSyncExternalStore(suscribirBloqueoApp, bloqueoAppDesbloqueado)
}
