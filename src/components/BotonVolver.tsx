import { Link } from 'react-router-dom'

interface Props {
  to: string
  children: string
}

// Boton de regreso consistente en toda la app: icono de flecha y area
// tactil comoda para el uso desde el celular. Reemplaza los antiguos
// enlaces de texto "← destino".
export function BotonVolver({ to, children }: Props) {
  return (
    <Link
      to={to}
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
      {children}
    </Link>
  )
}
