import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../features/autenticacion/authContext'
import { usePerfilVivo } from '../features/autenticacion/usePerfilVivo'
import { usePendientes } from '../features/inicio/usePendientes'
import { useReanudar } from '../features/soluciones/useReanudar'
import { Avatar } from '../components/Avatar'
import { AvisoPestana } from '../components/AvisoPestana'
import { BarraReanudar } from '../components/BarraReanudar'
import { BarraSuperior } from '../components/BarraSuperior'
import { BarraTarea } from '../components/BarraTarea'
import { BotonVolver } from '../components/BotonVolver'
import { Marca } from '../components/Marca'
import { direccionPara } from './direccionTransicion'
import { destinoDePestana, useMemoriaPestana } from './memoriaPestana'
import { useMemoriaScroll } from './memoriaScroll'
import { RAICES_DE_PESTANA } from '../lib/navegacion'
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

// Chasis único de la app (tarea 185, mockup 4c del handoff "Auditoría de
// Soluciones TI"). Nace del ShellNocturne (handoff "Herramienta IT para
// técnicos", 2026-07-16), que aportaba sidebar y pestañas a 13 pantallas
// mientras las otras 25 montaban su propio contenedor `max-w-md`: el
// chasis se encendía y se apagaba sin avisar, y una lista que se recorre
// durante minutos (Personas, Ubicaciones, Diagnósticos) quedaba como una
// isla con una sola salida.
//
// Tres niveles y ni uno más (regla R18). Cada pantalla declara el suyo:
//
//   seccion   raíz de una pila. Barra superior con las tres ranuras
//             globales (título, estado del dato, buscar) y pestañas.
//   documento algo que se lee o se recorre dentro de una sección.
//             Regreso, acciones propias y pestañas: sigue siendo
//             navegación, así que la barra se queda (R19).
//   tarea     algo que se está haciendo y de lo que se sale: editor,
//             asistente, escáner, importador. Es el ÚNICO nivel que
//             puede quedarse sin pestañas, y a cambio pone una
//             `BarraTarea` que dice qué haces y cómo sales (R19).
//
// El chasis reserva su propio espacio inferior (R22): antes, once
// pantallas escribían `pb-[116px]` a mano para una barra que mide 53,
// así que cualquier cambio en la barra obligaba a tocar once archivos.

export type ModoChasis = 'seccion' | 'documento' | 'tarea'

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

// Alto real de la barra de pestañas, MEDIDO en el navegador: 63.6px de
// celda (el `min-h-[52px]` se queda corto frente a su contenido real,
// icono de 22 + rótulo de 12 + 19 de relleno) más 1px de borde, más el
// área segura del teléfono. El chasis lo reserva por todos, para que
// ninguna pantalla vuelva a calcularlo a mano (R22).
//
// La auditoría del handoff hablaba de "una barra que mide 53": ese dato
// es anterior a la tarea 182, que subió las celdas a 52px de mínimo y el
// rótulo a 12px. Reservar 53 dejaba 12px de contenido bajo la barra.
const ALTO_PESTANAS = 'pb-[calc(65px+env(safe-area-inset-bottom))] md:pb-0'

