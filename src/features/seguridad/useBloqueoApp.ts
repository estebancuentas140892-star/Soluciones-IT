import { useEffect, useState, useSyncExternalStore } from 'react'
import { bloqueoAppDesbloqueado, suscribirBloqueoApp } from './bloqueoApp'
import { desbloqueoDispositivoDisponible } from './desbloqueoDispositivo'

// Refleja en React el estado del bloqueo de la app: los componentes se
// actualizan solos al desbloquear o bloquear.
export function useBloqueoAppDesbloqueado(): boolean {
  return useSyncExternalStore(suscribirBloqueoApp, bloqueoAppDesbloqueado)
}

// Si este navegador y este dispositivo permiten el desbloqueo del
// dispositivo (tarea 278). `null` mientras se consulta (un instante): así
// ninguna pantalla ofrece la opción ni la esconde antes de saberlo.
export function useDesbloqueoDispositivoDisponible(): boolean | null {
  const [disponible, setDisponible] = useState<boolean | null>(null)
  useEffect(() => {
    let vigente = true
    void desbloqueoDispositivoDisponible().then((valor) => {
      if (vigente) setDisponible(valor)
    })
    return () => {
      vigente = false
    }
  }, [])
  return disponible
}
