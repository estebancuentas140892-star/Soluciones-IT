import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../features/autenticacion/authContext'
import {
  BookOpen,
  BookOpenFill,
  House,
  HouseFill,
  Monitor,
  MonitorFill,
  TreeStructure,
  TreeStructureFill,
  Vault,
  VaultFill,
  type IconoProps,
} from '../components/iconos'

// Shell móvil del sistema Nocturne (handoff "Herramienta IT para
// técnicos", 2026-07-16): columna centrada de 448px sobre el fondo
// oscuro del sistema y 5 pestañas inferiores fijas con blur. Nocturne
// reemplaza la dirección de tema claro del handoff anterior (decisión
// D-006); lo usan solo las pantallas ya re-autorizadas y el resto de
// la app sigue en su shell actual hasta que el rediseño de cada una
// llegue (D-008: re-autoría pantalla por pantalla).

interface Destino {
  to: string
  label: string
  icono: (props: IconoProps) => React.JSX.Element
  iconoActivo: (props: IconoProps) => React.JSX.Element
  end: boolean
}

const DESTINOS_BASE: Destino[] = [
  { to: '/', label: 'Inicio', icono: House, iconoActivo: HouseFill, end: true },
  { to: '/soluciones', label: 'Soluciones', icono: BookOpen, iconoActivo: BookOpenFill, end: false },
  { to: '/dispositivos', label: 'Dispositivos', icono: Monitor, iconoActivo: MonitorFill, end: false },
  { to: '/red', label: 'Red', icono: TreeStructure, iconoActivo: TreeStructureFill, end: false },
]

// Igual que en BottomNav y AppShell: la Bóveda solo aparece a quien
// tiene el permiso; el resto ni siquiera sabe que existe.
const DESTINO_BOVEDA: Destino = {
  to: '/boveda',
  label: 'Bóveda',
  icono: Vault,
  iconoActivo: VaultFill,
  end: false,
}

export function ShellNocturne({ children }: { children: React.ReactNode }) {
  const { session, perfil } = useAuth()
  const perfilVivo = useLiveQuery(
    async () => (session?.user ? ((await db.perfiles.get(session.user.id)) ?? null) : null),
    [session],
  )

  const usuario = perfilVivo ?? perfil
  const destinos = usuario?.puedeVerBoveda ? [...DESTINOS_BASE, DESTINO_BOVEDA] : DESTINOS_BASE

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">{children}</div>

      <nav
        className={`fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 border-t border-noct-divider bg-noct-bg/[.88] pb-[env(safe-area-inset-bottom)] backdrop-blur-[12px] ${
          destinos.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
        }`}
      >
        {destinos.map(({ to, label, icono: Icono, iconoActivo: IconoActivo, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-11 flex-col items-center gap-[3px] pb-[9px] pt-2 text-[10.5px] font-medium ${
                isActive ? 'text-noct-accent' : 'text-noct-neutral-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? <IconoActivo size={22} /> : <Icono size={22} />}
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
