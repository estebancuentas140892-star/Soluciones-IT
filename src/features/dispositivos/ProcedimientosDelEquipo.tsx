import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { BookOpen, CaretRight } from '../../components/iconos'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { procedimientosDeDispositivo } from './procedimientosDeDispositivo'

// Procedimientos de este equipo (fase N2): el inverso del vinculo
// "Equipos donde aplica" (dispositivosAfectados generalizado a todo
// tipo de articulo). Se oculta si no hay ninguno. Re-autorizado a
// Nocturne: filas de la lista "Resolver con este equipo" (icono en el
// acento, titulo y tipo, chevron).
export function ProcedimientosDelEquipo({ dispositivoId }: { dispositivoId: string }) {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const procedimientos = useMemo(
    () => procedimientosDeDispositivo(articulos, dispositivoId),
    [articulos, dispositivoId],
  )

  if (procedimientos.length === 0) return null

  return (
    <>
      {procedimientos.map((articulo) => (
        <Link
          key={articulo.id}
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
      ))}
    </>
  )
}
