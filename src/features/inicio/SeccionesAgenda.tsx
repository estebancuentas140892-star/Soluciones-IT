import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretDown,
  CaretRight,
  Check,
  type IconoProps,
  Lightbulb,
  ListChecks,
  LockSimple,
  Monitor,
  PencilSimple,
  Storefront,
  User,
  Wrench,
} from '../../components/iconos'
import { FILAS_EN_TARJETA, RELIEVE_EN_TELEFONO, TITULO_GRUPO_EN_TELEFONO } from '../../components/ventana/estilos'
import { marcarTareaHecha, useHojaTarea } from './contextoHojaTarea'
import type { ItemPendiente } from './pendientes'
import {
  accionDeItem,
  asuntosUrgentes,
  ETIQUETA_ESTADO,
  textoVerOtros,
  type Agenda,
  type EstadoAgenda,
} from './agenda'

// LOS GRUPOS DE LA AGENDA, UNA SOLA VEZ (encargo del 2026-09-20, tareas 1
// y 3).
//
// La agenda operativa se pinta en DOS sitios: el resumen de Inicio y la
// pantalla completa (`AgendaPage`). Antes cada uno tenía sus propias
// filas, cabeceras y desplegables; mantener dos copias de lo mismo es
// cómo empiezan a divergir ("Próximos" de tres en una pantalla y de dos
// en la otra, un estado nuevo que solo entra en una). Aquí vive el
// dibujo, una vez; las reglas siguen en `agenda.ts` y `pendientes.ts`,
// que no saben de pantallas.
//
// Las dos pantallas pasan LA MISMA agenda (`agruparAgenda(usePendientes())`)
// y solo eligen si quieren el enlace a la pantalla completa.

// "Próximos" muestra tres y guarda el resto tras "Ver los otros N": son
// avisos, no urgencias. Lo sin fecha ya no lo necesita (tarea 332): va
// plegado entero y, al abrirlo, se ve todo.
export const PROXIMOS_VISIBLES = 3

// EN EL TELÉFONO, CADA GRUPO EN SU TARJETA (tarea 352, las piezas de «Ventana»):
// las filas con su divisor dentro de la tarjeta de los grupos de Más, el rótulo
// a 15 · 800 en tinta 2, los contadores con el tinte y la línea de su estado y
// «Sin fecha» como tarjeta con relieve. La barra de estado, la razón en su
// color y el verbo de cada fila se quedan: son lo que dice cómo está cada cosa.
// Desde 768, la lista de siempre.
const FILAS_AGENDA = `flex flex-col ${FILAS_EN_TARJETA}`

/**
 * LOS TRES CONTADORES (rediseño móvil "1b Pulgar", tareas 330 y 332):
 * vencidos, para hoy y próximos, con el número en IBM Plex Mono y en el
 * color de su estado solo si hay alguno. Los mismos en "Necesita atención"
 * de Resolver (con `enlace`, cada uno abre la Agenda) y arriba de la
 * Agenda (sin enlace: ya se está en ella). Sustituyen a la línea de
 * resumen ("2 vencidos · 1 para hoy · 3 próximos") que encabezaba la
 * Agenda: dicen lo mismo y se comparan de un vistazo.
 */
