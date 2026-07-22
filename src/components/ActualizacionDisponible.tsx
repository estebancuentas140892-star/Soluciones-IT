import { useRegisterSW } from 'virtual:pwa-register/react'
import { BTN_PRIMARIO } from './nocturne'

// Comprobacion periodica de version nueva (ademas de al cargar la app):
// un telefono que queda abierto durante horas se entera sin que el
// tecnico recargue a mano.
const INTERVALO_COMPROBACION_MS = 60 * 60 * 1000

// Aviso de actualizacion. Con registerType 'prompt' la version nueva
// queda "en espera" hasta que el usuario confirma: aqui se muestra una
// barra discreta y, al tocar Actualizar, updateServiceWorker(true)
// activa el nuevo service worker y recarga la pagina con el codigo
// nuevo. Asi los despliegues llegan sin interrumpir un procedimiento a
// medias. Se monta siempre (devuelve null mientras no haya novedad).
export function ActualizacionDisponible() {
  const {
    needRefresh: [necesitaActualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return
      setInterval(() => void registro.update(), INTERVALO_COMPROBACION_MS)
    },
  })

  if (!necesitaActualizar) return null

  return (
    // Flota sobre la barra inferior (fixed bottom-0 z-20): por eso
    // bottom-20 y z-50. Centrado como pastilla para verse igual en las
    // pantallas sin barra (login, escaner).
    <div className="nocturne fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 font-inter">
      <div className="flex items-center gap-3 rounded-full border border-noct-accent/40 bg-noct-surface/95 px-4 py-2 shadow-lg backdrop-blur">
        <p className="text-sm text-noct-text">Versión nueva disponible</p>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className={`shrink-0 ${BTN_PRIMARIO}`}
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}
