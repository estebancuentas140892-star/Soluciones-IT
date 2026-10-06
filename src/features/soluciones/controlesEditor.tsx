import type { ComponentType, ReactNode } from 'react'
import type { IconoProps } from '../../components/iconos'

// Botones pequeños de las filas del editor de pasos: los de la fila de
// acciones de una tarea y los de cada opción de una decisión (tarea 302).
// Viven aparte para que los dos editores usen los mismos.

// Botón pequeño de la fila de acciones de una tarea. 44 px de alto
// (regla R6): son controles que se tocan de pie y con una mano.
export function BotonLinea({
  Icono,
  onClick,
  activo,
  etiqueta,
  children,
}: {
  Icono: ComponentType<IconoProps>
  onClick: () => void
  activo?: boolean
  etiqueta?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={`inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium ${
        activo
          ? 'border-noct-accent/45 bg-noct-accent/[.1] text-noct-accent-300'
          : 'border-noct-divider text-noct-neutral-300 hover:text-noct-text'
      }`}
    >
      <Icono size={14} className="shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
}

// Botón de solo icono de 44 × 44 (subir, bajar, quitar). Desactivado
// cuando el gesto no tendría efecto (subir la primera, quitar una de las
// dos opciones mínimas): se ve, pero apagado.
export function BotonIconoLinea({
  Icono,
  etiqueta,
  onClick,
  disabled = false,
}: {
  Icono: ComponentType<IconoProps>
  etiqueta: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-noct-divider text-noct-neutral-400 hover:text-noct-text disabled:cursor-default disabled:opacity-40 disabled:hover:text-noct-neutral-400"
    >
      <Icono size={15} />
    </button>
  )
}
