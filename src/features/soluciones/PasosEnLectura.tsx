import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'
import { normalizarProcedimiento, tareasDe } from '../../lib/procedimiento'

// LO QUE HACE UN PASO QUE REUTILIZA OTRA GUÍA, PARA LEERLO (tarea 289,
// fase 3).
//
// Cuando ese paso se CONSULTA (abierto desde el índice, más adelante que
// el de trabajo) o se REVISA ya hecho (con "Anterior"), no se ejecuta
// nada: se lee lo que el paso pide, con los títulos y las acciones de la
// guía reutilizada, sin casillas, sin numeración propia (la del paso es
// la de la guía que se abrió) y sin decir de dónde salen.

export function PasosEnLectura({ guiaId }: { guiaId: string }) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(guiaId)) ?? null, [guiaId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  if (!procedimiento || procedimiento.pasos.length === 0) return null

  return (
    <ul aria-label="Lo que se hace en este paso" className="flex flex-col gap-3 rounded-xl border border-noct-divider bg-noct-surface px-4 py-3.5">
      {procedimiento.pasos.map((paso) => {
        const tareas = tareasDe(paso.bloques).filter((t) => t.texto.trim() !== '')
        return (
          <li key={paso.id} className="flex flex-col gap-1">
            {paso.titulo.trim() !== '' && (
              <p className="text-[15px] font-medium leading-snug text-pretty text-noct-text [overflow-wrap:anywhere]">
                {paso.titulo}
              </p>
            )}
            {tareas.length > 0 && (
              <ul className="flex flex-col gap-1">
                {tareas.map((tarea) => (
                  <li key={tarea.id} className="flex items-start gap-2.5 text-[14px] leading-snug text-noct-neutral-300">
                    <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-noct-neutral-500" />
                    <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">{tarea.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