export function ContadoresAgenda({ agenda, enlace }: { agenda: Agenda; enlace?: string }) {
  const contadores = [
    { clave: 'vencidos', n: agenda.vencidos.length, uno: 'vencido', varios: 'vencidos', tono: 'error' },
    { clave: 'hoy', n: agenda.hoy.length, uno: 'para hoy', varios: 'para hoy', tono: 'precaucion' },
    { clave: 'proximos', n: agenda.proximos.length, uno: 'próximo', varios: 'próximos', tono: 'neutro' },
  ] as const
  return (
    <div className="grid grid-cols-3 gap-2">
      {contadores.map((c) => {
        const etiqueta = c.n === 1 ? c.uno : c.varios
        // 64 en el teléfono y 60 en la tableta; desde 1280, el contador denso
        // del escritorio: 54 de alto, el número y su rótulo en una línea (T3).
        // El número conserva sus 24 px (el lienzo lo baja a 22): a 22 el rojo
        // sobre su tinte del tema claro quedaba en 4.49:1, y a 24 es texto
        // grande (T11, auditoría de contraste).
        const clase = `flex min-h-16 flex-col justify-center gap-px rounded-[14px] px-3 py-2 md:min-h-[60px] xl:min-h-[54px] xl:flex-row xl:flex-wrap xl:items-baseline xl:content-center xl:gap-x-2 xl:px-3.5 xl:py-0 max-md:min-h-[72px] max-md:rounded-2xl max-md:border-[1.5px] max-md:px-3.5 ${
          c.n > 0 ? FONDO_CONTADOR[c.tono] : 'bg-noct-text/[.06] max-md:border-noct-divider max-md:bg-noct-surface'
        }`
        // El espacio entre el número y su rótulo no se ve (la caja es una
        // columna) pero hace que se lea "1 para hoy" y no "1para hoy".
        const contenido = (
          <>
            <span
              className={`font-mono text-[24px] font-semibold leading-[1.1] max-md:font-inter max-md:text-[28px] max-md:font-extrabold max-md:tracking-[-.02em] ${c.n > 0 ? COLOR_CONTADOR[c.tono] : 'text-noct-neutral-400'}`}
            >
              {c.n}
            </span>{' '}
            <span className="text-[12.5px] font-[550] text-noct-neutral-300 max-md:text-[14px] max-md:font-bold">{etiqueta}</span>
          </>
        )
        return enlace ? (
          <Link key={c.clave} to={enlace} aria-label={`${c.n} ${etiqueta}: abrir la Agenda`} className={`${clase} hover:brightness-110`}>
            {contenido}
          </Link>
        ) : (
          <p key={c.clave} className={clase}>
            {contenido}
          </p>
        )
      })}
    </div>
  )
}

// En el teléfono (tarea 352), el tinte y la línea de su estado del prototipo
// «Ventana», los mismos de un aviso de la ventana; sin nada, una tarjeta.
const FONDO_CONTADOR = {
  error: 'bg-noct-error/(--tinte-estado) max-md:border-noct-error-linea max-md:bg-noct-error-tinte',
  precaucion: 'bg-noct-precaucion/(--tinte-estado) max-md:border-noct-precaucion-linea max-md:bg-noct-precaucion-tinte',
  neutro: 'bg-noct-text/[.06] max-md:border-noct-divider max-md:bg-noct-surface',
} as const
const COLOR_CONTADOR = {
  error: 'text-noct-error',
  precaucion: 'text-noct-precaucion',
  neutro: 'text-noct-text',
} as const

/**
 * Los grupos, en el orden en que se decide el día: vencidos, para hoy y
 * próximos (lo que tiene fecha, tareas propias incluidas), las tareas sin
 * fecha y, al final y plegados, lo que no es un pendiente propio: lo que el
 * equipo deja por revisar y las guías en preparación.
 *
 * DESDE LA TAREA 365 (D7 de la auditoría del 2026-10-27, AD-100): la guía a
 * medias ya no está aquí (se queda en «Sigue donde ibas» de Resolver) y los
 * borradores pasan a «Guías en preparación», fuera del conteo. Antes, sin
 * nada con fecha, la Agenda abría «Sin fecha» con la guía de ayer y los
 * borradores delante: lo primero que se veía no era trabajo pendiente.
 */
