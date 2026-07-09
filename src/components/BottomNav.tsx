import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../features/autenticacion/authContext'

interface Tab {
  to: string
  label: string
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element
  end: boolean
}

const TABS_BASE: Tab[] = [
  { to: '/', label: 'Inicio', icon: HomeIcon, end: true },
  { to: '/soluciones', label: 'Soluciones', icon: BookIcon, end: false },
  { to: '/dispositivos', label: 'Dispositivos', icon: DeviceIcon, end: false },
  { to: '/red', label: 'Red', icon: RedIcon, end: false },
]

// La seccion de credenciales solo aparece a los usuarios con permiso:
// el resto ni siquiera sabe que existe. Se llamo "Notas" (nombre
// neutro de discrecion) hasta el 2026-07-09; el usuario decidio
// volver a llamarla Boveda. La proteccion real sigue siendo RLS +
// contrasena maestra, no el nombre de la pestaña.
const TAB_BOVEDA: Tab = { to: '/boveda', label: 'Bóveda', icon: NoteIcon, end: false }

export function BottomNav() {
  const { session } = useAuth()
  // El perfil se lee en vivo de la base local para que la pestaña
  // aparezca apenas la primera sincronizacion lo descargue.
  const perfil = useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )

  const tabs = perfil?.puedeVerBoveda ? [...TABS_BASE, TAB_BOVEDA] : TABS_BASE

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className={`mx-auto grid max-w-md ${tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-sky-400' : 'text-slate-400'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H12v18h6.5a1.5 1.5 0 0 0 1.5-1.5v-15Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DeviceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="4" y="3" width="16" height="12" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20h6M12 15v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RedIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="9" y="3" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M12 12H6v4M12 12h6v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NoteIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
