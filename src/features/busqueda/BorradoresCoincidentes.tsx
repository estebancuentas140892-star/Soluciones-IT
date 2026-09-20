import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PastillaEstadoArticulo } from '../../components/PastillaEstado'
import { CaretDown, PencilSimple } from '../../components/iconos'
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
// borrador", que abre el editor). Un borrador no se puede confundir con
// una guía del equipo ni por un momento.
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
          <FilaBorrador key={borrador.id} borrador={borrador} consulta={consulta} />
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
function FilaBorrador({ borrador, consulta }: { borrador: BorradorCoincidente; consulta: string }) {
  const { pre, match, post } = partirTitulo(borrador.titulo, consulta)
  return (
    <Link
      to={borrador.ruta}
      aria-label={`Revisar borrador ${borrador.titulo}`}
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
        <span className="mt-[3px] flex items-center gap-2 text-[12px] text-noct-neutral-400">
          <PastillaEstadoArticulo estado="borrador" />
          {borrador.categoriaNombre && <span className="truncate">{borrador.categoriaNombre}</span>}
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300" aria-hidden>
        Revisar borrador
      </span>
    </Link>
  )
}
