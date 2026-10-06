import { useEffect, useState } from 'react'
import { AroCarga } from './AroCarga'

// CARGANDO (tarea 291, auditoría UX de Claude Design, sección 11, S3).
//
// Toda página que esperaba mostraba "Cargando..." a 14 px arriba a la
// izquierda, también cuando los datos ya estaban en el teléfono y llegaban
// en milisegundos: el texto parpadeaba y la pantalla saltaba. Ahora:
//
// - **Nada durante 400 ms.** Casi siempre los datos son locales y llegan
//   antes, y entonces no se dibuja nada.
// - Si tarda más, "Cargando…" con su aro, **donde irá el contenido**: la
//   cabecera de la pantalla, cuando ya existe, sigue siendo la real.
// - En un botón no se usa esto: la carga va dentro del propio botón
//   (`Boton` con `cargando`, T4 y F9).

export const ESPERA_CARGANDO_MS = 400

function useTrasEspera(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const temporizador = window.setTimeout(() => setVisible(true), ESPERA_CARGANDO_MS)
    return () => window.clearTimeout(temporizador)
  }, [])
  return visible
}

// "Cargando…" en el sitio del contenido, dentro de una pantalla que ya
// pinta su cabecera.
export function CargandoContenido({ className = 'px-4 py-6' }: { className?: string }) {
  const visible = useTrasEspera()
  if (!visible) return null
  return (
    <p role="status" className={`flex items-center gap-2 text-[13.5px] text-noct-neutral-400 ${className}`}>
      <AroCarga size={16} />
      Cargando…
    </p>
  )
}

// La página entera mientras espera, para lo que se dibuja ANTES de que
// exista el chasis (el trozo diferido de una pantalla, el inicio de
// sesión, el guard de bloqueo y el de sesión): ahí no hay ningún ancestro
// que ya pinte el fondo oscuro (mismo motivo que documenta
// ErrorBoundary.tsx), así que trae su propio fondo y tipografía.
export function Cargando() {
  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
      <CargandoContenido className="px-4 pt-6" />
    </div>
  )
}
