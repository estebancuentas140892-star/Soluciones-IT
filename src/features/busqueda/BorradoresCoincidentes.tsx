import { useCallback, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { conOrigen } from '../../lib/origenNavegacion'
import { useAnotarBusqueda } from './busquedaEnHistorial'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import { CaretDown, CaretRight, PencilSimple } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { partirTitulo } from '../soluciones/coincidencia'
import {
  BORRADORES_VISIBLES,
  fraseBorradores,
  type BorradorCoincidente,
} from './borradoresEnBusqueda'

// EL BLOQUE "BORRADORES COINCIDENTES" (encargo del 2026-09-20, tarea 1).
//
// Va SIEMPRE que haya búsqueda y algún borrador que coincida, con o sin
// resultados oficiales, y siempre APARTE de ellos: su propio rótulo, su
// propia pastilla "Borrador" en cada fila y su propia acción ("Revisar
// borrador", que abre la guía). Un borrador no se puede confundir con
// una guía del equipo ni por un momento.
//
// Desde el 2026-09-20 (tarea 249) la fila abre la GUÍA, no el editor:
// quien busca "DIAN" viene a hacer el procedimiento. El editor sigue a
// un toque desde los detalles de la guía.
//
// Lo que este bloque NO hace: meter el borrador en el índice. El
// buscador sigue indexando solo lo publicado (`useIndiceBusqueda`), que
// es lo correcto; esto es una lista aparte, calculada sobre la base
// local con `borradoresCoincidentes`.

export function BorradoresCoincidentes({
  borradores,
  consulta,
  consultaCruda,
}: {
  borradores: BorradorCoincidente[]
  /** Consulta normalizada, para resaltar el tramo del título. */
  consulta: string
  /** Consulta tal cual la escribió el técnico, para el enlace a Guías. */
  consultaCruda: string
}) {
  const [desplegado, setDesplegado] = useState(false)
  if (borradores.length === 0) return null

  const visibles = desplegado ? borradores : borradores.slice(0, BORRADORES_VISIBLES)
  const ocultos = borradores.length - visibles.length

  return (
    <section className="rounded-lg border border-noct-divider bg-noct-surface/60 p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
        <TituloSeccion>Borradores coincidentes</TituloSeccion>
        <span className="shrink-0 text-[11px] tabular-nums text-noct-neutral-400">{borradores.length}</span>
      </div>
      <p className="mb-2 px-0.5 text-[12.5px] leading-relaxed text-noct-neutral-400">
        {fraseBorradores(borradores.length)} con lo que buscaste. Todavía no son procedimientos del equipo:
        no salen en los resultados hasta que se publiquen.
      </p>
      <div className="flex flex-col">
        {visibles.map((borrador) => (
          <FilaBorrador
            key={borrador.id}
            borrador={borrador}
            consulta={consulta}
            consultaCruda={consultaCruda}
          />
        ))}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
        {ocultos > 0 && (
          <button
            type="button"
            onClick={() => setDesplegado(true)}
            className="inline-flex min-h-11 items-center gap-1.5 px-1.5 text-[12.5px] font-medium text-noct-accent-300"
          >
            Ver los otros {ocultos}
            <span className="sr-only"> borradores que coinciden</span>
            <CaretDown size={12} aria-hidden />
          </button>
        )}
        <Link
          to={`/soluciones?q=${encodeURIComponent(consultaCruda)}`}
          className="inline-flex min-h-11 items-center px-1.5 text-[12.5px] font-medium text-noct-accent-300"
        >
          Ver todos en Guías
        </Link>
      </div>
    </section>
  )
}

// Una fila de borrador: título (con el término resaltado, como en la
// lista de Guías), la pastilla "Borrador", su categoría cuando existe, y
// la acción. Abre el EDITOR: revisar un borrador es corregirlo, y
// ejecutarlo como si fuera oficial es justo lo que no debe pasar.
function FilaBorrador({
  borrador,
  consulta,
  consultaCruda,
}: {
  borrador: BorradorCoincidente
  consulta: string
  consultaCruda: string
}) {
  const { pre, match, post } = partirTitulo(borrador.titulo, consulta)
  const salto = useSaltoConBusqueda(consultaCruda)
  return (
    <Link
      to={borrador.ruta}
      state={salto.estado}
      onClick={salto.alSaltar}
      aria-label={`Abrir borrador ${borrador.titulo}`}
      className="flex min-h-14 items-center gap-3 rounded-md px-2 py-[9px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-precaucion/[.12] text-noct-precaucion">
        <PencilSimple size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-[1.3]">
          {pre}
          {match && <mark className="bg-transparent text-noct-accent-300">{match}</mark>}
          {post}
        </span>
        {/* La acción va en la SEGUNDA línea, no en una columna a la
            derecha: "Revisar borrador" ocupa casi 100 px, y en un
            teléfono de 360 se los quitaba al título, que es lo que hay
            que reconocer ("Actualizar la re…"). Aquí el título se queda
            con todo el ancho. */}
        <span className="mt-[3px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-noct-neutral-400">
          <PastillaEstadoArticulo estado="borrador" />
          {borrador.categoriaNombre && <span className="truncate">{borrador.categoriaNombre}</span>}
          <span className="font-medium text-noct-accent-300" aria-hidden>
            Abrir borrador
          </span>
        </span>
      </span>
    </Link>
  )
}

// GUÍAS EN BORRADOR QUE COINCIDEN EN EL TÍTULO (encargo del 2026-09-20,
// tarea 1). Van ARRIBA, con los resultados, no en el bloque del final:
// buscando "DIAN" la respuesta es el procedimiento que se llama así,
// aunque todavía no esté publicado, y no la ficha de la herramienta que
// lo acompaña.
//
// Sin cabecera de sección a propósito: es la primera respuesta de la
// pantalla y un rótulo la bajaría una línea. Lo que hay que saber va en
// la propia fila, debajo del título: "Borrador · contenido por
// confirmar".
export function GuiasEnBorrador({
  borradores,
  consulta,
  consultaCruda,
}: {
  borradores: BorradorCoincidente[]
  consulta: string
  consultaCruda: string
}) {
  if (borradores.length === 0) return null
  return (
    <section className="flex flex-col">
      {borradores.map((borrador) => (
        <FilaBorradorDestacado
          key={borrador.id}
          borrador={borrador}
          consulta={consulta}
          consultaCruda={consultaCruda}
        />
      ))}
    </section>
  )
}

function FilaBorradorDestacado({
  borrador,
  consulta,
  consultaCruda,
}: {
  borrador: BorradorCoincidente
  consulta: string
  consultaCruda: string
}) {
  const { pre, match, post } = partirTitulo(borrador.titulo, consulta)
  const salto = useSaltoConBusqueda(consultaCruda)
  return (
    <Link
      to={borrador.ruta}
      state={salto.estado}
      onClick={salto.alSaltar}
      aria-label={`Abrir borrador ${borrador.titulo}`}
      className="flex min-h-[60px] items-center gap-3 rounded-lg border border-noct-precaucion/30 bg-noct-precaucion/[.06] px-3 py-2.5 text-noct-text hover:bg-noct-precaucion/[.1]"
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-noct-precaucion/[.14] text-noct-precaucion">
        <PencilSimple size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-[1.3] [text-wrap:pretty]">
          {pre}
          {match && <mark className="bg-transparent text-noct-accent-300">{match}</mark>}
          {post}
        </span>
        <span className="mt-[3px] block truncate text-[12px] text-noct-precaucion">
          Borrador · contenido por confirmar
          {borrador.categoriaNombre && (
            <span className="text-noct-neutral-400"> · {borrador.categoriaNombre}</span>
          )}
        </span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-400" aria-hidden />
    </Link>
  )
}

// VOLVER A INICIO CON LA BÚSQUEDA ESCRITA. Es lo mismo que hace
// `ResultadosBusqueda` con sus filas: el salto lleva de dónde vino y qué
// se había escrito, así que la X de la guía devuelve a Inicio con "DIAN"
// en el campo, en vez de subir al padre declarado. Se anota además en la
// entrada actual del historial, para el botón atrás del teléfono.
function useSaltoConBusqueda(consultaCruda: string): { estado: unknown; alSaltar: () => void } {
  const { pathname, search } = useLocation()
  const anotar = useAnotarBusqueda()
  const busqueda = useMemo(
    () => (consultaCruda ? { consulta: consultaCruda, capa: false } : undefined),
    [consultaCruda],
  )
  const estado = useMemo(
    () => conOrigen(`${pathname}${search}`, 'la búsqueda', busqueda),
    [pathname, search, busqueda],
  )
  const alSaltar = useCallback(() => {
    if (busqueda) anotar(busqueda)
  }, [anotar, busqueda])
  return { estado, alSaltar }
}
