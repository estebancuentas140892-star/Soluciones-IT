import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { BarraReanudar } from '../../components/BarraReanudar'
import {
  CaretDown,
  CaretRight,
  Check,
  type IconoProps,
  Lightbulb,
  LockSimple,
  PencilSimple,
} from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { tarjetaReanudarVisible, useReanudar } from '../soluciones/useReanudar'
import type { ItemPendiente } from './pendientes'
import { agruparAgenda, asuntosUrgentes, fechaDeHoy, resumenAgenda } from './agenda'
import { usePendientes } from './usePendientes'

// LA AGENDA, EN SU PROPIA PANTALLA (encargo del 2026-09-17, secciones 2 y
// 10).
//
// Desde el 2026-09-11 la agenda operativa ERA Inicio: fecha de hoy,
// resumen, vencidos, para hoy, próximos, en curso y lo que el equipo dejó
// por revisar. Responde bien a "¿qué tengo pendiente?", pero no es lo
// que se viene a hacer al abrir Soluciones IT, que es encontrar un
// procedimiento y hacerlo: con la agenda delante, la búsqueda y las guías
// quedaban por encima de una lista de vencimientos de la Bóveda.
//
// No se pierde nada: los mismos grupos, las mismas filas, los mismos
// permisos y el mismo reparto (`agenda.ts`). Solo cambia de sitio. En
// Inicio asoma una línea cuando hay algo URGENTE (vencido o para hoy), y
// la pestaña conserva su número; lo demás se consulta aquí, desde esa
// línea o desde Más.
//
// Las DOS formas de fila (M-R6, "una fila, un significado"): `FilaAgenda`
// para lo que el técnico debe resolver (56 px, título de 15 px, la razón
// en el color de su estado y el origen al lado).

// Cuántas filas se ven antes de "Ver los otros N". Dos bastan para
// reconocer si hay algo urgente; el resto está a un toque y sin cambiar
// de pantalla.
const FILAS_VISIBLES = 2

// "Próximos" muestra tres y guarda el resto tras "Ver los otros N": son
// avisos, no urgencias.
const PROXIMOS_VISIBLES = 3

