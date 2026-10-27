import { createContext, useContext } from 'react'
import { avisarConDeshacer } from '../../components/avisosFlotantes'
import { db } from '../../lib/db'
import { guardarRegistro } from '../../lib/repositorio'

// LA HOJA DE LAS TAREAS, AL ALCANCE DE CUALQUIER FILA (tarea 365, D5).
//
// «Nueva» en la cabecera de «Tu trabajo de hoy», «Nueva tarea» en la Agenda
// y tocar una tarea para editarla abren la MISMA hoja. La monta una vez la
// pantalla (`ProveedorHojaTarea`), y las filas, que viven dentro de
// componentes compartidos (`FilaAgenda`, `SeccionesAgenda`), la piden por
// contexto en vez de recibir callbacks por cada nivel.

export interface ValorHojaTarea {
  /** Abre la hoja vacía: «Nueva tarea». */
  nueva: () => void
  /** Abre la hoja con una tarea para editarla. */
  editar: (tareaId: string) => void
}

export const ContextoHojaTarea = createContext<ValorHojaTarea | null>(null)

/** La hoja de esta pantalla, o null si la pantalla no la monta (no hay «Nueva»). */
export function useHojaTarea(): ValorHojaTarea | null {
  return useContext(ContextoHojaTarea)
}

/**
 * MARCAR HECHA (tarea 365): la tarea sale de la lista y el aviso ofrece
 * «Deshacer», que la devuelve tal como estaba. No queda historial a la vista
 * ni constancia en la ficha del equipo (pregunta abierta de la auditoría,
 * decidida así para esta fase): `hechaEn` solo la saca de la Agenda.
 */
export async function marcarTareaHecha(tareaId: string): Promise<void> {
  const tarea = await db.tareas.get(tareaId)
  if (!tarea || tarea.hechaEn) return
  await guardarRegistro('tareas', { ...tarea, hechaEn: new Date().toISOString() })
  avisarConDeshacer(`Hecha: ${tarea.titulo}`, () => {
    void guardarRegistro('tareas', { ...tarea, hechaEn: null })
  })
}
