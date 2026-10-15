import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarraReanudar } from '../../components/BarraReanudar'
import {
  CaretDown,
  CaretRight,
  Check,
  type IconoProps,
  Lightbulb,
  LockSimple,
  Monitor,
  PencilSimple,
  Storefront,
  User,
  Wrench,
} from '../../components/iconos'
import { tarjetaReanudarVisible, useReanudar } from '../soluciones/useReanudar'
import type { ItemPendiente } from './pendientes'
import {
  accionDeItem,
  agendaSinGuiaEnCurso,
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
        const clase = `flex min-h-16 flex-col justify-center gap-px rounded-[14px] px-3 py-2 ${
          c.n > 0 ? FONDO_CONTADOR[c.tono] : 'bg-noct-text/[.06]'
        }`
        // El espacio entre el número y su rótulo no se ve (la caja es una
        // columna) pero hace que se lea "1 para hoy" y no "1para hoy".
        const contenido = (
          <>
            <span
              className={`font-mono text-[24px] font-semibold leading-[1.1] ${c.n > 0 ? COLOR_CONTADOR[c.tono] : 'text-noct-neutral-400'}`}
            >
              {c.n}
            </span>{' '}
            <span className="text-[12.5px] font-[550] text-noct-neutral-300">{etiqueta}</span>
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

const FONDO_CONTADOR = {
  error: 'bg-noct-error/[.13]',
  precaucion: 'bg-noct-precaucion/[.13]',
  neutro: 'bg-noct-text/[.06]',
} as const
const COLOR_CONTADOR = {
  error: 'text-noct-error',
  precaucion: 'text-noct-precaucion',
  neutro: 'text-noct-text',
} as const

/**
 * Los grupos, en el orden en que se decide el día: vencidos, para hoy y
 * próximos, y al final la fila plegada "Sin fecha" con lo que no vence
 * (en curso y lo que el equipo dejó por revisar).
 *
 * La guía a medias (`useReanudar`) entra dentro de "En curso" y NO se
 * repite: si ese artículo también es un borrador propio, `agendaSinGuiaEnCurso`
 * lo saca de la lista, porque la tarjeta ya lleva el paso donde iba.
 */
export function SeccionesAgenda({
  agenda,
  cargando = false,
  conEnlaceCompleta = false,
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
}) {
  const reanudar = useReanudar()
  const hayQueReanudar = tarjetaReanudarVisible(reanudar)
  const idEnCurso = hayQueReanudar ? (reanudar.actual?.articulo.id ?? null) : null
  const vista = agendaSinGuiaEnCurso(agenda, idEnCurso)
  const urgentes = asuntosUrgentes(vista)
  // "Sin fecha" desplegado es estado de la pantalla, no se guarda. Empieza
  // plegado, salvo que no haya nada con fecha: entonces sería lo único de
  // la Agenda, y plegarlo la dejaría en "Todo al día" y una fila cerrada.
  const [sinFechaElegido, setSinFechaElegido] = useState<boolean | null>(null)
  const idSinFecha = useId()

  if (cargando) {
    return (
      <p className="px-0.5 text-[13px] leading-relaxed text-noct-neutral-400">Cargando la agenda…</p>
    )
  }

  const enCurso = vista.enCurso.length + (hayQueReanudar ? 1 : 0)
  const totalSinFecha = enCurso + vista.porRevisar.length
  const conFecha = vista.vencidos.length + vista.hoy.length + vista.proximos.length
  const sinFechaAbierto = sinFechaElegido ?? conFecha === 0

  return (
    <>
      {/* ESTADO TRANQUILO: sin vencidos ni asuntos de hoy se dice con
          todas sus letras, en vez de dejar el hueco en blanco. Con algo
          vencido o de hoy NO aparece: sería mentir. */}
      {urgentes === 0 && (
        <div className="flex items-center gap-3 rounded-[14px] bg-noct-exito/[.13] p-3.5">
          <Check size={20} className="shrink-0 text-noct-exito" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-semibold leading-[1.3]">Todo al día por hoy</span>
            <span className="block text-[13px] leading-[1.35] text-noct-neutral-300">Nada vencido ni para hoy.</span>
          </p>
        </div>
      )}

      {vista.vencidos.length > 0 && (
        <section>
          <CabeceraAgenda titulo="Vencidos" total={vista.vencidos.length} estado="vencido" />
          <div className="flex flex-col">
            {vista.vencidos.map((item) => (
              <FilaAgenda key={item.clave} item={item} estado="vencido" />
            ))}
          </div>
        </section>
      )}

      {vista.hoy.length > 0 && (
        <section>
          <CabeceraAgenda titulo="Para hoy" total={vista.hoy.length} estado="hoy" />
          <div className="flex flex-col">
            {vista.hoy.map((item) => (
              <FilaAgenda key={item.clave} item={item} estado="hoy" />
            ))}
          </div>
        </section>
      )}

      {vista.proximos.length > 0 && (
        <BloqueLista
          titulo="Próximos"
          total={vista.proximos.length}
          estado="proximo"
          etiquetaVerMas="próximos"
          visiblesIniciales={PROXIMOS_VISIBLES}
        >
          {(visibles) =>
            vista.proximos
              .slice(0, visibles)
              .map((item) => <FilaAgenda key={item.clave} item={item} estado="proximo" />)
          }
        </BloqueLista>
      )}

      {/* SIN FECHA (rediseño móvil "1b Pulgar", tarea 332): lo que no vence
          va al final y plegado, en una fila que dice qué guarda y cuántos.
          Dentro, los dos grupos de siempre: "En curso" (la guía a medias y
          los borradores, trabajo propio empezado) y "Por revisar del
          equipo" (sugerencias de diagnóstico sin convertir en guía, que
          siguen el permiso con el que ya se listan en Guías con preguntas,
          y desde la tarea 270 los equipos liberados que esperan dueño y
          las personas retiradas que aún tienen equipos). `agruparAgenda`
          no cambia: solo dónde se pintan. */}
      {totalSinFecha > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setSinFechaElegido(!sinFechaAbierto)}
            aria-expanded={sinFechaAbierto}
            aria-controls={idSinFecha}
            className="flex min-h-14 w-full items-center gap-2.5 border-y border-noct-divider py-2 text-left text-noct-text hover:bg-noct-text/[.04]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-[1.3]">Sin fecha</span>
              <span className="block text-[13px] leading-[1.35] text-noct-neutral-400">
                Por revisar y en curso. No vencen.
              </span>
            </span>
            <span className="shrink-0 font-mono text-[13px] tabular-nums text-noct-neutral-500">{totalSinFecha}</span>
            <CaretDown
              size={15}
              className={`shrink-0 text-noct-neutral-400 transition-transform duration-150 motion-reduce:transition-none ${
                sinFechaAbierto ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          {sinFechaAbierto && (
            <div id={idSinFecha} className="flex flex-col gap-[18px] pt-3.5">
              {enCurso > 0 && (
                <section>
                  <CabeceraAgenda titulo="En curso" total={enCurso} estado="enCurso" />
                  <div className="flex flex-col gap-2">
                    {hayQueReanudar && reanudar.actual && (
                      <BarraReanudar
                        variante="tarjeta"
                        articulo={reanudar.actual.articulo}
                        hechos={reanudar.actual.hechos}
                        total={reanudar.actual.total}
                        totalAbierto={reanudar.actual.totalAbierto}
                        minutosRestantes={reanudar.actual.minutosRestantes}
                        onDescartar={reanudar.descartar}
                      />
                    )}
                    {vista.enCurso.length > 0 && (
                      <div className="flex flex-col">
                        {vista.enCurso.map((item) => (
                          <FilaAgenda key={item.clave} item={item} estado="enCurso" />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
              {/* Ya desplegado a propósito: se ven todos, sin un segundo
                  "Ver los otros N" dentro del pliegue. */}
              {vista.porRevisar.length > 0 && (
                <section>
                  <CabeceraAgenda titulo="Por revisar del equipo" total={vista.porRevisar.length} estado="porRevisar" />
                  <div className="flex flex-col">
                    {vista.porRevisar.map((item) => (
                      <FilaAgenda key={item.clave} item={item} estado="porRevisar" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      )}

      {conEnlaceCompleta && (
        <Link
          to="/agenda"
          className="inline-flex min-h-11 items-center gap-1.5 self-start px-1.5 text-[13px] font-medium text-noct-accent-300 hover:underline"
        >
          Ver agenda completa
          <CaretRight size={13} aria-hidden />
        </Link>
      )}
    </>
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
      <div className="flex flex-col">{children(desplegado ? total : visiblesIniciales)}</div>
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
    <div className="flex items-center gap-2 pb-1">
      <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_ESTADO[estado]}`} aria-hidden />
      <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-[1.3]">{titulo}</h2>
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
      className="flex min-h-[62px] items-center gap-3 border-b border-noct-divider py-2 text-noct-text hover:bg-noct-text/[.04] md:min-h-14 xl:min-h-[52px]"
    >
      <span aria-hidden data-barra-estado className={`my-1 w-1 shrink-0 self-stretch rounded-sm ${BARRA_PENDIENTE[item.tono]}`} />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-noct-text/[.06] text-noct-neutral-300">
        <Icono size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        {/* El nombre entero (regla 23): es lo que dice QUÉ vence o qué
            hay que revisar. La razón de debajo sí se recorta. */}
        <span
          data-nombre-principal
          className="block min-w-0 text-[15.5px] font-semibold leading-[1.3] [overflow-wrap:anywhere] [text-wrap:pretty]"
        >
          {item.titulo}
        </span>
        <span className="mt-0.5 block truncate text-[13px] leading-[1.35]">
          <span className={`font-[550] ${COLOR_RAZON[item.tono]}`}>{item.detalle}</span>
          {item.fecha !== null && item.origen && <span className="text-noct-neutral-400"> · {item.origen}</span>}
        </span>
      </span>
      {/* La acción en su palabra, SIN chevron detrás: los dos dicen lo
          mismo ("esto lleva a otro sitio") y en 360 px el chevron se
          come 20 px del título, que es el dato que de verdad hay que
          leer. */}
      <span className="shrink-0 text-[14px] font-semibold text-noct-accent-300" aria-hidden>
        {accion}
      </span>
    </Link>
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
  enCurso: 'bg-noct-accent',
  porRevisar: 'bg-noct-neutral-500',
}