export function SeccionesAgenda({
  agenda,
  cargando = false,
  conEnlaceCompleta = false,
  disposicion = 'columna',
  complemento,
}: {
  agenda: Agenda
  /**
   * La base local todavía no respondió. Mientras tanto NO se dice "Todo
   * al día por hoy": sería afirmar que no hay nada vencido antes de
   * haberlo mirado, y el mensaje se desmentiría solo un instante después.
   */
  cargando?: boolean
  /** Inicio: enlace a `/agenda`. La propia `/agenda` no se enlaza a sí misma. */
  conEnlaceCompleta?: boolean
  /**
   * CÓMO SE REPARTEN LOS GRUPOS POR ANCHO (tarea 339, T7; handoff de tableta
   * y escritorio). `columna`, la de siempre: uno debajo del otro y lo que no
   * es pendiente propio plegado al final. `dos` (desde 1024): lo que tiene
   * fecha y las tareas sin fecha a la izquierda y, en su columna de 360, lo
   * del equipo y las guías en preparación ABIERTOS (sin botón: tienen sitio
   * propio) y el `complemento`. `tres` (desde 1680, T10): vencidos y para
   * hoy | próximos y sin fecha, todos, sin "Ver los otros N" | lo del equipo,
   * las guías en preparación y el `complemento`. Los grupos, su orden y qué
   * cae en cada uno no cambian: solo dónde se pintan.
   */
  disposicion?: 'columna' | 'dos' | 'tres'
  /** Lo que va al final de la columna de lo que no vence (la actividad del equipo). */
  complemento?: ReactNode
}) {
  const urgentes = asuntosUrgentes(agenda)
  const enColumnas = disposicion !== 'columna'

  if (cargando) {
    return (
      <p className="px-0.5 text-[13px] leading-relaxed text-noct-neutral-400">Cargando la agenda…</p>
    )
  }

  // ESTADO TRANQUILO: sin vencidos ni asuntos de hoy se dice con
  // todas sus letras, en vez de dejar el hueco en blanco. Con algo
  // vencido o de hoy NO aparece: sería mentir.
  const todoAlDia = urgentes === 0 && (
    <div className="flex items-center gap-3 rounded-[14px] bg-noct-exito/(--tinte-estado) p-3.5 max-md:rounded-2xl max-md:border-[1.5px] max-md:border-noct-exito-linea max-md:bg-noct-exito-tinte">
      <Check size={20} className="shrink-0 text-noct-exito" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-semibold leading-[1.3] max-md:text-[16px] max-md:font-extrabold">Todo al día por hoy</span>
        <span className="block text-[13px] leading-[1.35] text-noct-neutral-300">Nada vencido ni para hoy.</span>
      </p>
    </div>
  )

  const vencidos = agenda.vencidos.length > 0 && (
    <section>
      <CabeceraAgenda titulo="Vencidos" total={agenda.vencidos.length} estado="vencido" />
      <div className={FILAS_AGENDA}>
        {agenda.vencidos.map((item) => (
          <FilaAgenda key={item.clave} item={item} estado="vencido" />
        ))}
      </div>
    </section>
  )

  const hoy = agenda.hoy.length > 0 && (
    <section>
      <CabeceraAgenda titulo="Para hoy" total={agenda.hoy.length} estado="hoy" />
      <div className={FILAS_AGENDA}>
        {agenda.hoy.map((item) => (
          <FilaAgenda key={item.clave} item={item} estado="hoy" />
        ))}
      </div>
    </section>
  )

  const proximos = agenda.proximos.length > 0 && (
    <BloqueLista
      titulo="Próximos"
      total={agenda.proximos.length}
      estado="proximo"
      etiquetaVerMas="próximos"
      // Con su propia columna (1680) se ven todos: "Ver los otros N" no
      // ahorra nada donde hay sitio.
      visiblesIniciales={disposicion === 'tres' ? agenda.proximos.length : PROXIMOS_VISIBLES}
    >
      {(visibles) =>
        agenda.proximos
          .slice(0, visibles)
          .map((item) => <FilaAgenda key={item.clave} item={item} estado="proximo" />)
      }
    </BloqueLista>
  )

  // LAS TAREAS SIN FECHA (tarea 365): trabajo propio que no vence, a la
  // vista y después de lo que tiene fecha.
  const sinFecha = agenda.sinFecha.length > 0 && (
    <section>
      <CabeceraAgenda titulo="Sin fecha" total={agenda.sinFecha.length} estado="sinFecha" />
      <div className={FILAS_AGENDA}>
        {agenda.sinFecha.map((item) => (
          <FilaAgenda key={item.clave} item={item} estado="sinFecha" />
        ))}
      </div>
    </section>
  )

  // LO QUE NO ES UN PENDIENTE PROPIO (tarea 365, D7), cada uno en su pliegue:
  // lo que el equipo deja por revisar (sugerencias de diagnóstico sin
  // convertir en guía, equipos liberados que esperan dueño, personas
  // retiradas con equipos) y las guías en preparación (los borradores
  // propios). No cuentan en «Agenda completa» ni en los contadores.
  const delEquipo = agenda.porRevisar.length > 0 && (
    <BloquePlegado
      titulo="Del equipo, por revisar"
      nota="Equipos liberados y sugerencias. No vencen."
      total={agenda.porRevisar.length}
      abierto={enColumnas}
    >
      {agenda.porRevisar.map((item) => (
        <FilaAgenda key={item.clave} item={item} estado="porRevisar" />
      ))}
    </BloquePlegado>
  )
  const enPreparacion = agenda.enCurso.length > 0 && (
    <BloquePlegado
      titulo="Guías en preparación"
      nota="Tus borradores. No cuentan como pendientes."
      total={agenda.enCurso.length}
      abierto={enColumnas}
    >
      {agenda.enCurso.map((item) => (
        <FilaAgenda key={item.clave} item={item} estado="enCurso" />
      ))}
    </BloquePlegado>
  )

  const enlace = conEnlaceCompleta && (
    <Link
      to="/agenda"
      className="inline-flex min-h-11 items-center gap-1.5 self-start px-1.5 text-[13px] font-medium text-noct-accent-300 hover:underline"
    >
      Ver agenda completa
      <CaretRight size={13} aria-hidden />
    </Link>
  )

  if (!enColumnas) {
    return (
      <>
        {todoAlDia}
        {vencidos}
        {hoy}
        {proximos}
        {sinFecha}
        {delEquipo}
        {enPreparacion}
        {enlace}
      </>
    )
  }

  // EN COLUMNAS (tarea 339, T7 y T10): lo que no es pendiente propio tiene
  // su columna y va abierto, con su cabecera (qué guarda y cuántos), sin
  // botón. Al final de esa columna, el complemento.
  const columnaSinVencer = (
    <aside className="flex min-w-0 flex-col gap-5">
      {delEquipo}
      {enPreparacion}
      {complemento}
    </aside>
  )

  if (disposicion === 'tres') {
    // Tres columnas de lectura (1680): lo que urge, lo que viene y lo que no
    // es pendiente propio. Si no hay próximos ni tareas sin fecha, su
    // columna no queda vacía en medio: las otras dos se reparten el ancho.
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px] items-start gap-x-11">
        <div className="flex min-w-0 flex-col gap-[22px]">
          {todoAlDia}
          {vencidos}
          {hoy}
          {enlace}
        </div>
        <div className="flex min-w-0 flex-col gap-[22px]">
          {proximos}
          {sinFecha}
        </div>
        {columnaSinVencer}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-x-12">
      <div className="flex min-w-0 flex-col gap-[22px]">
        {todoAlDia}
        {vencidos}
        {hoy}
        {proximos}
        {sinFecha}
        {enlace}
      </div>
      {columnaSinVencer}
    </div>
  )
}

