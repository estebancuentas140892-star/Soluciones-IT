import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type HistorialEntrada } from '../../lib/db'
import {
  CAMPO_ASIGNACION,
  periodosDeAsignacion,
  responsablesAnteriores,
  type PeriodoAsignacion,
} from './historialAsignaciones'

// Las entradas de asignación de UN equipo (el id del responsable, tarea
// 266), leídas por el índice [entidadTipo+entidadId]: la ficha del equipo
// no recorre el historial entero.
export function useEntradasDeAsignacion(dispositivoId: string): HistorialEntrada[] {
  return useLiveQuery(
    () =>
      db.historial
        .where('[entidadTipo+entidadId]')
        .equals(['dispositivo', dispositivoId])
        .filter((e) => e.campo === CAMPO_ASIGNACION)
        .toArray(),
    [dispositivoId],
    [],
  )
}

/**
 * Quién tuvo el equipo antes, según el historial, del más reciente al más
 * antiguo. Hook aparte para que la ficha pueda contarlos en la cabecera
 * plegada de "Más datos del equipo" (M-R4: plegar informa).
 */
export function useResponsablesAnteriores(dispositivoId: string): PeriodoAsignacion[] {
  const entradas = useEntradasDeAsignacion(dispositivoId)
  return useMemo(() => responsablesAnteriores(dispositivoId, periodosDeAsignacion(entradas)), [dispositivoId, entradas])
}
