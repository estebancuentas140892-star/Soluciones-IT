import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { CaretRight, WarningCircle } from '../../components/iconos'
import { problemasDeDispositivo } from './problemasDeDispositivo'

// Problemas frecuentes que afectan a este equipo (tarea 39, fase 1):
// el inverso del vínculo dispositivosAfectados. Se oculta si no hay
// ninguno, para no dejar una sección vacía en la ficha. Re-autorizado
// a Nocturne: filas de la lista "Resolver con este equipo" (icono en
// ámbar/precaución, título y primer síntoma, chevron).
export function ProblemasDelEquipo({ dispositivoId }: { dispositivoId: string }) {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const problemas = useMemo(
    () => problemasDeDispositivo(articulos, dispositivoId),
    [articulos, dispositivoId],
  )

  if (problemas.length === 0) return null

  return (
    <>
      {problemas.map((articulo) => (
        <Link
          key={articulo.id}
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
      ))}
    </>
  )
}
