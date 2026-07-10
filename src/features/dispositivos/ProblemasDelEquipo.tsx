import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { problemasDeDispositivo } from './problemasDeDispositivo'

// Problemas frecuentes que afectan a este equipo (tarea 39, fase 1):
// el inverso del vínculo dispositivosAfectados. Se oculta si no hay
// ninguno, para no dejar una sección vacía en la ficha.
export function ProblemasDelEquipo({ dispositivoId }: { dispositivoId: string }) {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const problemas = useMemo(
    () => problemasDeDispositivo(articulos, dispositivoId),
    [articulos, dispositivoId],
  )

  if (problemas.length === 0) return null

  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-slate-500">Problemas frecuentes de este equipo</h3>
      <ul className="flex flex-col gap-2">
        {problemas.map((articulo) => (
          <li key={articulo.id}>
            <Link
              to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-100">{articulo.titulo}</span>
                {articulo.sintomas.length > 0 && (
                  <span className="block truncate text-xs text-slate-500">{articulo.sintomas[0]}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-sky-400">Ver →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