export function AgendaPage() {
  // Los mismos pendientes que cuenta el chasis para el número de la
  // pestaña, repartidos por FECHA en los cinco grupos (agenda.ts). Cada
  // ítem cae en uno solo, así que nada se cuenta ni se pinta dos veces.
  const pendientes = usePendientes()
  const agenda = useMemo(() => agruparAgenda(pendientes), [pendientes])
  const resumen = resumenAgenda(agenda)
  const urgentes = asuntosUrgentes(agenda)
  const hoyTexto = useMemo(() => fechaDeHoy(), [])
  const reanudar = useReanudar()
  const hayQueReanudar = tarjetaReanudarVisible(reanudar)

  return (
    // Nivel documento: se consulta y se vuelve. Sube a Inicio (padreDe).
    <Chasis modo="documento" titulo="Agenda" contexto={hoyTexto}>
      <main className="flex-1 px-4 pb-16 pt-4">
        <div className="flex flex-col gap-[18px]">
          {resumen !== '' && (
            <p
              className={`px-0.5 text-[15px] font-medium leading-[1.35] ${urgentes > 0 ? 'text-noct-text' : 'text-noct-neutral-300'}`}
            >
              {resumen}
            </p>
          )}

          {/* ESTADO TRANQUILO: sin vencidos ni asuntos de hoy, la pantalla
              lo dice con todas sus letras en vez de quedarse en blanco. */}
          {urgentes === 0 && (
            <section className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-5">
              <div className="flex items-center gap-2.5">
                <Check size={17} className="shrink-0 text-noct-exito" aria-hidden />
                <h2 className="text-[15px] font-medium leading-[1.3]">Todo al día por hoy</h2>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-noct-neutral-400">
                No hay accesos vencidos ni asuntos con fecha para hoy.
              </p>
            </section>
          )}

          {agenda.vencidos.length > 0 && (
            <section>
              <CabeceraAgenda titulo="Vencidos" total={agenda.vencidos.length} />
              <div className="flex flex-col">
                {agenda.vencidos.map((item) => (
                  <FilaAgenda key={item.clave} item={item} />
                ))}
              </div>
            </section>
          )}

          {agenda.hoy.length > 0 && (
            <section>
              <CabeceraAgenda titulo="Para hoy" total={agenda.hoy.length} />
              <div className="flex flex-col">
                {agenda.hoy.map((item) => (
                  <FilaAgenda key={item.clave} item={item} />
                ))}
              </div>
            </section>
          )}

          {agenda.proximos.length > 0 && (
            <BloqueLista
              titulo="Próximos"
              total={agenda.proximos.length}
              etiquetaVerMas="próximos"
              visiblesIniciales={PROXIMOS_VISIBLES}
            >
              {(visibles) =>
                agenda.proximos.slice(0, visibles).map((item) => <FilaAgenda key={item.clave} item={item} />)
              }
            </BloqueLista>
          )}

          {/* EN CURSO · trabajo propio empezado: la guía a medias y los
              borradores. No son obligaciones con plazo. */}
          {(hayQueReanudar || agenda.enCurso.length > 0) && (
            <section>
              <CabeceraAgenda titulo="En curso" total={agenda.enCurso.length + (hayQueReanudar ? 1 : 0)} />
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
                {agenda.enCurso.length > 0 && (
                  <div className="flex flex-col">
                    {agenda.enCurso.map((item) => (
                      <FilaAgenda key={item.clave} item={item} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* POR REVISAR DEL EQUIPO · sugerencias de diagnóstico que nadie
              ha convertido en guía. No están asignadas a este técnico. */}
          {agenda.porRevisar.length > 0 && (
            <BloqueLista
              titulo="Por revisar del equipo"
              total={agenda.porRevisar.length}
              etiquetaVerMas="sugerencias del equipo"
            >
              {(visibles) =>
                agenda.porRevisar.slice(0, visibles).map((item) => <FilaAgenda key={item.clave} item={item} />)
              }
            </BloqueLista>
          )}
        </div>
      </main>
    </Chasis>
  )
}

// Bloque de lista con cabecera de rótulo + conteo y un "Ver los otros N"
// que despliega el resto EN EL SITIO (mockup `2b`).
function BloqueLista({
  titulo,
  total,
  etiquetaVerMas,
  visiblesIniciales = FILAS_VISIBLES,
  children,
}: {
  titulo: string
  total: number
  // Qué son los que faltan, para que el texto accesible diga algo
  // ("Ver los otros 4 pendientes") en vez de solo un número.
  etiquetaVerMas: string
  visiblesIniciales?: number
  children: (visibles: number) => ReactNode
}) {
  const [desplegado, setDesplegado] = useState(false)
  const ocultos = total - visiblesIniciales

  return (
    <section>
      <CabeceraAgenda titulo={titulo} total={total} />
      <div className="flex flex-col">{children(desplegado ? total : visiblesIniciales)}</div>
      {ocultos > 0 && !desplegado && (
        <button
          type="button"
          onClick={() => setDesplegado(true)}
          className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[12.5px] font-medium text-noct-accent-300"
        >
          Ver los otros {ocultos}
          <span className="sr-only"> {etiquetaVerMas}</span>
          <CaretDown size={12} aria-hidden />
        </button>
      )}
    </section>
  )
}

// Cabecera de un grupo de la agenda: qué es y cuántos hay.
function CabeceraAgenda({ titulo, total }: { titulo: string; total: number }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
      <TituloSeccion>{titulo}</TituloSeccion>
      <span className="shrink-0 text-[11px] tabular-nums text-noct-neutral-400">{total}</span>
    </div>
  )
}

// FILA DE LA AGENDA (M-R6, fila de ACCIÓN). 56 px, título de 15 px y,
// debajo, LA RAZÓN en el color de su estado ("Venció hace 3 días" en
// rojo) y de dónde sale ("Bóveda", o el nombre del equipo). El origen
// solo aparece cuando el ítem tiene fecha.
function FilaAgenda({ item }: { item: ItemPendiente }) {
  const Icono = ICONO_PENDIENTE[item.categoria]
  return (
    <Link
      to={item.ruta}
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
          {item.fecha !== null && <span className="text-noct-neutral-400"> · {item.origen}</span>}
        </span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
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
