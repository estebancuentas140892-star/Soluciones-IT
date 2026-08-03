import { Link, useLocation } from 'react-router-dom'
import { padreDe } from '../lib/navegacion'
import { CaretLeft } from './iconos'

interface Props {
  /**
   * Override del destino. Por defecto se deriva de la jerarquía central
   * (`padreDe`); solo se pasa cuando el destino depende de datos en
   * runtime (por ejemplo la ficha de un equipo de red, que vuelve a Red).
   */
  to?: string
  /** Override de la etiqueta (por ejemplo "Salir" o "Cancelar"). */
  children?: string
  /**
   * Cuadrado de 44 px con solo el chevron, para la fila del nivel
   * documento que además lleva el ancla permanente (M-R1): ahí el
   * destino ya lo nombra la línea de contexto, así que repetirlo al
   * lado del nombre del equipo gastaría la mitad del renglón. La
   * etiqueta no se pierde: viaja como `aria-label` y como `title`.
   */
  soloIcono?: boolean
}

// Botón de regreso unificado de toda la app. Deriva a qué pantalla sube
// (y su etiqueta) de la fuente única `padreDe`, de modo que ninguna
// pantalla cablea su destino a mano y no puede volver a desincronizarse
// con un rediseño (causa de las tareas 75 y 76). Los casos con contexto
// en runtime pasan un `to`/`children` explícito.
export function BotonVolver({ to, children, soloIcono = false }: Props) {
  const { pathname } = useLocation()
  const padre = padreDe(pathname)
  const destino = to ?? padre?.to ?? '/'
  const etiqueta = children ?? padre?.etiqueta ?? 'Volver'

  if (soloIcono) {
    return (
      <Link
        to={destino}
        aria-label={`Volver a ${etiqueta}`}
        title={`Volver a ${etiqueta}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 transition-colors hover:bg-noct-text/5 hover:text-noct-text"
      >
        <CaretLeft size={18} aria-hidden />
      </Link>
    )
  }

  return (
    <Link
      to={destino}
      className="inline-flex min-w-0 items-center gap-1 rounded-lg py-2 pl-1.5 pr-2.5 text-[13px] text-noct-neutral-400 transition-colors hover:bg-noct-text/5 hover:text-noct-text"
    >
      <CaretLeft size={16} className="shrink-0" aria-hidden />
      <span className="truncate">{etiqueta}</span>
    </Link>
  )
}
