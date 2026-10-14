import { FilaDeslizable } from '../../components/FilaDeslizable'
import { ALCANCES, type Alcance } from './alcanceBusqueda'

// LOS CHIPS DE ALCANCE (tarea 330): "Todo" y cada alcance con resultados,
// con su conteo en IBM Plex Mono. Solo filtran la vista. Una sola fila que se
// desliza en horizontal (`FilaDeslizable`); 44 px de toque.
//
// Desde 768 px (tarea 338) con la forma de los chips de categoría de Equipos
// de antes del rediseño móvil: redondos, 13 px de peso medio, borde del
// divisor y el conteo en Inter a 11.5 px.
export function ChipsDeAlcance({
  conteo,
  alcance,
  onCambiar,
}: {
  conteo: Record<Alcance, number>
  alcance: Alcance
  onCambiar: (alcance: Alcance) => void
}) {
  const chips = [
    { valor: 'todo' as const, etiqueta: 'Todo' },
    ...ALCANCES.filter((a) => conteo[a.valor] > 0),
  ]
  // Con un solo alcance con resultados, "Todo" y ese chip dirían lo mismo.
  if (chips.length <= 2) return null
  return (
    <FilaDeslizable etiqueta="Filtrar los resultados" className="gap-1.5 md:gap-2">
      {chips.map((chip) => {
        const activo = chip.valor === alcance
        return (
          <button
            key={chip.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(chip.valor)}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 text-[13.5px] font-semibold transition-colors md:gap-[7px] md:rounded-full md:px-[14px] md:text-[13px] md:font-medium ${
              activo
                ? 'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300'
                : 'border-noct-text/25 text-noct-neutral-200 hover:bg-noct-text/[.05] md:border-noct-divider md:text-noct-neutral-300'
            }`}
          >
            {chip.etiqueta}
            {/* El conteo con color y no con opacidad: al 75 % el del chip
                activo no llegaba a 4.5:1 en el tema claro (tarea 333). En el
                inactivo, un paso más tenue que el nombre. */}
            <span
              className={`font-mono text-[12px] md:font-inter md:text-[11.5px] ${activo ? 'md:text-noct-accent-400' : 'text-noct-neutral-400 md:text-noct-neutral-600'}`}
            >
              {conteo[chip.valor]}
            </span>
          </button>
        )
      })}
    </FilaDeslizable>
  )
}
