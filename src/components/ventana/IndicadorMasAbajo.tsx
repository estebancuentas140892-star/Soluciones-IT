import { IconoVentana } from './IconoVentana'

// «MÁS ABAJO» (tarea 348, ajuste 4 del 2026-10-21): una franja de 34 px sobre
// el pie que anuncia lo que todavía no se ve de la ventana. Es SOLO un
// indicador visual: no es un botón, no tiene zona táctil, no se anuncia al
// lector de pantalla (el contenido ya está en la página, en su orden) y no
// captura toques. Si algún día se vuelve interactivo, su zona táctil tendrá
// que medir 44 px como la de los demás controles.

interface Props {
  texto: string
  /** Lo que queda abajo es una advertencia crítica: se pinta en rojo. */
  critico?: boolean
}

export function IndicadorMasAbajo({ texto, critico = false }: Props) {
  return (
    <div
      aria-hidden
      data-mas-abajo
      className={`pointer-events-none flex h-[34px] w-full select-none items-center justify-center gap-1.5 border-b border-noct-divider text-[13.5px] font-extrabold ${
        critico ? 'bg-noct-error-tinte text-noct-error' : 'bg-noct-neutral-900 text-noct-text'
      }`}
    >
      <IconoVentana nombre="flecha-abajo" tam={16} grosor={2.6} className="shrink-0" />
      <span className="truncate px-1">{texto}</span>
    </div>
  )
}
