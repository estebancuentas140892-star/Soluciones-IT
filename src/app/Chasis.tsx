import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../features/autenticacion/authContext'
import { usePerfilVivo } from '../features/autenticacion/usePerfilVivo'
import { agruparAgenda, asuntosUrgentes } from '../features/inicio/agenda'
import { usePendientes } from '../features/inicio/usePendientes'
import { Avatar } from '../components/Avatar'
import { AvisoPestana } from '../components/AvisoPestana'
import { BarraSuperior } from '../components/BarraSuperior'
import { BarraTarea } from '../components/BarraTarea'
import { BotonVolver } from '../components/BotonVolver'
import { Marca } from '../components/Marca'
import { CapaAtajos } from './CapaAtajos'
import { ProveedorBandaTarea } from './bandaTarea'
import { direccionPara } from './direccionTransicion'
import { useOrigen } from './useOrigen'
import { destinoDePestana, useMemoriaPestana } from './memoriaPestana'
import { useMemoriaScroll } from './memoriaScroll'
import { destinoPrincipalDe, padreDe, RAICES_DE_PESTANA, type DestinoPrincipal } from '../lib/navegacion'
import { estadoDeRegreso } from '../lib/origenNavegacion'
import {
  CaretRight,
  DotsNine,
  Monitor,
  MonitorFill,
  Vault,
  VaultFill,
  Wrench,
  WrenchFill,
  type IconoProps,
} from '../components/iconos'

const BuscadorGlobal = lazy(() =>
  import('../features/busqueda/BuscadorGlobal').then((m) => ({ default: m.BuscadorGlobal })),
)

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
  to: DestinoPrincipal
  label: string
  icono: (props: IconoProps) => React.JSX.Element
  iconoActivo: (props: IconoProps) => React.JSX.Element
}

// CUATRO DESTINOS, LOS MISMOS EN TODOS LOS TAMAÑOS (encargo del
// 2026-09-22, sección 2). La acción principal de Soluciones IT es buscar,
// encontrar, ejecutar y solucionar, y la navegación la sirve con cuatro
// puertas:
//
//   Resolver  el buscador y los procedimientos (absorbe Inicio y Guías:
//             el catálogo cuelga de aquí).
//   Equipos   qué se sabe de un dispositivo; el QR es otra forma de buscar.
//   Bóveda    las claves.
//   Más       consulta, infraestructura (Red, Topología), herramientas y
//             cuenta.
//
// Antes eran Inicio, Guías y Más en el teléfono, y en escritorio Inicio y
// Guías más dos grupos con nueve destinos que repetían Más. Resolver y
// Guías eran dos puertas para lo mismo, y Equipos y la Bóveda, que se usan
// a diario frente al puesto de trabajo, estaban a dos toques.
//
// La Bóveda es pestaña para todos (regla R17: la barra no cambia según el
// permiso); sin permiso abre la pantalla de acceso restringido. Más no
// tiene variante rellena: el mockup usa el mismo glifo activo e inactivo.
const DESTINOS: Destino[] = [
  { to: '/', label: 'Resolver', icono: Wrench, iconoActivo: WrenchFill },
  { to: '/dispositivos', label: 'Equipos', icono: Monitor, iconoActivo: MonitorFill },
  { to: '/boveda', label: 'Bóveda', icono: Vault, iconoActivo: VaultFill },
  { to: '/mas', label: 'Más', icono: DotsNine, iconoActivo: DotsNine },
]

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
  /**
   * Lupa de la barra superior. Se apaga en la pantalla que ya trae su
   * propio buscador en línea (Inicio), para no dejar dos buscadores en
   * la misma pantalla (regla M-R8, tarea 203).
   */
  conLupa?: boolean
}

