import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Articulo } from '../../lib/db'
import { db } from '../../lib/db'
import { BookOpen, CaretRight } from '../../components/iconos'
import { rutaGuiaConEquipo } from '../soluciones/contextoEjecucion'
import { claseTonoDeTipo } from '../soluciones/iconosSoluciones'
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
        <FilaProcedimiento key={articulo.id} articulo={articulo} dispositivoId={dispositivoId} />
      ))}

      {deCategoria.length > 0 && (
        <>
          <p className="px-2 pb-0.5 pt-1.5 text-[11px] text-noct-neutral-500">
            {hayAmbos ? 'Más de la categoría' : 'De la categoría'}
            {categoriaNombre ? ` ${categoriaNombre}` : ''}
          </p>
          {visiblesCategoria.map((articulo) => (
            <FilaProcedimiento key={articulo.id} articulo={articulo} dispositivoId={dispositivoId} />
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

// UNA FILA DE PROCEDIMIENTO (propuesta final de Claude Design,
// 2026-10-01): el título a 15 px y HASTA EN DOS LÍNEAS (cortado en una se
// quedaba en "Conectar la impresora compartida de ej..."), y el icono con
// el tinte de su tipo, que es lo que la segunda línea nombra.
//
// La guía se abre CON ESTE EQUIPO (tarea 290): si una acción pide la
// credencial del equipo actual, es la de este.
function FilaProcedimiento({ articulo, dispositivoId }: { articulo: Articulo; dispositivoId: string }) {
  return (
    <Link
      to={rutaGuiaConEquipo(`/soluciones/${articulo.categoriaId}/${articulo.id}`, dispositivoId)}
      className="flex min-h-[54px] items-center gap-3 rounded-lg px-2 py-1.5 text-noct-text transition-colors hover:bg-noct-text/[.05]"
    >
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md ${claseTonoDeTipo(articulo.tipo)}`}
      >
        <BookOpen size={17} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="line-clamp-2 text-[15px] font-medium leading-[1.3] text-pretty">{articulo.titulo}</span>
        <span className="truncate text-[12.5px] leading-[1.4] text-noct-neutral-400">
          {etiquetaDeTipo(articulo.tipo)}
        </span>
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}
