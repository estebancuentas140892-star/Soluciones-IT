import { useState, type ReactNode } from 'react'
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
  User,
} from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { tarjetaReanudarVisible, useReanudar } from '../soluciones/useReanudar'
import type { ItemPendiente } from './pendientes'
import {
  accionDeItem,
  agendaSinGuiaEnCurso,
  asuntosUrgentes,
  ETIQUETA_ESTADO,
  fechaDeHoy,
  resumenAgenda,
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
// avisos, no urgencias. Mismo tope en Inicio y en la agenda completa.
export const PROXIMOS_VISIBLES = 3

// Cuántas filas se ven en los grupos sin fecha antes de "Ver los otros
// N". Dos bastan para reconocer si hay algo; el resto está a un toque y
// sin cambiar de pantalla.
const FILAS_VISIBLES = 2

/**
 * Fecha de hoy y resumen de lo que hay con fecha ("2 vencidos · 1 para
 * hoy · 3 próximos"). Es el punto 2 de Inicio y la cabecera de la agenda
 * completa: sin el día, la palabra "hoy" de más abajo no dice respecto a
 * qué.
 */
export function ResumenDelDia({
  agenda,
  dia = fechaDeHoy(),
  cargando = false,
}: {
  agenda: Agenda
  dia?: string | null
  /** La base local todavía no respondió: no se afirma nada. */
  cargando?: boolean
}) {
  const resumen = resumenAgenda(agenda)
  const urgentes = asuntosUrgentes(agenda)
  return (
    <div className="px-0.5">
      {/* La agenda completa ya lleva el día en la cabecera del chasis y
          pasa `dia={null}`: decirlo dos veces en la misma pantalla es
          una línea que hay que leer para descartarla. */}
      {dia !== null && <p className="text-[13px] leading-[1.35] text-noct-neutral-400">{dia}</p>}
      <p
        className={`text-[15px] font-medium leading-[1.35] ${urgentes > 0 && !cargando ? 'text-noct-text' : 'text-noct-neutral-300'}`}
      >
        {cargando ? 'Revisando la agenda…' : resumen !== '' ? resumen : 'Nada con fecha'}
      </p>
    </div>
  )
}

/**
 * Los cinco grupos, en el orden en que se decide el día: vencidos, para
 * hoy, próximos, en curso y lo que el equipo dejó por revisar.
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

  if (cargando) {
    return (
      <p className="px-0.5 text-[13px] leading-relaxed text-noct-neutral-400">Cargando la agenda…</p>
    )
  }

  return (
    <>
      {/* ESTADO TRANQUILO: sin vencidos ni asuntos de hoy se dice con
          todas sus letras, en vez de dejar el hueco en blanco. Con algo
          vencido o de hoy NO aparece: sería mentir. */}
      {urgentes === 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-3">
          <Check size={17} className="shrink-0 text-noct-exito" aria-hidden />
          <p className="text-[14.5px] font-medium leading-[1.3]">Todo al día por hoy</p>
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

      {/* EN CURSO · trabajo propio empezado: la guía a medias y los
          borradores. No son obligaciones con plazo. */}
      {(hayQueReanudar || vista.enCurso.length > 0) && (
        <section>
          <CabeceraAgenda
            titulo="En curso"
            total={vista.enCurso.length + (hayQueReanudar ? 1 : 0)}
            estado="enCurso"
          />
          <div className="flex flex-col gap-2">
            {hayQueReanudar && reanudar.actual && (
              <BarraReanudar
                variante="tarjeta"
                articulo={reanudar.actual.articulo}
                hechos={reanudar.actual.hechos}
                total={reanudar.actual.total}
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

      {/* POR REVISAR DEL EQUIPO · sugerencias de diagnóstico que nadie ha
          convertido en guía (siguen el permiso con el que ya se listan en
          Guías con preguntas) y, desde la tarea 270, los equipos
          liberados hace poco que esperan dueño y las personas retiradas
          sin fecha que aún tienen equipos. Nada está asignado a este
          técnico: son asuntos del equipo. */}
      {vista.porRevisar.length > 0 && (
        <BloqueLista
          titulo="Por revisar del equipo"
          total={vista.porRevisar.length}
          estado="porRevisar"
          etiquetaVerMas="asuntos por revisar"
        >
          {(visibles) =>
            vista.porRevisar
              .slice(0, visibles)
              .map((item) => <FilaAgenda key={item.clave} item={item} estado="porRevisar" />)
          }
        </BloqueLista>
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
  visiblesIniciales = FILAS_VISIBLES,
  children,
}: {
  titulo: string
  total: number
  estado: EstadoAgenda
  // Qué son los que faltan, para que el texto accesible diga algo
  // ("Ver los otros 4 próximos") en vez de solo un número.
  etiquetaVerMas: string
  visiblesIniciales?: number
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
          className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[12.5px] font-medium text-noct-accent-300"
        >
          {textoVerOtros(ocultos)}
          <span className="sr-only"> {etiquetaVerMas}</span>
          <CaretDown size={12} aria-hidden />
        </button>
      )}
    </section>
  )
}

// Cabecera de un grupo: qué es, con un punto del color de su estado, y
// cuántos hay. El punto es lo que distingue de un vistazo "Vencidos"
// (rojo) de "Para hoy" (ámbar) y de "Próximos" (gris) sin leer el
// rótulo. El rótulo ya nombra el estado, así que el punto es refuerzo,
// no la única señal.
function CabeceraAgenda({ titulo, total, estado }: { titulo: string; total: number; estado: EstadoAgenda }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${COLOR_ESTADO[estado]}`} aria-hidden />
        <TituloSeccion>{titulo}</TituloSeccion>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-noct-neutral-400">{total}</span>
    </div>
  )
}

// FILA DE LA AGENDA (M-R6, fila de ACCIÓN). 56 px, título de 15 px y,
// debajo, LA RAZÓN en el color de su estado ("Venció hace 3 días" en
// rojo) y de dónde sale ("Bóveda", o el nombre del equipo). El origen
// solo aparece cuando el ítem tiene fecha. A la derecha, la acción en un
// verbo: abrir, continuar o revisar.
export function FilaAgenda({ item, estado }: { item: ItemPendiente; estado: EstadoAgenda }) {
  const Icono = ICONO_PENDIENTE[item.categoria]
  const accion = accionDeItem(item)
  return (
    <Link
      to={item.ruta}
      aria-label={`${accion} ${item.titulo} · ${ETIQUETA_ESTADO[estado]}`}
      className={`flex min-h-14 items-center gap-3 rounded-md px-2 py-[9px] text-noct-text hover:bg-noct-text/[.05] ${
        item.tono === 'error' ? 'bg-noct-error/[.07]' : ''
      }`}
    >
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md ${TONO_PENDIENTE[item.tono]}`}
      >
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-[1.3]">{item.titulo}</span>
        <span className="block truncate text-[12.5px]">
          <span className={COLOR_RAZON[item.tono]}>{item.detalle}</span>
          {item.fecha !== null && item.origen && <span className="text-noct-neutral-400"> · {item.origen}</span>}
        </span>
      </span>
      {/* La acción en su palabra, SIN chevron detrás: los dos dicen lo
          mismo ("esto lleva a otro sitio") y en 360 px el chevron se
          come 20 px del título, que es el dato que de verdad hay que
          leer. */}
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300" aria-hidden>
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
}
const TONO_PENDIENTE: Record<ItemPendiente['tono'], string> = {
  neutro: 'text-noct-neutral-400 bg-noct-neutral-400/[.12]',
  precaucion: 'text-noct-precaucion bg-noct-precaucion/[.12]',
  error: 'text-noct-error bg-noct-error/[.12]',
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