interface PropsDocumento extends PropsComunes {
  modo: 'documento'
  /** Override del destino de regreso (cuando depende de datos en runtime). */
  volverA?: string
  /** Override de la etiqueta del regreso. */
  volverEtiqueta?: string
  /**
   * Nombre de lo que se está viendo (M-R1, ancla permanente): se queda
   * en pantalla al desplazarse, a 14 px, junto al regreso. Sin él la
   * fila superior vuelve al `BotonVolver` con etiqueta de antes, que es
   * lo correcto en las pantallas de documento que son listas y ya
   * escriben su nombre en la banda de abajo.
   */
  titulo?: string
  /** De dónde viene ("Equipos · Rack 1"), a 11 px sobre el título. */
  contexto?: string
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
  /**
   * Cabecera de una sola línea de 44 px, sin rótulo ni ruta de vuelta
   * (tarea 218, hallazgos G-09 y G-10): el título comparte fila con la
   * X y con lo que se porte a la ranura (`barra` o `BandaTarea`). Pensada
   * para la ejecución de una guía, donde el técnico ya sabe qué está
   * haciendo y a dónde vuelve porque lo decidió hace cuatro segundos.
   */
  compacta?: boolean
  /**
   * Contenido al final de esa línea de 44 px, junto al título (solo con
   * `compacta`). Lo que cambia con el trabajo y tiene que estar siempre
   * a la vista: el estado del borrador en el editor (tarea 219). La
   * ranura de `BandaTarea` se monta aquí también, para que el contador
   * de paso de la ejecución quede en la misma fila (tarea 218).
   */
  trailing?: ReactNode
  /**
   * Lupa en la cabecera compacta, que abre el buscador global COMO CAPA
   * encima de la tarea (tarea 241, secciones 8 a 10 del encargo).
   *
   * No reabre la navegacion principal: la capa se cierra y la tarea
   * sigue exactamente donde estaba, con su paso activo, su progreso y su
   * cronometro intactos (la pantalla no se desmonta). Es lo que permite
   * consultar un comando, una herramienta o una credencial a mitad de un
   * procedimiento sin abandonarlo.
   *
   * Desde el 2026-09-16 la capa se abre en MODO CONSULTA: antes era el
   * buscador normal, y tocar un resultado (o "Empezar" otra guia) sacaba
   * al tecnico de la ejecucion. Ver `modoConsulta.ts`.
   */
  conBusqueda?: boolean
}

type Props = PropsSeccion | PropsDocumento | PropsTarea

