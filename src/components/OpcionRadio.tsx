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
// LA TARJETA DEL TELÉFONO (tarea 343, cierre de un mantenimiento del handoff
// móvil "1b Pulgar"): una respuesta por tarjeta de 60, radio 13, borde de
// 1.5, la palabra a 15.5/600 y su detalle debajo, con el círculo de 20; se
// elige con una mano. Desde 768, la opción de siempre.
const TARJETA_TELEFONO =
  'max-md:min-h-[60px] max-md:gap-3 max-md:rounded-[13px] max-md:border-[1.5px] max-md:px-3.5 max-md:py-2.5 max-md:text-[15.5px] max-md:active:bg-noct-presionado'

export function OpcionRadio({
  activa,
  onClick,
  tarjeta = false,
  detalle,
  children,
}: {
  activa: boolean
  onClick: () => void
  /** En el teléfono, como tarjeta de 60 con su detalle (tarea 343). */
  tarjeta?: boolean
  /** Lo que esa respuesta hace, en una línea a 13 bajo la palabra. */
  detalle?: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={`${OPCION} ${activa ? OPCION_ACTIVA : OPCION_INACTIVA} ${tarjeta ? TARJETA_TELEFONO : ''}`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          activa ? 'border-noct-accent' : 'border-noct-neutral-600'
        } ${tarjeta ? 'max-md:h-5 max-md:w-5 max-md:border-[1.5px]' : ''}`}
      >
        {activa && <span className={`h-2 w-2 rounded-full bg-noct-accent ${tarjeta ? 'max-md:h-2.5 max-md:w-2.5' : ''}`} />}
      </span>
      <span className="min-w-0 flex-1">
        {tarjeta ? <span className="max-md:block max-md:font-semibold max-md:text-noct-text">{children}</span> : children}
        {/* Con `tarjeta`, el detalle es del teléfono: desde 768 la opción es la de siempre. */}
        {detalle && (
          <span
            className={`block text-[12px] leading-snug text-noct-neutral-400 max-md:mt-0.5 max-md:text-[13px] ${tarjeta ? 'md:hidden' : ''}`}
          >
            {detalle}
          </span>
        )}
      </span>
    </button>
  )
}
