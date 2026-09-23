import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight, type IconoProps } from '../../components/iconos'
import type { EstadoConOrigen } from '../../lib/origenNavegacion'

// LAS FILAS DE UNA PANTALLA ÍNDICE (Más y, desde la tarea 268,
// Herramientas de inventario). Vivían dentro de `PantallaMas`; salen a su
// propio módulo para que la puerta de inventario tenga exactamente la
// misma forma que Más, sin copiarla.

export function TituloGrupo({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-400">
      {children}
    </h2>
  )
}

// EL CONTEO VA A LA DERECHA (tarea 207, hallazgo M-025). Iba pegado al
// final del subtítulo ("Sedes, salas y racks · 12"), así que se leía
// como parte de la descripción y no se podía comparar de un vistazo
// entre filas. A la derecha, antes del galón, queda en la misma ranura
// que en Guías y Equipos y las cifras se alinean solas.
export function ConteoFila({ valor }: { valor: number | null }) {
  if (valor === null) return null
  return <span className="shrink-0 font-mono text-[13px] tabular-nums text-noct-neutral-400">{valor}</span>
}

export function FilaMas({
  to,
  Icono,
  titulo,
  subtitulo,
  conteo = null,
  nota,
  estado,
}: {
  to: string
  Icono: (props: IconoProps) => React.JSX.Element
  titulo: string
  subtitulo: string
  conteo?: number | null
  /**
   * Una aclaración propia de la fila, debajo del subtítulo: "Mejor desde
   * el ordenador" en Importar y Etiquetas (tarea 257), que antes era el
   * título de un grupo entero.
   */
  nota?: string
  /**
   * El `state` del salto, para la fila que lleva a una pantalla cuyo
   * padre no es la que la lista (regla M-R2: volver deshace el último
   * salto).
   */
  estado?: EstadoConOrigen
}) {
  return (
    <Link
      to={to}
      state={estado}
      className="flex min-h-[58px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-300">
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-[1.3]">{titulo}</span>
        {/* Sin recortar (tarea 268): en un teléfono estrecho, el
            subtítulo pasa a una segunda línea antes que esconder lo que
            hay dentro de la puerta. */}
        <span className="mt-0.5 block text-[12px] leading-[1.4] text-noct-neutral-400">{subtitulo}</span>
        {nota && <span className="mt-0.5 block text-[11.5px] text-noct-neutral-500">{nota}</span>}
      </span>
      <ConteoFila valor={conteo} />
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}