// UN PLIEGUE DE LO QUE NO ES PENDIENTE PROPIO (tarea 365, D7; la fila
// plegada de la tarea 332): una tarjeta que dice qué guarda, por qué no
// vence y cuántos, y al abrirla sus filas. Con columna propia (desde 1024)
// va abierto y su cabecera no es un botón.
function BloquePlegado({
  titulo,
  nota,
  total,
  abierto: siempreAbierto,
  children,
}: {
  titulo: string
  nota: string
  total: number
  abierto: boolean
  children: ReactNode
}) {
  const [elegido, setElegido] = useState(false)
  const id = useId()
  const abierto = siempreAbierto || elegido
  const cabecera = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-[1.3] max-md:text-[16px] max-md:font-extrabold">{titulo}</span>
        <span className="block text-[13px] leading-[1.35] text-noct-neutral-400 max-md:text-[14px] max-md:text-noct-neutral-300">
          {nota}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[13px] tabular-nums text-noct-neutral-500">{total}</span>
    </>
  )
  return (
    <section className="flex flex-col">
      {siempreAbierto ? (
        <div className="flex items-start gap-2.5 border-b border-noct-divider pb-3">{cabecera}</div>
      ) : (
        <button
          type="button"
          onClick={() => setElegido(!elegido)}
          aria-expanded={abierto}
          aria-controls={id}
          className={`flex min-h-14 w-full items-center gap-2.5 border-y border-noct-divider py-2 text-left text-noct-text hover:bg-noct-text/[.04] max-md:min-h-16 max-md:border-[1.5px] max-md:bg-noct-surface max-md:px-4 max-md:active:bg-noct-presionado ${RELIEVE_EN_TELEFONO}`}
        >
          {cabecera}
          <CaretDown
            size={15}
            className={`shrink-0 text-noct-neutral-400 transition-transform duration-150 motion-reduce:transition-none ${
              abierto ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
      )}
      {abierto && (
        <div id={id} className={`${FILAS_AGENDA} ${siempreAbierto ? 'pt-1' : 'mt-2'}`}>
          {children}
        </div>
      )}
    </section>
  )
}

// Bloque de lista con cabecera de rótulo + conteo y un "Ver los otros N"
// que despliega el resto EN EL SITIO (mockup `2b`).
function BloqueLista({
  titulo,
  total,
  estado,
  etiquetaVerMas,
  visiblesIniciales,
  children,
}: {
  titulo: string
  total: number
  estado: EstadoAgenda
  // Qué son los que faltan, para que el texto accesible diga algo
  // ("Ver los otros 4 próximos") en vez de solo un número.
  etiquetaVerMas: string
  visiblesIniciales: number
  children: (visibles: number) => ReactNode
}) {
  const [desplegado, setDesplegado] = useState(false)
  const ocultos = total - visiblesIniciales

  return (
    <section>
      <CabeceraAgenda titulo={titulo} total={total} estado={estado} />
      <div className={FILAS_AGENDA}>{children(desplegado ? total : visiblesIniciales)}</div>
      {ocultos > 0 && !desplegado && (
        <button
          type="button"
          onClick={() => setDesplegado(true)}
          className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 self-start px-0.5 text-[14px] font-semibold text-noct-accent-300"
        >
          {textoVerOtros(ocultos)}
          <span className="sr-only"> {etiquetaVerMas}</span>
          <CaretDown size={13} aria-hidden />
        </button>
      )}
    </section>
  )
}

// Cabecera de un grupo: qué es, con un punto del color de su estado, y
// cuántos hay. El punto es lo que distingue de un vistazo "Vencidos"
// (rojo) de "Para hoy" (ámbar) y de "Próximos" (gris) sin leer el
// rótulo. El rótulo ya nombra el estado, así que el punto es refuerzo,
// no la única señal. Desde la tarea 332, en minúsculas a 15 px (antes un
// rótulo en mayúsculas) y el conteo en IBM Plex Mono.
function CabeceraAgenda({ titulo, total, estado }: { titulo: string; total: number; estado: EstadoAgenda }) {
  return (
    <div className="flex items-center gap-2 pb-1 max-md:px-1 max-md:pb-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_ESTADO[estado]}`} aria-hidden />
      <h2 className={`min-w-0 flex-1 text-[15px] font-semibold leading-[1.3] ${TITULO_GRUPO_EN_TELEFONO}`}>{titulo}</h2>
      <span className="shrink-0 font-mono text-[13px] tabular-nums text-noct-neutral-500">{total}</span>
    </div>
  )
}

// FILA DE LA AGENDA (M-R6, fila de ACCIÓN). 56 px como mínimo (crece con
// un título largo, que nunca se corta), título de 15 px y,
// debajo, LA RAZÓN en el color de su estado ("Venció hace 3 días" en
// rojo) y de dónde sale ("Bóveda", o el nombre del equipo). El origen
// solo aparece cuando el ítem tiene fecha. A la derecha, la acción en un
// verbo: abrir, continuar o revisar.
export function FilaAgenda({ item, estado }: { item: ItemPendiente; estado: EstadoAgenda }) {
  if (item.categoria === 'tarea' && item.tareaId) return <FilaTarea item={item} tareaId={item.tareaId} estado={estado} />
  const Icono = ICONO_PENDIENTE[item.categoria]
  const accion = accionDeItem(item)
  // LA FILA DEL REDISEÑO MÓVIL "1b PULGAR" (tarea 330): el estado en una
  // barra lateral de 4 px de su color (y en la razón), el icono neutro (lo
  // que es, no cómo está) y el verbo a 14 px seminegrita. Antes el icono
  // llevaba el color y la fila vencida, un fondo rojo.
  return (
    <Link
      to={item.ruta}
      aria-label={`${accion} ${item.titulo} · ${ETIQUETA_ESTADO[estado]}`}
      className="flex min-h-[62px] items-center gap-3 border-b border-noct-divider py-2 text-noct-text hover:bg-noct-text/[.04] max-md:min-h-[68px] max-md:py-2.5 max-md:last:border-b-0 max-md:active:bg-noct-presionado md:min-h-14 xl:min-h-[52px] xl:gap-[11px] xl:py-1.5"
    >
      <span aria-hidden data-barra-estado className={`my-1 w-1 shrink-0 self-stretch rounded-sm ${BARRA_PENDIENTE[item.tono]}`} />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-noct-text/[.06] text-noct-neutral-300 max-md:h-10 max-md:w-10 max-md:rounded-xl max-md:bg-noct-neutral-900 xl:h-8 xl:w-8 xl:rounded-[9px]">
        <Icono size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        {/* El nombre entero (regla 23): es lo que dice QUÉ vence o qué
            hay que revisar. La razón de debajo sí se recorta. */}
        <span
          data-nombre-principal
          className="block min-w-0 text-[15.5px] font-semibold leading-[1.3] [overflow-wrap:anywhere] [text-wrap:pretty] max-md:text-[16px] max-md:font-bold xl:text-[14.5px]"
        >
          {item.titulo}
        </span>
        {/* En el teléfono, dentro de su tarjeta, la razón ya no se corta: es lo
            que dice por qué la fila está aquí ("con 1 equipo", tarea 352). */}
        <span className="mt-0.5 block truncate text-[13px] leading-[1.35] max-md:whitespace-normal max-md:text-[14px] max-md:[text-wrap:pretty]">
          <span className={`font-[550] max-md:font-bold ${COLOR_RAZON[item.tono]}`}>{item.detalle}</span>
          {item.fecha !== null && item.origen && <span className="text-noct-neutral-400 max-md:text-noct-neutral-300"> · {item.origen}</span>}
        </span>
      </span>
      {/* La acción en su palabra, SIN chevron detrás: los dos dicen lo
          mismo ("esto lleva a otro sitio") y en 360 px el chevron se
          come 20 px del título, que es el dato que de verdad hay que
          leer. */}
      <span className="shrink-0 text-[14px] font-semibold text-noct-accent-300 max-md:text-[15px] max-md:font-extrabold" aria-hidden>
        {accion}
      </span>
    </Link>
  )
}

// UNA TAREA PROPIA EN SU FILA (tarea 365, D5, prototipo de Claude Design). La
// misma barra de estado y la misma razón en su color que las demás, pero en
// vez del icono, un círculo que la marca hecha (44 de toque): sale de la lista
// y el aviso ofrece «Deshacer». El resto de la fila abre la tarea para
// editarla, en la hoja de la pantalla. Sin verbo a la derecha: la fila no
// lleva a otro sitio.
function FilaTarea({ item, tareaId, estado }: { item: ItemPendiente; tareaId: string; estado: EstadoAgenda }) {
  const hoja = useHojaTarea()
  const cuerpo = (
    <span className="min-w-0 flex-1">
      {/* El nombre entero (regla 23): es lo que hay que hacer. */}
      <span
        data-nombre-principal
        className="block min-w-0 text-[15.5px] font-semibold leading-[1.3] [overflow-wrap:anywhere] [text-wrap:pretty] max-md:text-[16px] max-md:font-bold xl:text-[14.5px]"
      >
        {item.titulo}
      </span>
      <span className="mt-0.5 block text-[13px] leading-[1.35] max-md:text-[14px] max-md:[text-wrap:pretty]">
        <span className={`font-[550] max-md:font-bold ${COLOR_RAZON[item.tono]}`}>{item.detalle}</span>
        {item.origen && <span className="text-noct-neutral-400 max-md:text-noct-neutral-300"> · {item.origen}</span>}
      </span>
    </span>
  )
  return (
    <div
      data-fila-tarea={tareaId}
      className="flex min-h-[62px] items-center gap-1.5 border-b border-noct-divider text-noct-text max-md:min-h-[68px] max-md:last:border-b-0 md:min-h-14 xl:min-h-[52px]"
    >
      <span aria-hidden data-barra-estado className={`my-2.5 w-1 shrink-0 self-stretch rounded-sm ${BARRA_PENDIENTE[item.tono]}`} />
      <button
        type="button"
        aria-label={`Marcar como hecha: ${item.titulo}`}
        onClick={() => void marcarTareaHecha(tareaId)}
        className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-noct-text/[.06] active:bg-noct-presionado"
      >
        <span
          aria-hidden
          className="h-6 w-6 rounded-full border-2 border-noct-neutral-300 group-hover:border-noct-exito xl:h-5 xl:w-5"
        />
      </button>
      {hoja ? (
        <button
          type="button"
          onClick={() => hoja.editar(tareaId)}
          aria-label={`${accionDeItem(item)} ${item.titulo} · ${ETIQUETA_ESTADO[estado]}`}
          className="flex min-h-14 min-w-0 flex-1 items-center py-2 text-left hover:bg-noct-text/[.04] max-md:active:bg-noct-presionado"
        >
          {cuerpo}
        </button>
      ) : (
        <div className="flex min-h-14 min-w-0 flex-1 items-center py-2">{cuerpo}</div>
      )}
    </div>
  )
}

// Icono y tono de una fila según su categoría: una credencial vencida
// pesa distinto que un borrador propio, aunque ambos sean "algo por
// resolver".
const ICONO_PENDIENTE: Record<ItemPendiente['categoria'], (props: IconoProps) => React.JSX.Element> = {
  borrador: PencilSimple,
  credencial: LockSimple,
  campo_protegido: LockSimple,
  sugerencia: Lightbulb,
  // Tarea 270: una persona (su ingreso o su retiro) y un equipo.
  persona_ingreso: User,
  persona_retirada: User,
  equipo_liberado: Monitor,
  // Tarea 320: un mantenimiento programado de un equipo.
  mantenimiento: Wrench,
  // Tarea 321: el aviso de una autorización de facturación de un POS.
  facturacion: Storefront,
  // Tarea 365: una tarea propia (su fila lleva el círculo, no el icono).
  tarea: ListChecks,
}
// La barra lateral de la fila, en el color de su estado (tarea 330).
const BARRA_PENDIENTE: Record<ItemPendiente['tono'], string> = {
  neutro: 'bg-noct-neutral-500',
  precaucion: 'bg-noct-precaucion',
  error: 'bg-noct-error',
}
// La razón va en el color del estado, no en gris: es lo que distingue
// "Venció hace 3 días" de "Borrador tuyo · hace 2 días" de un vistazo.
const COLOR_RAZON: Record<ItemPendiente['tono'], string> = {
  neutro: 'text-noct-neutral-400',
  precaucion: 'text-noct-precaucion',
  error: 'text-noct-error',
}
// Color del punto de cada grupo: el estado se ve antes de leerlo.
const COLOR_ESTADO: Record<EstadoAgenda, string> = {
  vencido: 'bg-noct-error',
  hoy: 'bg-noct-precaucion',
  proximo: 'bg-noct-neutral-500',
  sinFecha: 'bg-noct-neutral-300',
  enCurso: 'bg-noct-accent',
  porRevisar: 'bg-noct-neutral-500',
}
