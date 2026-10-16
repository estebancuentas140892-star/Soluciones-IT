import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'

/** Lo que la fila de un equipo enseña además de su nombre y su contexto. */
export interface DatosDeEquipo {
  /** Su IP, o '' si no la tiene. */
  ip: string
}

/**
 * La IP de cada equipo, por su id (tarea 342, anatomía de la fila del
 * handoff móvil "1b Pulgar": la IP técnica a la derecha, en IBM Plex Mono). Se
 * lee de la copia local como `useIdsDeRed`, sin tocar el índice: la IP ya se
 * busca (va en la identidad del equipo), solo que no se veía.
 */
export function useDatosDeEquipos(): ReadonlyMap<string, DatosDeEquipo> {
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  return useMemo(() => new Map(dispositivos.map((d) => [d.id, { ip: (d.ip ?? '').trim() }] as const)), [dispositivos])
}
