import { useEffect } from 'react'

// LA PANTALLA NO SE APAGA MIENTRAS LA GUÍA ESTÁ ABIERTA (tarea 354; Fase 1
// del prototipo de Claude Design, «La pantalla se apaga mientras trabajas:
// volver a la guía puede costar desbloquear el teléfono», y Fase 4, «la
// pantalla no se apaga mientras la guía esté abierta»).
//
// El técnico deja el teléfono al lado y trabaja en otro computador: si la
// pantalla se apaga, volver a la ventana cuesta desbloquear el teléfono.
// Con la Screen Wake Lock API se pide que siga encendida mientras la guía
// está abierta y a la vista. El navegador la suelta solo al pasar a segundo
// plano; al volver se pide otra vez. Al salir de la guía se suelta.
//
// Si el navegador no la ofrece, o la niega (batería baja, permisos), no
// pasa nada: la pantalla se apaga como siempre. Nunca lanza.

interface BloqueoPantalla {
  release: () => Promise<void>
  addEventListener?: (tipo: 'release', fn: () => void) => void
}

export interface ServicioBloqueo {
  request: (tipo: 'screen') => Promise<BloqueoPantalla>
}

function servicioDelNavegador(): ServicioBloqueo | null {
  if (typeof navigator === 'undefined') return null
  const servicio = (navigator as Navigator & { wakeLock?: ServicioBloqueo }).wakeLock
  return servicio && typeof servicio.request === 'function' ? servicio : null
}

/**
 * Mantiene la pantalla encendida mientras `activa` sea verdadero y la
 * página esté visible. `servicio` se inyecta en las pruebas.
 */
export function usePantallaEncendida(activa: boolean, servicio: ServicioBloqueo | null = servicioDelNavegador()): void {
  useEffect(() => {
    if (!activa || !servicio) return
    let vivo = true
    let bloqueo: BloqueoPantalla | null = null
    let pidiendo = false

    const pedir = async () => {
      if (!vivo || bloqueo || pidiendo || document.visibilityState !== 'visible') return
      pidiendo = true
      try {
        const nuevo = await servicio.request('screen')
        if (!vivo) {
          void nuevo.release().catch(() => undefined)
          return
        }
        bloqueo = nuevo
        // El navegador lo suelta al pasar a segundo plano: se olvida para
        // poder pedirlo de nuevo al volver.
        nuevo.addEventListener?.('release', () => {
          if (bloqueo === nuevo) bloqueo = null
        })
      } catch {
        // Sin permiso o con la batería baja: la pantalla se apaga como siempre.
      } finally {
        pidiendo = false
      }
    }

    const alCambiarVisibilidad = () => void pedir()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    void pedir()

    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      const soltar = bloqueo
      bloqueo = null
      void soltar?.release().catch(() => undefined)
    }
  }, [activa, servicio])
}
