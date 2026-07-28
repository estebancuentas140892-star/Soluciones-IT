import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../features/autenticacion/authContext'
import { usePerfilVivo } from '../features/autenticacion/usePerfilVivo'
import { Avatar } from '../components/Avatar'
import {
  BookOpen,
  BookOpenFill,
  CaretRight,
  DotsNine,
  House,
  HouseFill,
  MapPin,
  Monitor,
  MonitorFill,
  QrCode,
  TreeStructure,
  TreeStructureFill,
  UsersThree,
  Vault,
  VaultFill,
  type IconoProps,
} from '../components/iconos'
import { TituloSeccion } from '../components/nocturne'

// Shell del sistema Nocturne (handoff "Herramienta IT para técnicos",
// 2026-07-16). Responsive según el layout del handoff de Soluciones
// (D-006, adaptado a Nocturne): en escritorio (>=1024px) sidebar fija
// de 240px con los 5 módulos y el perfil; en móvil, columna centrada
// de 448px con 5 pestañas inferiores fijas con blur. Nocturne
// reemplaza la dirección de tema claro del handoff anterior; lo usan
// solo las pantallas ya re-autorizadas y el resto de la app sigue en
// su shell actual hasta que el rediseño de cada una llegue (D-008:
// re-autoría pantalla por pantalla).

interface Destino {
  to: string
  label: string
  icono: (props: IconoProps) => React.JSX.Element
  iconoActivo: (props: IconoProps) => React.JSX.Element
  end: boolean
}

const DESTINOS_BASE: Destino[] = [
  { to: '/', label: 'Inicio', icono: House, iconoActivo: HouseFill, end: true },
  { to: '/soluciones', label: 'Guías', icono: BookOpen, iconoActivo: BookOpenFill, end: false },
  { to: '/dispositivos', label: 'Equipos', icono: Monitor, iconoActivo: MonitorFill, end: false },
  { to: '/red', label: 'Red', icono: TreeStructure, iconoActivo: TreeStructureFill, end: false },
]

// La Bóveda solo aparece a quien tiene el permiso; el resto ni
// siquiera sabe que existe. Sigue siendo un destino completo del
// sidebar de escritorio, en su nav principal (no baja a "Herramientas"
// ni a "Registros": ver DESTINO_MAS más abajo).
const DESTINO_BOVEDA: Destino = {
  to: '/boveda',
  label: 'Bóveda',
  icono: Vault,
  iconoActivo: VaultFill,
  end: false,
}

// Quinta pestaña móvil (tarea 182, mockup 3f): la Bóveda deja de ser
// pestaña y pasa a encabezar "Más" (decisión aprobada por el usuario),
// que además da puerta a los ocho destinos que hoy no aparecen en la
// barra ni en el sidebar. Sin variante rellena: el mockup usa el mismo
// glifo activo e inactivo, solo cambia el color (igual que hace el
// resto del estado con la barra de 2px y el color de acento).
const DESTINO_MAS: Destino = {
  to: '/mas',
  label: 'Más',
  icono: DotsNine,
  iconoActivo: DotsNine,
  end: false,
}