// Los cuatro puntos de quiebre del chasis (tarea 191, turno 5, regla
// R30: ningún ancho intermedio queda huérfano). Cada uno entrega una
// composición completa, y son solo cuatro:
//
//   <768   teléfono: columna de 448 y pestañas abajo.
//   768    (`md`) rail de iconos de 64 px + una columna de trabajo. Es el
//          hueco que se cierra aquí: antes la sidebar no llegaba hasta
//          1024, así que el contenido ya medía 768 mientras la barra de
//          pestañas seguía anclada a 448 centrados, una isla flotante en
//          cualquier iPad en horizontal o ventana a media pantalla.
//   1280   (`xl`) sidebar completa de 240 px.
//   1680   (`3xl`) presupuesto de las tres zonas: sidebar de 232 px y
//          1.294 de contenido (322 de lista + 720 de documento + 252 de
//          contexto). Las tres zonas propiamente dichas las reparte la
//          tarea 199; aquí se reserva su ancho.
//
// Antes los puntos eran 640/768/1024/1536 y solo el de 1024 cambiaba algo
// estructural: `sm` y `2xl` movían el ancho máximo sin recomponer nada.
//
// El tope de la columna crece y nunca se estrecha. La primera versión de
// esta tarea dejaba la banda de tableta sin tope (`md:max-w-none`) y el
// tope de 1040 aparecía en `xl`: medido en el navegador, a 1279 px la
// columna daba 1200 y a 1280 caía a 1040, es decir, el contenido se
// estrechaba al ensanchar la ventana. Con el tope puesto ya en `md` los
// tres tramos de escritorio son monótonos: hasta 1040 y, desde 1680,
// hasta 1294 (322 de lista + 720 de documento + 252 de contexto).
const ANCHO_CONTENIDO = 'max-w-md md:max-w-[1040px] 3xl:max-w-[1294px]'

interface PropsComunes {
  children: ReactNode
}

interface PropsSeccion extends PropsComunes {
  modo?: 'seccion'
  /** Nombre de la sección: ranura 1 de la barra superior (R14). */
  titulo: string
  /**
   * Banda de controles propios de la pantalla ("Crear", buscador,
   * chips), justo debajo de la fila superior y dentro del mismo bloque
   * pegajoso (AD-023: no suben a la fila del título).
   */
  barra?: ReactNode
}

interface PropsDocumento extends PropsComunes {
  modo: 'documento'
  /** Override del destino de regreso (cuando depende de datos en runtime). */
  volverA?: string
  /** Override de la etiqueta del regreso. */
  volverEtiqueta?: string
  /** Acciones propias de la pantalla, a la derecha de la fila de regreso. */
  acciones?: ReactNode
  /** Banda bajo la fila de regreso: título, buscador, pestañas internas. */
  barra?: ReactNode
}

interface PropsTarea extends PropsComunes {
  modo: 'tarea'
  /** Qué se está haciendo: "Editando", "Creando", "Ejecutando"... */
  rotulo: string
  /** Sobre qué. */
  titulo: string
  /** Ruta de vuelta escrita ("Guías › Impresoras"). */
  vuelta?: string
  /** Override del destino de la X. */
  salidaA?: string
  /** Texto accesible de la X. */
  salidaEtiqueta?: string
  /** Reemplaza la navegación de la X (confirmar antes de descartar). */
  alSalir?: () => void
  /** Banda bajo la barra de tarea: pestañas del editor, progreso. */
  barra?: ReactNode
}

type Props = PropsSeccion | PropsDocumento | PropsTarea

