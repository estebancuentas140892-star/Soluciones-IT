import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { comoHacerDe } from '../../lib/comoHacer'
import { db } from '../../lib/db'
import { normalizarProcedimiento, tareasDe } from '../../lib/procedimiento'
import { resultadoVisualDe } from '../../lib/resultadoVisual'
import { rutaDe } from '../../lib/rutaProcedimiento'
import { useAvanceProgreso, useClaveVinculo } from './contextoEjecucion'
import { ComoHacerlo, DebesVer } from './SenalesDePaso'

// LO QUE HACE UN PASO QUE REUTILIZA OTRA GUÍA, PARA LEERLO (tarea 289,
// fase 3).
//
// Cuando ese paso se CONSULTA (abierto desde el índice, más adelante que
// el de trabajo) o se REVISA ya hecho (con "Anterior"), no se ejecuta
// nada: se lee lo que el paso pide, con los títulos y las acciones de la
// guía reutilizada, sin casillas, sin numeración propia (la del paso es
// la de la guía que se abrió) y sin decir de dónde salen.
//
// Solo los pasos de SU RUTA (tarea 302): si la guía reutilizada tiene
// decisiones con opciones, los del camino que se eligió en esta ejecución,
// y sin respuesta, hasta la pregunta. Los del otro camino no se leen aquí
// como no se recorren allí.

export function PasosEnLectura({ guiaId }: { guiaId: string }) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(guiaId)) ?? null, [guiaId])
  const progreso = useAvanceProgreso(useClaveVinculo(guiaId))
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  if (!procedimiento || procedimiento.pasos.length === 0) return null
  const ruta = rutaDe(procedimiento, progreso?.elecciones)

  return (
    <ul aria-label="Lo que se hace en este paso" className="flex flex-col gap-3 rounded-xl border border-noct-divider bg-noct-surface px-4 py-3.5">
      {ruta.pasos.map((paso) => {
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
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-pretty [overflow-wrap:anywhere]">{tarea.texto}</span>
                      {/* Su "Cómo hacerlo" (tarea 303) y su "Debes ver" (tarea
                          307), bajo la acción: la misma ruta rápida, el mismo
                          paso a paso y la misma imagen plegada que en el
                          flujo. */}
                      <ComoHacerlo microPasos={comoHacerDe(tarea)} variante="lectura" />
                      <DebesVer resultado={resultadoVisualDe(tarea)} variante="lectura" />
                    </div>
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
