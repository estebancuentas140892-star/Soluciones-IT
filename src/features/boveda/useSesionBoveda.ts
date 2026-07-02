import { useSyncExternalStore } from 'react'
import { bovedaDesbloqueada, suscribirBoveda } from './sesionBoveda'

// Refleja en React el estado de la sesion de la boveda: los
// componentes se actualizan solos al desbloquear o bloquear.
export function useBovedaDesbloqueada(): boolean {
  return useSyncExternalStore(suscribirBoveda, bovedaDesbloqueada)
}
