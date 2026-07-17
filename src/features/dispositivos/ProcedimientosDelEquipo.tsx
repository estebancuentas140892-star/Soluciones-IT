import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { etiquetaDeTipo } from '../soluciones/tiposArticulo'
import { procedimientosDeDispositivo } from './procedimientosDeDispositivo'

// Procedimientos de este equipo (fase N2): el inverso del vinculo
// "Equipos donde aplica" (dispositivosAfectados generalizado a todo
// tipo de articulo). Se oculta si no hay ninguno.
export function ProcedimientosDelEquipo({ dispositivoId }: { dispositivoId: string }) {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const procedimientos = useMemo(
    () => procedimientosDeDispositivo(articulos, dispositivoId),
    [articulos, dispositivoId],
  )

  if (procedimientos.length === 0) return null

  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-slate-500">Procedimientos de este equipo</h3>
      <ul className="flex flex-col gap-2">
        {procedimientos.map((articulo) => (
          <li key={articulo.id}>
            <Link
              to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-100">{articulo.titulo}</span>
                <span className="block truncate text-xs text-slate-500">{etiquetaDeTipo(articulo.tipo)}</span>
              </span>
              <span className="shrink-0 text-xs text-sky-400">Ver →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
