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
}

// Botón de regreso unificado de toda la app. Deriva a qué pantalla sube
// (y su etiqueta) de la fuente única `padreDe`, de modo que ninguna
// pantalla cablea su destino a mano y no puede volver a desincronizarse
// con un rediseño (causa de las tareas 75 y 76). Los casos con contexto
// en runtime pasan un `to`/`children` explícito.
export function BotonVolver({ to, children }: Props) {
  const { pathname } = useLocation()
  const padre = padreDe(pathname)
  const destino = to ?? padre?.to ?? '/'
  const etiqueta = children ?? padre?.etiqueta ?? 'Volver'

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