export function Chasis(props: Props) {
  const { perfil } = useAuth()
  const perfilVivo = usePerfilVivo()
  const usuario = perfilVivo ?? perfil
  // AQUÍ VIVÍAN LA BARRA FLOTANTE "SEGUIR" Y EL PUNTO DE LA PESTAÑA
  // GUÍAS (tarea 186). Se retiran el 2026-09-09 por el hallazgo H01 del
  // informe del 8 de septiembre.
  //
  // Los dos salían del mismo dato que el bloque "Sin terminar": un
  // procedimiento con avance a medias. Retirar solo el bloque de la
  // lista habría dejado la misma obligación en otras dos formas, que es
  // justo lo que el encargo prohíbe ("no sustituirlo por otra lista de
  // pendientes con el mismo efecto", "sin generar una lista global de
  // pendientes"). El punto sobre la pestaña era además el caso más
  // claro: marcaba la SECCIÓN entera como si tuviera algo pendiente
  // porque el técnico había dejado una guía a medias.
  //
  // Nada de esto borra avance: `progresoPasos` no se toca. Retomar
  // sigue estando donde tiene sentido, dentro de la guía ("Seguir en el
  // paso N de M" y "Empezar de nuevo" en su ficha) y en el bloque de
  // Inicio, que es la pantalla cuyo trabajo es decir por dónde iba uno.
  // Tarea 187: cuenta real de pendientes para el número de la pestaña (R23,
  // ningún aviso decorativo); dirección de la transición de entrada
  // (R21); y memoria de scroll y de filtros por pestaña (R20), todos
  // calculados aquí porque Chasis es el único envoltorio de TODAS las
  // pantallas.
  const { items: pendientes } = usePendientes()
  // EL AVISO SOLO CUENTA LO QUE URGE HOY (encargo del 2026-09-11, tarea
  // 4). Contaba TODOS los pendientes: borradores propios, sugerencias
  // del equipo y claves que vencen dentro de tres semanas. Un número que
  // nunca baja no avisa de nada y enseña a ignorarlo. Ahora son los
  // vencidos y los de fecha de hoy, NUNCA los próximos, los borradores
  // ni lo que está en curso: si está en cero, no hay número.
  const urgentes = asuntosUrgentes(agruparAgenda(pendientes))
  // Hueco de la banda pegajosa del nivel tarea. Se guarda en estado (no
  // en una ref) a propósito: así, cuando el div se monta, los hijos
  // vuelven a renderizar y el portal encuentra su destino. Con una ref
  // el primer render llegaría con `null` y la banda no aparecería hasta
  // el siguiente cambio de estado del asistente.
  const [ranuraTarea, setRanuraTarea] = useState<HTMLDivElement | null>(null)
  // Buscador en capa sobre una tarea (tarea 241). Vive aqui y no dentro
  // de la pantalla porque la cabecera que lo invoca tambien es del
  // chasis; la capa se monta en un portal a <body>, asi que abrirla no
  // vuelve a montar nada de la tarea que hay debajo.
  const [buscadorTarea, setBuscadorTarea] = useState(false)
  // De dónde vino el técnico cuando no vino de la lista padre (tarea
  // 202, regla M-R2). Se resuelve aquí, en el chasis, y no en cada
  // pantalla: así el regreso de las 44 rutas deshace el último salto sin
  // que ninguna lo cablee, igual que ya pasa con `padreDe`.
  const origen = useOrigen()
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
            // El origen manda sobre la vuelta derivada, pero no sobre la
            // que la pantalla escribe a mano: cuando una tarea sabe
            // nombrar su vuelta ("Guías › Impresoras"), sabe más que el
            // chasis.
            vuelta={props.vuelta ?? origen?.etiqueta}
            salidaA={props.salidaA ?? origen?.to}
            // Si la X vuelve al origen y el salto salió de un buscador,
            // la búsqueda vuelve con ella (encargo del 2026-09-16, sección 13).
            salidaEstado={props.salidaA ? undefined : estadoDeRegreso(origen)}
            salidaEtiqueta={props.salidaEtiqueta}
            alSalir={props.alSalir}
            compacta={props.compacta}
            onBuscar={props.compacta && props.conBusqueda ? () => setBuscadorTarea(true) : undefined}
            // La ranura de `BandaTarea` cambia de sitio según la altura
            // de la cabecera: en la compacta va en la MISMA línea que el
            // título (ahí es donde el contador de paso de la ejecución
            // tiene que estar, tarea 218); en la normal, como bloque
            // debajo, que es donde nació. `compacta` no cambia en
            // caliente para una pantalla dada, así que la ranura no se
            // remonta por esto.
            trailing={
              props.compacta ? (
                <>
                  {props.trailing}
                  <div ref={setRanuraTarea} className="contents" />
                </>
              ) : undefined
            }
          >
            {props.barra}
            {/* Ranura para la banda pegajosa de quien tenga el dato del
                momento (el paso actual del asistente): ver
                src/app/bandaTarea.tsx. */}
            {!props.compacta && <div ref={setRanuraTarea} />}
          </BarraTarea>
          <ProveedorBandaTarea value={ranuraTarea}>{props.children}</ProveedorBandaTarea>
        </div>
        {/* MODO CONSULTA (encargo del 2026-09-16, secciones 8 a 11): sobre
            una tarea nada de la capa navega. Las fichas se consultan en su
            vista rápida, la Bóveda se desbloquea y se copia ahí mismo, y
            ninguna acción abre otra ejecución. Cerrarla deja la tarea
            intacta: paso, progreso, avisos y cronómetro. */}
        {buscadorTarea && (
          <Suspense fallback={null}>
            <BuscadorGlobal abierto modo="consulta" onCerrar={() => setBuscadorTarea(false)} />
          </Suspense>
        )}
        {/* Los atajos de teclado también aquí, pero SIN los de navegar:
            saltar a otra sección desde un editor o una ejecución sacaría
            al técnico de un trabajo a medias sin pasar por su
            confirmación de salida. Buscar y pedir ayuda sí siguen, y la
            búsqueda que abre "/" es también de consulta. */}
        <CapaAtajos puedeVerBoveda={Boolean(usuario?.puedeVerBoveda)} navegacion={false} />
      </div>
    )
  }

  // El regreso del nivel documento, con el origen por delante del padre
  // declarado (tarea 202, regla M-R2). El orden importa y es este:
  //
  //   1. el origen, si lo hay: es el último salto real;
  //   2. el override de la pantalla, para lo que depende de datos en
  //      runtime (un equipo de red vuelve a Red);
  //   3. `padreDe`, dentro de `BotonVolver`, que siempre existe.
  //
  // El origen va PRIMERO y no último a propósito: el override de la
  // pantalla es una regla general ("los equipos de red vuelven a Red") y
  // el origen es el hecho concreto de este recorrido ("vengo del
  // escáner"). Cuando los dos hablan, gana el hecho.
  //
  // Y el contexto de 11 px pasa a nombrar de dónde se viene, que es
  // exactamente lo que el mockup `6b` pide para Ubicaciones y Personas:
  // "nada dice desde qué equipo llegaste".
  const volverA = props.modo === 'documento' ? (origen?.to ?? props.volverA) : undefined
  const volverEtiqueta = props.modo === 'documento' ? (origen?.etiqueta ?? props.volverEtiqueta) : undefined
  const contexto = props.modo === 'documento' ? (origen?.etiqueta ?? props.contexto) : undefined

  // El regreso de una sección que no es raíz de pestaña (ver arriba).
  const padreSeccion = props.modo === 'documento' ? null : padreDe(location.pathname)
  const volverDeSeccion = padreSeccion
    ? {
        to: origen?.to ?? padreSeccion.to,
        etiqueta: origen?.etiqueta ?? padreSeccion.etiqueta,
        estado: estadoDeRegreso(origen),
      }
    : undefined

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
        {/* Ancla permanente del nivel documento (auditoría móvil del
            2026-08-03, hallazgo M-001, regla M-R1, mockup `1b`). Hasta
            ahora esta fila solo llevaba el regreso y los iconos: el
            nombre del equipo o del artículo era un `h1` dentro del
            scroll, así que en una ficha de tres o cuatro pantallas, tras
            el primer desplazamiento, nada decía QUÉ se estaba viendo. Lo
            único que orientaba era la pestaña iluminada, y esa dice
            "Equipos", no qué equipo.

            El cambio es una línea y ningún control nuevo: el regreso se
            reduce a su cuadrado de 44 px (la etiqueta la asume el
            contexto de arriba, que además nombra el destino real, R13) y
            al lado van el origen a 11 px y el nombre a 14 px. */}
        <div className="flex min-h-[44px] items-center justify-between gap-2 pl-2 pr-3 pt-2.5">
          {props.titulo ? (
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <BotonVolver to={volverA} soloIcono estado={estadoDeRegreso(origen)}>
                {volverEtiqueta}
              </BotonVolver>
              <h1 className="min-w-0 flex-1">
                {contexto && (
                  <span className="block truncate text-[11px] leading-[1.3] text-noct-neutral-500">
                    {contexto}
                  </span>
                )}
                <span className="block truncate text-[14px] font-medium leading-[1.25]">{props.titulo}</span>
              </h1>
            </div>
          ) : (
            <BotonVolver to={volverA} estado={estadoDeRegreso(origen)}>
              {volverEtiqueta}
            </BotonVolver>
          )}
          {props.acciones && <div className="flex shrink-0 items-center gap-1.5">{props.acciones}</div>}
        </div>
        {props.barra}
      </div>
    ) : (
      <BarraSuperior
        titulo={props.titulo}
        conLupa={props.conLupa ?? true}
        // Una sección que no es uno de los cuatro destinos (el catálogo de
        // guías, Red) lleva regreso en todos los tamaños: ya no tiene su
        // propia entrada en la barra. Mismo orden que el nivel documento:
        // el último salto real si lo hay (M-R2) y si no el padre declarado.
        volver={volverDeSeccion}
      >
        {props.barra}
      </BarraSuperior>
    )

  // Qué destino se ilumina: el que abre lo que se está viendo, aunque la
  // ruta no cuelgue de su enlace (una guía ilumina Resolver). Lo decide
  // `destinoPrincipalDe` para la barra del teléfono y la lateral por igual.
  const destinoActivo = destinoPrincipalDe(location.pathname)

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text md:flex">
      {/* Barra lateral de escritorio con los MISMOS cuatro destinos que la
          del teléfono (encargo del 2026-09-22). Dos formas desde la tarea
          191: rail de iconos de 64 px entre 768 y 1279, y completa de
          240 px desde 1280 (232 desde 1680, ver ANCHO_CONTENIDO). En el
          rail cada destino conserva su `title`, porque el rótulo no se
          lee.

          Hasta ahora llevaba además dos grupos, "Consulta" y "Trabajo
          técnico", con nueve destinos que repetían Más: dos puertas para
          lo mismo en la misma pantalla. Ahora Más es una sola puerta en
          todos los tamaños. */}
      <aside className="sticky top-0 hidden h-svh w-16 shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-noct-divider bg-noct-surface px-2 py-5 md:flex xl:w-60 xl:px-3 3xl:w-[232px]">
        <div className="flex items-center justify-center gap-2 xl:justify-start xl:px-2">
          <Marca className="h-[22px] w-[22px] shrink-0 text-noct-accent" />
          <span className="hidden text-[15px] font-semibold xl:inline">Soluciones IT</span>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Navegación principal">
          {DESTINOS.map(({ to, label, icono: Icono, iconoActivo: IconoActivo }) => {
            const activo = destinoActivo === to
            const numeroPendientes = to === '/' ? urgentes : 0
            return (
              <Link
                key={to}
                to={destinoDePestana(to, location.pathname, RAICES_DE_PESTANA)}
                onClick={() => alTocarPestana(to)}
                aria-current={activo ? 'page' : undefined}
                title={label}
                className={`flex min-h-11 items-center justify-center gap-2.5 rounded-md text-sm outline-none focus-visible:outline-2 focus-visible:outline-noct-accent xl:justify-start xl:px-2.5 xl:py-[9px] ${
                  activo
                    ? 'bg-noct-accent/[.12] font-semibold text-noct-accent'
                    : 'font-medium text-noct-neutral-400 hover:bg-noct-text/[.05]'
                }`}
              >
                <span className="relative">
                  {activo ? <IconoActivo size={18} /> : <Icono size={18} />}
                  {numeroPendientes > 0 && <AvisoPestana variante="numero" valor={numeroPendientes} />}
                </span>
                <span className="hidden xl:inline">{label}</span>
                {numeroPendientes > 0 && (
                  <span className="sr-only">
                    {' '}
                    ({numeroPendientes} {numeroPendientes === 1 ? 'asunto urgente' : 'asuntos urgentes'})
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-noct-divider pt-2.5">
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

      {/* Pestañas inferiores: solo móvil. Siempre las mismas cuatro (R17):
          Resolver, Equipos, Bóveda y Más (encargo del 2026-09-22). Rótulo
          a 12px en celdas de 52. Estado en tres canales (R16 pide al
          menos dos): barra de 2px sobre la pestaña activa, icono relleno
          y color de acento; más presionado y foco de teclado.

          La pestaña activa la decide `destinoPrincipalDe`, no la ruta del
          enlace: una guía ilumina Resolver y Red ilumina Más. */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t border-noct-divider bg-noct-bg/[.88] pb-[env(safe-area-inset-bottom)] backdrop-blur-[12px] md:hidden"
      >
        {DESTINOS.map(({ to, label, icono: Icono, iconoActivo: IconoActivo }) => {
          const activa = destinoActivo === to
          // Números de la pestaña (R23: un aviso solo si hay un dato
          // detrás, nunca decorativo). Resolver cuenta los asuntos
          // URGENTES de la agenda (vencidos y para hoy): es donde asoma su
          // bloque "Atención" (regla M-R9).
          const numeroPendientes = to === '/' ? urgentes : 0
          return (
            <Link
              key={to}
              to={destinoDePestana(to, location.pathname, RAICES_DE_PESTANA)}
              onClick={() => alTocarPestana(to)}
              aria-current={activa ? 'page' : undefined}
              className={`relative flex min-h-[52px] flex-col items-center gap-1 pb-[10px] pt-[9px] text-[12px] font-medium outline-none active:bg-noct-accent/10 focus-visible:outline-2 focus-visible:outline-noct-accent focus-visible:-outline-offset-2 ${
                activa ? 'text-noct-accent-300' : 'text-noct-neutral-300'
              }`}
            >
              {activa && (
                <span
                  className="absolute left-1/2 top-0 h-[2px] w-[26px] -translate-x-1/2 rounded-b-[2px] bg-noct-accent"
                  aria-hidden
                />
              )}
              <span className="relative">
                {activa ? <IconoActivo size={22} /> : <Icono size={22} />}
                {numeroPendientes > 0 && <AvisoPestana variante="numero" valor={numeroPendientes} />}
              </span>
              {label}
              {numeroPendientes > 0 && (
                <span className="sr-only">
                  {' '}
                  ({numeroPendientes} {numeroPendientes === 1 ? 'asunto urgente' : 'asuntos urgentes'})
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Atajos de teclado (encargo del 2026-09-10, tarea 6). No dibuja
          ningún control: son una mejora para quien tiene teclado, y
          sumar un botón a la barra de un teléfono sería pagar espacio
          por algo que ahí no se puede usar. La entrada visible vive en
          el Centro de consulta, pestaña Atajos. */}
      <CapaAtajos puedeVerBoveda={Boolean(usuario?.puedeVerBoveda)} navegacion />
    </div>
  )
}
