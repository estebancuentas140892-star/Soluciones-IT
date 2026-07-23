import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { db } from '../../lib/db'
import { CaretRight, WarningCircle } from '../../components/iconos'
import { problemasDeCategoria, problemasDeDispositivo } from './problemasDeDispositivo'

// Cuantas incidencias de categoria se muestran antes de "Ver todos".
const MAX_CATEGORIA = 5

// Problemas frecuentes que afectan a este equipo (tarea 39, fase 1 +
// hallazgo H1): el inverso del vinculo dispositivosAfectados, MAS las
// incidencias publicadas de la misma categoria del equipo (derivado por
// categoria_id, sin esquema). Se oculta si no hay ninguno. Re-autorizado
// a Nocturne: filas de la lista "Resolver con este equipo" (icono en
// ambar/precaucion, titulo y primer sintoma, chevron).
export function ProblemasDelEquipo({
  dispositivoId,
  categoriaId,
  categoriaNombre,
  marca,
  modelo,
}: {
  dispositivoId: string
  categoriaId: string
  categoriaNombre?: string
  // Hallazgo H6: refina "de esta categoría" a las incidencias que no
  // restringen marca/modelo o que coinciden con los de este equipo.
  marca: string
  modelo: string
}) {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const especificos = useMemo(
    () => problemasDeDispositivo(articulos, dispositivoId),
    [articulos, dispositivoId],
  )
  const deCategoria = useMemo(() => {
    const idsExcluidos = new Set(especificos.map((a) => a.id))
    return problemasDeCategoria(articulos, categoriaId, idsExcluidos, { marca, modelo })
  }, [articulos, categoriaId, especificos, marca, modelo])

  if (especificos.length === 0 && deCategoria.length === 0) return null

  const hayAmbos = especificos.length > 0 && deCategoria.length > 0
  const visiblesCategoria = deCategoria.slice(0, MAX_CATEGORIA)

  return (
    <>
      {especificos.map((articulo) => (
        <FilaProblema key={articulo.id} articulo={articulo} />
      ))}

      {deCategoria.length > 0 && (
        <>
          <p className="px-2 pb-0.5 pt-1.5 text-[11px] text-noct-neutral-500">
            {hayAmbos ? 'Más incidencias de la categoría' : 'Incidencias de la categoría'}
            {categoriaNombre ? ` ${categoriaNombre}` : ''}
          </p>
          {visiblesCategoria.map((articulo) => (
            <FilaProblema key={articulo.id} articulo={articulo} />
          ))}
          {deCategoria.length > visiblesCategoria.length && (
            <Link
              to={`/soluciones?categoria=${categoriaId}`}
              className="flex min-h-9 items-center gap-1.5 px-2 text-[12px] text-noct-accent-300 hover:text-noct-accent-400"
            >
              Ver las {deCategoria.length} de la categoría
              <CaretRight size={12} aria-hidden />
            </Link>
          )}
        </>
      )}
    </>
  )
}

function FilaProblema({ articulo }: { articulo: Articulo }) {
  return (
    <Link
      to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
      className="flex min-h-[50px] items-center gap-[13px] rounded-md px-2 py-2.5 text-noct-text transition-colors hover:bg-noct-text/[.05]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-noct-precaucion/[.12] text-noct-precaucion">
        <WarningCircle size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium leading-tight">{articulo.titulo}</span>
        {articulo.sintomas.length > 0 && (
          <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">{articulo.sintomas[0]}</span>
        )}
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}
