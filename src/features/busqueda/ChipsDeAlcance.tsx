import { FilaDeslizable } from '../../components/FilaDeslizable'
import { ALCANCES, type Alcance } from './alcanceBusqueda'

// LOS CHIPS DE ALCANCE (tarea 330): "Todo" y cada alcance con resultados,
// con su conteo en IBM Plex Mono. Solo filtran la vista. Una sola fila que se
// desliza en horizontal (`FilaDeslizable`); 44 px de toque.
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
    <FilaDeslizable etiqueta="Filtrar los resultados" className="gap-1.5">
      {chips.map((chip) => {
        const activo = chip.valor === alcance
        return (
          <button
            key={chip.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(chip.valor)}
            // EL ACTIVO, RELLENO EN EL TELÉFONO (tarea 342, handoff móvil): el
            // texto del sistema de fondo y el fondo en su letra, que se lee en
            // los dos temas sin depender del cian. Desde 768, el tinte de
            // acento de la 339.
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 text-[13.5px] font-semibold transition-colors ${
              activo
                ? 'border-noct-accent bg-noct-accent/[.14] text-noct-accent-300 max-md:border-noct-text max-md:bg-noct-text max-md:text-noct-bg'
                : 'border-noct-text/25 text-noct-neutral-200 hover:bg-noct-text/[.05] max-md:active:bg-noct-presionado'
            }`}
          >
            {chip.etiqueta}
            {/* El conteo con color y no con opacidad: al 75 % el del chip
                activo no llegaba a 4.5:1 en el tema claro (tarea 333). En el
                inactivo, un paso más tenue que el nombre. */}
            <span className={`font-mono text-[12px] ${activo ? '' : 'text-noct-neutral-400'}`}>{conteo[chip.valor]}</span>
          </button>
        )
      })}
    </FilaDeslizable>
  )
}
