import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { db } from '../../lib/db'
import { BookOpen, CaretRight } from '../../components/iconos'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { procedimientosDeCategoria, procedimientosDeDispositivo } from './procedimientosDeDispositivo'

// Cuantos procedimientos de categoria se muestran antes de ofrecer "Ver
// todos": suficientes para el caso comun sin alargar la ficha.
const MAX_CATEGORIA = 5

// Procedimientos de este equipo (fase N2 + hallazgo H1): el inverso del
// vinculo "Equipos donde aplica" (dispositivosAfectados), MAS los
// procedimientos publicados de la misma categoria del equipo (derivado
// por categoria_id, sin esquema). Asi un procedimiento generico
// ("Instalar impresora de red") aparece en cada impresora sin vincularlo
// una por una, igual que ya se ofrece el diagnostico por categoria. Se
// oculta si no hay ninguno. Re-autorizado a Nocturne: filas de la lista
// "Resolver con este equipo" (icono en el acento, titulo y tipo, chevron).
export function ProcedimientosDelEquipo({
  dispositivoId,
  categoriaId,
  categoriaNombre,
  marca,
  modelo,
}: {
  dispositivoId: string
  categoriaId: string
  categoriaNombre?: string
  // Hallazgo H6: refina "de esta categoría" a los procedimientos que no
  // restringen marca/modelo o que coinciden con los de este equipo.
  marca: string
  modelo: string
}) {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const especificos = useMemo(
    () => procedimientosDeDispositivo(articulos, dispositivoId),
    [articulos, dispositivoId],
  )
  const deCategoria = useMemo(() => {
    const idsExcluidos = new Set(especificos.map((a) => a.id))
    return procedimientosDeCategoria(articulos, categoriaId, idsExcluidos, { marca, modelo })
  }, [articulos, categoriaId, especificos, marca, modelo])

  if (especificos.length === 0 && deCategoria.length === 0) return null

  const hayAmbos = especificos.length > 0 && deCategoria.length > 0
  const visiblesCategoria = deCategoria.slice(0, MAX_CATEGORIA)

  return (
    <>
      {especificos.map((articulo) => (
        <FilaProcedimiento key={articulo.id} articulo={articulo} />
      ))}

      {deCategoria.length > 0 && (
        <>
          <p className="px-2 pb-0.5 pt-1.5 text-[11px] text-noct-neutral-500">
            {hayAmbos ? 'Más de la categoría' : 'De la categoría'}
            {categoriaNombre ? ` ${categoriaNombre}` : ''}
          </p>
          {visiblesCategoria.map((articulo) => (
            <FilaProcedimiento key={articulo.id} articulo={articulo} />
          ))}
          {deCategoria.length > visiblesCategoria.length && (
            <Link
              to={`/soluciones?categoria=${categoriaId}`}
              className="flex min-h-9 items-center gap-1.5 px-2 text-[12px] text-noct-accent-300 hover:text-noct-accent-400"
            >
              Ver los {deCategoria.length} de la categoría
              <CaretRight size={12} aria-hidden />
            </Link>
          )}
        </>
      )}
    </>
  )
}

function FilaProcedimiento({ articulo }: { articulo: Articulo }) {
  return (
    <Link
      to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
      className="flex min-h-[50px] items-center gap-[13px] rounded-md px-2 py-2.5 text-noct-text transition-colors hover:bg-noct-text/[.05]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-noct-accent/[.12] text-noct-accent-300">
        <BookOpen size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium leading-tight">{articulo.titulo}</span>
        <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
          {etiquetaDeTipo(articulo.tipo)}
        </span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}
