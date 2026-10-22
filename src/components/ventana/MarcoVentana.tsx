import type { ReactNode } from 'react'
import { IconoVentana } from './IconoVentana'

// LA VENTANA COMO VENTANA (tarea 350, la firma del prototipo de Claude
// Design): el paso que se tiene delante se dibuja como la ventana del
// programa que se está configurando, con su barra de título «VENTANA 2» y, al
// revisarla ya hecha, «Hecha». Dentro va lo de siempre: su título, sus
// avisos, sus acciones numeradas y su comprobación; al pie, las dos salidas a
// la mano («Tengo un problema» y «Detalles de la guía»).
//
// Los tres controles de la barra (minimizar, maximizar, cerrar) son dibujo:
// no se tocan, no se anuncian y son pequeños y grises para que nadie los
// confunda con un botón. La X que sale de la guía está en la cabecera.

interface Props {
  /** El número de la ventana en el recorrido (el de la cabecera). */
  numero: number
  /** Se está revisando una ventana ya hecha. */
  hecha: boolean
  /** Las salidas al pie de la ventana. */
  pie?: ReactNode
  children: ReactNode
}

export function MarcoVentana({ numero, hecha, pie, children }: Props) {
  return (
    <article
      aria-label={`Ventana ${numero}`}
      data-marco-ventana
      className="flex-none overflow-hidden rounded-[22px] border-[1.5px] border-noct-divider bg-noct-surface shadow-[0_2px_0_var(--color-noct-sombra-tarjeta)]"
    >
      <div className="flex h-9 items-center gap-2 border-b border-noct-divider bg-noct-neutral-900 px-3.5">
        <IconoVentana nombre="ventana" tam={16} className="shrink-0 text-noct-neutral-300" />
        <span className="text-[13px] font-extrabold uppercase tracking-[.06em] text-noct-neutral-300">Ventana {numero}</span>
        {hecha && (
          <span
            data-ventana-hecha
            className="inline-flex h-[22px] items-center gap-1 rounded-full bg-noct-exito-tinte px-2 text-[12.5px] font-extrabold text-noct-exito"
          >
            <IconoVentana nombre="hecho" tam={12} grosor={3.4} />
            Hecha
          </span>
        )}
        <span className="flex-1" />
        <span aria-hidden className="flex items-center gap-2.5 text-noct-neutral-400">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M1 5h8" />
          </svg>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <rect x="1.2" y="1.2" width="7.6" height="7.6" />
          </svg>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
          </svg>
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-1.5 pt-3.5 max-[379px]:px-3.5 max-[379px]:pt-3">{children}</div>
      {pie && <div className="flex flex-wrap gap-2 px-3 pb-3.5 pt-2.5">{pie}</div>}
    </article>
  )
}
