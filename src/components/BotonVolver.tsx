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
  /** Estilo: "claro" (pantallas heredadas) o "nocturne" (rediseñadas). */
  variante?: 'claro' | 'nocturne'
}

// Botón de regreso unificado de toda la app. Deriva a qué pantalla sube
// (y su etiqueta) de la fuente única `padreDe`, de modo que ninguna
// pantalla cablea su destino a mano y no puede volver a desincronizarse
// con un rediseño (causa de las tareas 75 y 76). Los casos con contexto
// en runtime pasan un `to`/`children` explícito.
export function BotonVolver({ to, children, variante = 'claro' }: Props) {
  const { pathname } = useLocation()
  const padre = padreDe(pathname)
  const destino = to ?? padre?.to ?? '/'
  const etiqueta = children ?? padre?.etiqueta ?? 'Volver'

  if (variante === 'nocturne') {
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

  return (
    <Link
      to={destino}
      className="inline-flex items-center gap-1 self-start rounded-full border border-slate-800 bg-slate-900 py-1.5 pl-2 pr-3.5 text-xs font-medium text-slate-300 transition-colors active:bg-slate-800"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {etiqueta}
    </Link>
  )
}
