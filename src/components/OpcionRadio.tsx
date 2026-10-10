import type { ReactNode } from 'react'

// UNA RESPUESTA DE UNA PREGUNTA CERRADA (role="radio"), de 44 px de alto.
//
// Nació dentro de `DecisionSobreEquipo` (tarea 266, "¿Qué pasa con este
// equipo?") y se extrajo en la tarea 320 al necesitarla también el
// mantenimiento (preventivo o correctivo; se hizo, se pospone o se
// cancela). Quien la usa pone el contenedor con role="radiogroup" y su
// nombre accesible. Botón y no <input type="radio">: la app no usa los
// controles nativos del navegador, que en Nocturne no se ven.

const OPCION =
  'flex min-h-11 w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[13.5px] transition-colors'
const OPCION_ACTIVA = 'border-noct-accent bg-noct-accent/[.12] text-noct-text'
const OPCION_INACTIVA = 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'

export function OpcionRadio({
  activa,
  onClick,
  children,
}: {
  activa: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={`${OPCION} ${activa ? OPCION_ACTIVA : OPCION_INACTIVA}`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          activa ? 'border-noct-accent' : 'border-noct-neutral-600'
        }`}
      >
        {activa && <span className="h-2 w-2 rounded-full bg-noct-accent" />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}
