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
  // Con una guía en curso, el hueco de su barra de acciones (tarea 273,
  // ver ranuraAvisoActualizacion.ts).
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
    // Dentro de la barra de la guía, encima de sus botones y en su mismo
    // flujo: la barra crece hacia arriba, así que ningún control se mueve
    // ni queda tapado, y el paso no se desplaza.
    return createPortal(
      <div className="flex items-center justify-between gap-3 rounded-xl border border-noct-accent/40 bg-noct-surface px-3.5 py-1.5">
        {contenido}
      </div>,
      hueco,
    )
  }

  return (
    // Flota sobre la barra inferior (fixed bottom-0 z-20): por eso
    // bottom-20 y z-50. Centrado como pastilla para verse igual en las
    // pantallas sin barra (login, escaner).
    <div className="nocturne fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 font-inter">
      <div className="flex items-center gap-3 rounded-full border border-noct-accent/40 bg-noct-surface/95 px-4 py-2 shadow-lg backdrop-blur">
        {contenido}
      </div>
    </div>
  )
}
