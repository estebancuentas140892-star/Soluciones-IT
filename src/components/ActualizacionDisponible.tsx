import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { BTN_PRIMARIO } from './nocturne'

// Comprobacion periodica de version nueva (ademas de al cargar la app):
// un telefono que queda abierto durante horas se entera sin que el
// tecnico recargue a mano.
const INTERVALO_COMPROBACION_MS = 60 * 60 * 1000

// Si el service worker nuevo no toma el control en este tiempo, se
// recarga igual. Ver el comentario de `actualizar`: es la red que impide
// que el boton se quede sin hacer nada.
const ESPERA_MAX_MS = 2500

// Aviso de actualizacion. Con registerType 'prompt' la version nueva
// queda "en espera" hasta que el usuario confirma, asi los despliegues
// llegan sin interrumpir un procedimiento a medias. Se monta siempre
// (devuelve null mientras no haya novedad).
export function ActualizacionDisponible() {
  const [actualizando, setActualizando] = useState(false)
  const {
    needRefresh: [necesitaActualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return
      setInterval(() => void registro.update(), INTERVALO_COMPROBACION_MS)
    },
  })

  // La recarga se hace SIEMPRE desde aqui, y nunca se delega en la
  // libreria. Motivo (bug reportado por el usuario el 2026-07-27: "le doy
  // al boton y no pasa nada"):
  //
  // `updateServiceWorker` termina llamando a `messageSkipWaiting()` de
  // workbox-window, que es literalmente
  // `registration.waiting && enviarMensaje(registration.waiting)`. Si en
  // ese momento NO hay worker en espera, la llamada no hace nada en
  // silencio: no se manda el mensaje, no hay `skipWaiting`, no se emite
  // `controllerchange` y por tanto no hay recarga. Pero el aviso sigue en
  // pantalla, porque `needRefresh` continua en true. Resultado: un boton
  // que no hace nada, para siempre, hasta que el tecnico recarga a mano.
  //
  // Y `registration.waiting` puede ser null teniendo el aviso delante:
  // otra ventana de la app ya activo ese worker, o el telefono suspendio
  // la app y al reanudarla el navegador ya lo habia activado por su
  // cuenta. En escritorio casi no pasa; en un movil con la PWA instalada
  // es lo normal, que es por que el fallo solo se veia en el telefono.
  //
  // Con esto el boton tiene un solo contrato: recarga. Si habia worker en
  // espera, recarga en cuanto toma el control (rapido); si no lo habia,
  // recarga igual al vencer la espera, y como el worker nuevo ya estaba
  // activo, esa recarga trae la version nueva de todos modos.
  async function actualizar() {
    setActualizando(true)

    let yaRecargado = false
    function recargar() {
      if (yaRecargado) return
      yaRecargado = true
      window.location.reload()
    }

    // Camino normal: el worker nuevo toma el control y recargamos.
    // `once` evita acumular escuchas si se toca el boton dos veces.
    navigator.serviceWorker?.addEventListener('controllerchange', recargar, { once: true })
    // Red de seguridad para el caso de arriba.
    window.setTimeout(recargar, ESPERA_MAX_MS)

    try {
      // `false` porque la recarga la controlamos nosotros. (La libreria
      // ignora este argumento y ademas recarga por su cuenta en algunos
      // caminos; el guardia `yaRecargado` hace que sobre con una.)
      await updateServiceWorker(false)
    } catch {
      // Si el mensaje al worker falla, recargar es lo unico util que
      // queda: nunca dejar el boton sin efecto.
      recargar()
    }
  }

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
          onClick={() => void actualizar()}
          // Deshabilitado mientras recarga para que el toque tenga una
          // respuesta visible: parte del reporte original era justamente
          // que el boton no daba ninguna señal de haberse pulsado.
          disabled={actualizando}
          className={`shrink-0 disabled:opacity-60 ${BTN_PRIMARIO}`}
        >
          {actualizando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>
  )
}
