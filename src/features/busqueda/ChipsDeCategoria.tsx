import { FilaDeslizable } from '../../components/FilaDeslizable'
import { IconoCategoria } from '../../components/IconoCategoria'
import { BookOpen } from '../../components/iconos'
import { useEsAncho } from '../../components/useEsAncho'
import type { CategoriaConCuenta } from './categoriasDeAlcance'

// LA FILA (tarea 362, D2, prototipo de Claude Design). En el teléfono, una
// fila que se desliza como la de tipo, con chips de 34 de dibujo (44 de toque)
// que llevan el icono de su categoría a 22; la elegida, con el borde en tinta.
// Desde 768, con su rótulo «Categoría» delante, en varias líneas si hace
// falta, y la elegida en el acento como el chip de tipo de esos anchos.
export function ChipsDeCategoria({
  categorias,
  total,
  categoria,
  onElegir,
}: {
  categorias: CategoriaConCuenta[]
  total: number
  categoria: string | null
  onElegir: (categoria: string | null) => void
}) {
  const ancho = useEsAncho()
  if (categorias.length === 0) return null
  const chips = [{ nombre: null, cantidad: total }, ...categorias]
  const icono = (nombre: string | null, tam: number) =>
    nombre === null ? (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-[7px] bg-noct-neutral-900 text-noct-neutral-300"
        style={{ width: tam, height: tam }}
      >
        <BookOpen size={Math.round(tam * 0.62)} />
      </span>
    ) : (
      <IconoCategoria nombre={nombre} tam={tam} />
    )
  if (!ancho) {
    return (
      <FilaDeslizable etiqueta="Filtrar por categoría" className="gap-1.5 py-1">
        {chips.map((chip) => {
          const activo = chip.nombre === categoria
          return (
            <button
              key={chip.nombre ?? ''}
              type="button"
              aria-pressed={activo}
              data-chip-categoria={chip.nombre ?? 'todas'}
              onClick={() => onElegir(chip.nombre)}
              className={`toque-amplio relative inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] pl-1.5 pr-3 text-[13.5px] font-bold text-noct-text ${
                activo ? 'border-noct-text bg-noct-text/[.12]' : 'border-noct-divider active:bg-noct-presionado'
              }`}
            >
              {icono(chip.nombre, 22)}
              {chip.nombre ?? 'Todas'} {chip.cantidad}
            </button>
          )
        })}
      </FilaDeslizable>
    )
  }
  return (
    <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap items-center gap-1.5">
      <span className="pr-1 text-[12.5px] text-noct-neutral-400">Categoría</span>
      {chips.map((chip) => {
        const activo = chip.nombre === categoria
        return (
          <button
            key={chip.nombre ?? ''}
            type="button"
            aria-pressed={activo}
            data-chip-categoria={chip.nombre ?? 'todas'}
            onClick={() => onElegir(chip.nombre)}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] border-[1.5px] pl-[5px] pr-2.5 text-[13px] font-semibold transition-colors xl:h-9 ${
              activo
                ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
                : 'border-noct-text/20 text-noct-neutral-200 hover:bg-noct-text/[.05]'
            }`}
          >
            {icono(chip.nombre, 22)}
            {chip.nombre ?? 'Todas'}
            <span className={`font-mono text-[12px] ${activo ? '' : 'text-noct-neutral-400'}`}>{chip.cantidad}</span>
          </button>
        )
      })}
    </div>
  )
}