export function ShellNocturne({ children }: { children: React.ReactNode }) {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()

  const usuario = perfilVivo ?? perfil
  // Escritorio: los cinco módulos, Bóveda condicional al permiso (sin
  // cambios de la tarea 182). Los grupos "Herramientas" y "Registros"
  // se dibujan aparte, debajo de este nav (tarea 183).
  const destinosDesktop = usuario?.puedeVerBoveda ? [...DESTINOS_BASE, DESTINO_BOVEDA] : DESTINOS_BASE
  // Móvil: siempre las mismas cinco, para todos (regla R17). Antes la
  // barra cambiaba de 4 a 5 columnas según el permiso de Bóveda, así
  // que dos técnicos con el mismo teléfono veían barras distintas.
  const destinosMobile = [...DESTINOS_BASE, DESTINO_MAS]

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text lg:flex">
      {/* Sidebar de escritorio: fija a 240px. Catorce destinos desde la
          tarea 183 (mockup 3e): los cinco módulos, "Herramientas" y
          "Registros" (los ocho que hasta la 182 solo tenían puerta en
          "Más", que no existe fuera de móvil), y el perfil al pie. Antes
          el sidebar tenía 240px de alto libre y ofrecía cinco destinos
          de catorce. */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-[18px] border-r border-noct-divider bg-noct-surface px-3 py-5 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <Marca className="h-[22px] w-[22px] text-noct-accent" />
          <span className="text-[15px] font-semibold">Soluciones IT</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {destinosDesktop.map(({ to, label, icono: Icono, iconoActivo: IconoActivo, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-[9px] text-sm ${
                  isActive
                    ? 'bg-noct-accent/[.12] font-semibold text-noct-accent'
                    : 'font-medium text-noct-neutral-400 hover:bg-noct-text/[.05]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? <IconoActivo size={18} /> : <Icono size={18} />}
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div>
          <TituloSeccion className="mb-1.5 px-2.5">Herramientas</TituloSeccion>
          <nav className="flex flex-col gap-0.5">
            <EnlaceGrupo to="/diagnostico" label="Diagnóstico" Icono={TreeStructure} />
            <EnlaceGrupo to="/escaner" label="Escanear" Icono={QrCode} />
          </nav>
        </div>

        <div>
          <TituloSeccion className="mb-1.5 px-2.5">Registros</TituloSeccion>
          <nav className="flex flex-col gap-0.5">
            <EnlaceGrupo to="/ubicaciones" label="Ubicaciones" Icono={MapPin} />
            <EnlaceGrupo to="/personas" label="Personas" Icono={UsersThree} />
          </nav>
        </div>

        <div className="mt-auto border-t border-noct-divider pt-2.5">
          <Link
            to="/cuenta"
            className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-noct-text/[.05]"
          >
            <Avatar nombre={usuario?.nombre} correo={usuario?.correo} className="h-[30px] w-[30px] text-[11px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium leading-[1.2]">
                {usuario?.nombre || 'Mi cuenta'}
              </span>
              <span className="mt-0.5 block text-[11px] text-noct-neutral-400">Mi cuenta</span>
            </span>
            <CaretRight size={13} className="shrink-0 text-noct-neutral-400" aria-hidden />
          </Link>
        </div>
      </aside>

      {/* Columna de contenido con ancho progresivo (tarea 84): antes
          saltaba de 448px directo a 816px en 1024px, así que las tablets
          recibían la interfaz de teléfono. Ahora crece por tramos
          (móvil 448 -> tablet -> laptop -> monitor) para aprovechar el
          espacio sin perder la lectura cómoda. Las pantallas dentro
          reflujan a varias columnas con container queries. */}
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col sm:max-w-xl md:max-w-3xl lg:max-w-[1040px] 2xl:max-w-[1240px]">
          {children}
        </div>
      </div>

      {/* Pestañas inferiores: solo móvil. Siempre 5 columnas, siempre las
          mismas 5 (R17). Rótulo a 12px en celdas de 52 (antes 10.5px en
          44: "por debajo de cualquier mínimo razonable" para navegación
          que se usa con guantes y a pleno sol). Estado en tres canales
          (R16 pide al menos dos): barra de 2px sobre la pestaña activa,
          icono relleno y color de acento; más presionado (fondo de acento
          al 10%) y foco de teclado (anillo de 2px), que antes no existían. */}
      <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-noct-divider bg-noct-bg/[.88] pb-[env(safe-area-inset-bottom)] backdrop-blur-[12px] sm:max-w-xl md:max-w-3xl lg:hidden">
        {destinosMobile.map(({ to, label, icono: Icono, iconoActivo: IconoActivo, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex min-h-[52px] flex-col items-center gap-1 pb-[10px] pt-[9px] text-[12px] font-medium outline-none active:bg-noct-accent/10 focus-visible:outline-2 focus-visible:outline-noct-accent focus-visible:-outline-offset-2 ${
                isActive ? 'text-noct-accent-300' : 'text-noct-neutral-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute left-1/2 top-0 h-[2px] w-[26px] -translate-x-1/2 rounded-b-[2px] bg-noct-accent"
                    aria-hidden
                  />
                )}
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

// Enlace de los grupos "Herramientas" y "Registros" del sidebar de
// escritorio (tarea 183): un solo icono (sin variante rellena, para no
// sumar más colisiones a las que ya tiene el set hoy, ver R24) que
// recolorea a acento cuando está activo.
function EnlaceGrupo({
  to,
  label,
  Icono,
}: {
  to: string
  label: string
  Icono: (props: IconoProps) => React.JSX.Element
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] ${
          isActive
            ? 'font-medium text-noct-accent-300'
            : 'font-normal text-noct-neutral-300 hover:bg-noct-text/[.05]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icono size={17} className={isActive ? 'text-noct-accent' : 'text-noct-neutral-400'} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  )
}

// Marca de la app (cerebro): glifo del handoff de Soluciones, usado
// solo aquí como logotipo del sidebar; no forma parte del set de iconos
// de dominio. La regla R12 retiró el nombre "IT Brain" de la interfaz
// (tarea 180) pero conserva este glifo como marca.
function Marca(props: React.SVGProps<SVGSVGElement>) {
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
