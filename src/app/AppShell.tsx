import { useLiveQuery } from 'dexie-react-hooks'
import { Link, NavLink } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../features/autenticacion/authContext'

// Shell del rediseño en tema claro (handoff de Claude Design,
// 2026-07-16): sidebar fija de 240 px en escritorio (>=1024px) y
// cabecera compacta + pestañas inferiores en móvil, con los 5 módulos.
// Lo usan solo las pantallas ya rediseñadas; el resto de la app sigue
// en el Layout oscuro hasta que el rediseño de cada una llegue
// (decisión D-002 del proyecto de diseño: pantalla por pantalla).

interface Destino {
  to: string
  label: string
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element
  end: boolean
}

const DESTINOS_BASE: Destino[] = [
  { to: '/', label: 'Inicio', icon: IconoInicio, end: true },
  { to: '/soluciones', label: 'Soluciones', icon: IconoSoluciones, end: false },
  { to: '/dispositivos', label: 'Dispositivos', icon: IconoDispositivos, end: false },
  { to: '/red', label: 'Red', icon: IconoRed, end: false },
]

// Igual que en BottomNav: la Bóveda solo aparece a quien tiene el
// permiso; el resto ni siquiera sabe que existe.
const DESTINO_BOVEDA: Destino = { to: '/boveda', label: 'Bóveda', icon: IconoBoveda, end: false }

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, perfil } = useAuth()
  // El perfil se lee en vivo de la base local para que la Bóveda
  // aparezca apenas la primera sincronización lo descargue.
  const perfilVivo = useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )

  const usuario = perfilVivo ?? perfil
  const destinos = usuario?.puedeVerBoveda ? [...DESTINOS_BASE, DESTINO_BOVEDA] : DESTINOS_BASE

  return (
    <div className="flex h-svh bg-zinc-50 text-zinc-900">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-zinc-200 bg-white px-3 py-5 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <IconoMarca className="h-[22px] w-[22px] text-blue-600" />
          <span className="text-[15px] font-semibold">IT Brain</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {destinos.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-[9px] text-sm ${
                  isActive
                    ? 'bg-blue-50 font-semibold text-blue-600'
                    : 'font-medium text-zinc-600 hover:bg-zinc-100'
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-zinc-200 pt-2">
          <Link to="/cuenta" className="block rounded-md p-2.5 hover:bg-zinc-100">
            <p className="text-[13px] font-semibold">{usuario?.nombre || 'Mi cuenta'}</p>
            {usuario?.correo && <p className="text-xs text-zinc-400">{usuario.correo}</p>}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3.5 lg:hidden">
          <div className="flex items-center gap-2">
            <IconoMarca className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold">IT Brain</span>
          </div>
          <Link
            to="/cuenta"
            aria-label="Mi cuenta"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600"
          >
            {iniciales(usuario?.nombre ?? '')}
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-5 lg:px-12 lg:pt-10">{children}</main>

        <nav
          className={`fixed inset-x-0 bottom-0 z-20 grid border-t border-zinc-200 bg-white/[.97] pb-[env(safe-area-inset-bottom)] backdrop-blur-[6px] lg:hidden ${
            destinos.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
          }`}
        >
          {destinos.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-[3px] py-[9px] text-[11px] ${
                  isActive ? 'font-semibold text-blue-600' : 'font-medium text-zinc-500'
                }`
              }
            >
              <Icon className="h-[21px] w-[21px]" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

// Iniciales para el avatar móvil: primeras letras de las dos primeras
// palabras del nombre ("Ana Torres" -> "AT").
function iniciales(nombre: string): string {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? '')
    .join('')
  return letras || '?'
}

function IconoMarca(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path
        d="M12 3a4 4 0 0 0-4 4v1.2A5 5 0 0 0 5 13v3a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3a5 5 0 0 0-3-4.8V7a4 4 0 0 0-4-4Z"
        strokeLinejoin="round"
      />
      <path d="M9 20v.5A1.5 1.5 0 0 0 10.5 22h3a1.5 1.5 0 0 0 1.5-1.5V20" strokeLinecap="round" />
    </svg>
  )
}

function IconoInicio(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconoSoluciones(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H12v18h6.5a1.5 1.5 0 0 0 1.5-1.5v-15Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconoDispositivos(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="4" y="3" width="16" height="12" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20h6M12 15v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconoRed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="9" y="3" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M12 12H6v4M12 12h6v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconoBoveda(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