export function Chasis(props: Props) {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const usuario = perfilVivo ?? perfil
  // Tarea 186: el mismo dato alimenta la barra flotante de aqui abajo y
  // el punto de la pestaña Guías (nunca los dos a la vez: mientras se
  // ve la barra no hace falta el punto, y viceversa).
  const reanudar = useReanudar()
  // Tarea 187: cuenta real de pendientes para el número de "Más" (R23,
  // ningún aviso decorativo); dirección de la transición de entrada
  // (R21); y memoria de scroll y de filtros por pestaña (R20), todos
  // calculados aquí porque Chasis es el único envoltorio de TODAS las
  // pantallas.
  const pendientes = usePendientes()
  const location = useLocation()
  const direccion = direccionPara(location)
  useMemoriaScroll(location.pathname)
  useMemoriaPestana(location.pathname, location.search)

  // Tocar la pestaña ya activa sube al principio de la lista (mockup
  // `4e`), en vez de no hacer nada (navegar a la ruta en la que ya
  // estás es un no-op para el router). Solo cuando se está EXACTAMENTE
  // en la raíz pelada: desde una ficha interna, o con un filtro puesto,
  // el enlace lleva a la raíz y ahí sí hay navegación que hacer.
  function alTocarPestana(raiz: string) {
    if (location.pathname !== raiz || location.search !== '') return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reducido ? 'auto' : 'smooth' })
  }

  // Nivel 3: tarea con salida. Sin pestañas y sin sidebar (la tarea
  // ocupa la pantalla entera, como hasta ahora), con la BarraTarea
  // orientando en su lugar. Los cuatro puntos de quiebre de la tarea 191
  // NO llegan aquí a propósito: darle ancho propio a los editores es la
  // tarea 199, que decide cómo se reparte (rail de secciones, formulario
  // de 640 px y vista previa viva) en vez de solo estirar la columna.
  if (props.modo === 'tarea') {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
        <div className="mx-auto flex min-h-svh w-full max-w-md flex-col" data-transicion={direccion}>
          <BarraTarea
            rotulo={props.rotulo}
            titulo={props.titulo}
            vuelta={props.vuelta}
            salidaA={props.salidaA}
            salidaEtiqueta={props.salidaEtiqueta}
            alSalir={props.alSalir}
          >
            {props.barra}
          </BarraTarea>
          {props.children}
        </div>
      </div>
    )
  }

  // Niveles 1 y 2: los dos conservan las pestañas (R19, la barra solo
  // cede ante una tarea con salida). Solo cambia la fila superior.
  const cabecera =
    props.modo === 'documento' ? (
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        {/* Una sola gramática para la fila superior: el regreso siempre a
            la izquierda y las acciones siempre a la derecha, en el mismo
            eje que la fila de las raíces. Antes cada pantalla elegía su
            propio relleno (`px-2`, `pl-2 pr-3`, `px-4`) y los controles
            no caían nunca en el mismo sitio al bajar un nivel. */}
        <div className="flex min-h-[44px] items-center justify-between gap-2 pl-2 pr-3 pt-2.5">
          <BotonVolver to={props.volverA}>{props.volverEtiqueta}</BotonVolver>
          {props.acciones && <div className="flex shrink-0 items-center gap-1.5">{props.acciones}</div>}
        </div>
        {props.barra}
      </div>
    ) : (
      <BarraSuperior titulo={props.titulo}>{props.barra}</BarraSuperior>
    )

  // Escritorio: los cinco módulos, Bóveda condicional al permiso. Los
  // grupos "Herramientas" y "Registros" se dibujan aparte, debajo de
  // este nav (tarea 183).
  const destinosDesktop = usuario?.puedeVerBoveda ? [...DESTINOS_BASE, DESTINO_BOVEDA] : DESTINOS_BASE
  // Móvil: siempre las mismas cinco, para todos (regla R17). Antes la
  // barra cambiaba de 4 a 5 columnas según el permiso de Bóveda, así
  // que dos técnicos con el mismo teléfono veían barras distintas.
  const destinosMobile = [...DESTINOS_BASE, DESTINO_MAS]

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text md:flex">
      {/* Sidebar de escritorio. Catorce destinos desde la tarea 183
          (mockup 3e): los cinco módulos, "Herramientas" y "Registros"
          (los ocho que hasta la 182 solo tenían puerta en "Más", que no
          existe fuera de móvil), y el perfil al pie.

          Dos formas desde la tarea 191 (turno 5): **rail de iconos** de
          64 px entre 768 y 1279, y **completa** de 240 px desde 1280
          (232 desde 1680, ver ANCHO_CONTENIDO). El rail estrecho es lo
          que cierra el hueco de tableta: antes la sidebar no aparecía
          hasta 1024 y en medio no había navegación de escritorio ni
          barra de pestañas al ancho, solo una isla de 448 px.

          En el rail, cada destino conserva su `title` porque el rótulo
          no se lee; los dos grupos pierden su encabezado (un título de
          sección no cabe ni se entiende en 64 px) pero mantienen el
          separador, que es lo que agrupa. */}
      <aside className="sticky top-0 hidden h-svh w-16 shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-noct-divider bg-noct-surface px-2 py-5 md:flex xl:w-60 xl:px-3 3xl:w-[232px]">
        <div className="flex items-center justify-center gap-2 xl:justify-start xl:px-2">
          <Marca className="h-[22px] w-[22px] shrink-0 text-noct-accent" />
          <span className="hidden text-[15px] font-semibold xl:inline">Soluciones IT</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {destinosDesktop.map(({ to, label, icono: Icono, iconoActivo: IconoActivo, end }) => (
            <NavLink
              key={to}
              to={destinoDePestana(to, location.pathname, RAICES_DE_PESTANA)}
              end={end}
              onClick={() => alTocarPestana(to)}
              title={label}
              className={({ isActive }) =>
                `flex min-h-11 items-center justify-center gap-2.5 rounded-md text-sm outline-none focus-visible:outline-2 focus-visible:outline-noct-accent xl:justify-start xl:px-2.5 xl:py-[9px] ${
                  isActive
                    ? 'bg-noct-accent/[.12] font-semibold text-noct-accent'
                    : 'font-medium text-noct-neutral-400 hover:bg-noct-text/[.05]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? <IconoActivo size={18} /> : <Icono size={18} />}
                  <span className="hidden xl:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-noct-divider pt-2.5 xl:border-t-0 xl:pt-0">
          <TituloSeccion className="mb-1.5 hidden px-2.5 xl:block">Herramientas</TituloSeccion>
          <nav className="flex flex-col gap-0.5">
            <EnlaceGrupo to="/diagnostico" label="Diagnóstico" Icono={TreeStructure} />
            <EnlaceGrupo to="/escaner" label="Escanear" Icono={QrCode} />
          </nav>
        </div>

        <div className="border-t border-noct-divider pt-2.5 xl:border-t-0 xl:pt-0">
          <TituloSeccion className="mb-1.5 hidden px-2.5 xl:block">Registros</TituloSeccion>
          <nav className="flex flex-col gap-0.5">
            <EnlaceGrupo to="/ubicaciones" label="Ubicaciones" Icono={MapPin} />
            <EnlaceGrupo to="/personas" label="Personas" Icono={UsersThree} />
          </nav>
        </div>

        {/* El procedimiento a medias vive aquí en escritorio (tarea 191),
            encima de la cuenta, en vez de flotar sobre el contenido. */}
        {reanudar.actual && !reanudar.descartado && (
          <div className="mt-auto">
            <BarraReanudar
              variante="sidebar"
              articulo={reanudar.actual.articulo}
              hechos={reanudar.actual.hechos}
              total={reanudar.actual.total}
              minutosRestantes={reanudar.actual.minutosRestantes}
              onDescartar={reanudar.descartar}
            />
          </div>
        )}

        <div
          className={`border-t border-noct-divider pt-2.5 ${
            reanudar.actual && !reanudar.descartado ? '' : 'mt-auto'
          }`}
        >
          <Link
            to="/cuenta"
            title={usuario?.nombre || 'Mi cuenta'}
            className="flex items-center justify-center gap-2.5 rounded-md p-1.5 hover:bg-noct-text/[.05] xl:justify-start"
          >
            <Avatar nombre={usuario?.nombre} correo={usuario?.correo} className="h-[30px] w-[30px] shrink-0 text-[11px]" />
            <span className="hidden min-w-0 flex-1 xl:block">
              <span className="block truncate text-[12.5px] font-medium leading-[1.2]">
                {usuario?.nombre || 'Mi cuenta'}
              </span>
              <span className="mt-0.5 block text-[11px] text-noct-neutral-400">Mi cuenta</span>
            </span>
            <CaretRight size={13} className="hidden shrink-0 text-noct-neutral-400 xl:block" aria-hidden />
          </Link>
        </div>
      </aside>

      {/* Columna de contenido con ancho progresivo (tarea 84): antes
          saltaba de 448px directo a 816px en 1024px, así que las tablets
          recibían la interfaz de teléfono. Ahora crece por tramos
          (móvil 448 -> tablet -> laptop -> monitor) para aprovechar el
          espacio sin perder la lectura cómoda. Las pantallas dentro
          reflujan a varias columnas con container queries. El relleno
          inferior lo pone el chasis, no cada pantalla (R22). */}
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <div
          data-transicion={direccion}
          className={`mx-auto flex w-full flex-1 flex-col ${ANCHO_CONTENIDO} ${ALTO_PESTANAS}`}
        >
          {cabecera}
          {props.children}
        </div>
      </div>

      {reanudar.actual && !reanudar.descartado && (
        <BarraReanudar
          articulo={reanudar.actual.articulo}
          hechos={reanudar.actual.hechos}
          total={reanudar.actual.total}
          minutosRestantes={reanudar.actual.minutosRestantes}
          onDescartar={reanudar.descartar}
        />
      )}

      {/* Pestañas inferiores: solo móvil. Siempre 5 columnas, siempre las
          mismas 5 (R17). Rótulo a 12px en celdas de 52 (antes 10.5px en
          44: "por debajo de cualquier mínimo razonable" para navegación
          que se usa con guantes y a pleno sol). Estado en tres canales
          (R16 pide al menos dos): barra de 2px sobre la pestaña activa,
          icono relleno y color de acento; más presionado (fondo de acento
          al 10%) y foco de teclado (anillo de 2px), que antes no existían. */}
      <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-noct-divider bg-noct-bg/[.88] pb-[env(safe-area-inset-bottom)] backdrop-blur-[12px] md:hidden">
        {destinosMobile.map(({ to, label, icono: Icono, iconoActivo: IconoActivo, end }) => {
          // Puntos y números de la pestaña (R23: un aviso solo si hay un
          // dato detrás, nunca decorativo). Guías (tarea 186): mientras
          // la BarraReanudar esté descartada para el procedimiento a
          // medias vigente, la pestaña recuerda que sigue ahí. Más
          // (tarea 187): el conteo real de `usePendientes`.
          const conPunto = to === '/soluciones' && Boolean(reanudar.actual) && reanudar.descartado
          const numeroPendientes = to === '/mas' ? pendientes.length : 0
          return (
            <NavLink
              key={to}
              to={destinoDePestana(to, location.pathname, RAICES_DE_PESTANA)}
              end={end}
              onClick={() => alTocarPestana(to)}
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
                  <span className="relative">
                    {isActive ? <IconoActivo size={22} /> : <Icono size={22} />}
                    {conPunto && <AvisoPestana variante="punto" />}
                    {numeroPendientes > 0 && <AvisoPestana variante="numero" valor={numeroPendientes} />}
                  </span>
                  {label}
                  {conPunto && <span className="sr-only"> (hay un procedimiento a medias)</span>}
                  {numeroPendientes > 0 && (
                    <span className="sr-only"> ({numeroPendientes} pendientes)</span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
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
      title={label}
      className={({ isActive }) =>
        `flex min-h-11 items-center justify-center gap-2.5 rounded-md text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-noct-accent xl:min-h-0 xl:justify-start xl:px-2.5 xl:py-[7px] ${
          isActive
            ? 'font-medium text-noct-accent-300'
            : 'font-normal text-noct-neutral-300 hover:bg-noct-text/[.05]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icono size={17} className={isActive ? 'text-noct-accent' : 'text-noct-neutral-400'} aria-hidden />
          <span className="hidden xl:inline">{label}</span>
        </>
      )}
    </NavLink>
  )
}
