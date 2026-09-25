import { useState } from 'react'
import { createPortal } from 'react-dom'
import { BTN_PRIMARIO } from './nocturne'
import { useHuecoAvisoActualizacion } from './ranuraAvisoActualizacion'

// El aviso "Versión nueva disponible", separado de `useRegisterSW` para
// poder montarlo en las pruebas: el módulo virtual `virtual:pwa-register`
// solo existe cuando corre el plugin de PWA.
//
// Con `registerType: 'prompt'` la versión nueva queda en espera y solo
// entra cuando el técnico toca "Actualizar": así un despliegue no
// interrumpe un procedimiento a medias.
export function AvisoActualizacion({
  visible,
  onActualizar,
}: {
  visible: boolean
  onActualizar: () => Promise<void>
}) {
  const [actualizando, setActualizando] = useState(false)
  // Dónde va: el hueco de una barra de acciones de la pantalla (la de una
  // guía, tarea 273) o, si no, la franja del chasis sobre las pestañas
  // (tarea 274). Ver ranuraAvisoActualizacion.ts.
  const hueco = useHuecoAvisoActualizacion()
  if (!visible) return null

  async function actualizar() {
    setActualizando(true)
    await onActualizar()
  }

  const contenido = (
    <>
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
    </>
  )

  if (hueco) {
    // En el flujo de la barra o de la franja, que reservan su sitio: la
    // barra de una guía crece hacia arriba y la franja va detrás de lo
    // último de la pantalla, así que ningún control queda tapado ni se
    // mueve, y el contenido no se desplaza.
    return createPortal(
      <div className="flex items-center justify-between gap-3 rounded-xl border border-noct-accent/40 bg-noct-surface px-3.5 py-1.5">
        {contenido}
      </div>,
      hueco,
    )
  }

  return (
    // Sin hueco (fuera del chasis, como el inicio de sesión, o en una
    // tarea sin barra que llegue a su altura, tarea 275) flota como
    // siempre: sobre donde iría la barra inferior (fixed bottom-0 z-20),
    // por eso bottom-20 y z-50.
    <div className="nocturne fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 font-inter">
      <div className="flex items-center gap-3 rounded-full border border-noct-accent/40 bg-noct-surface/95 px-4 py-2 shadow-lg backdrop-blur">
        {contenido}
      </div>
    </div>
  )
}
