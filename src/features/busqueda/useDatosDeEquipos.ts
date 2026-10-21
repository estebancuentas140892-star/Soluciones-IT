import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'

/** Lo que la fila de un equipo enseña además de su nombre y su contexto. */
export interface DatosDeEquipo {
  /** Su IP, o '' si no la tiene. */
  ip: string
  /**
   * El nombre de su categoría ("Impresoras", "POS"), o '' si no se sabe.
   * Decide el icono de la fila en el teléfono (tarea 349), el mismo que en
   * la lista de Equipos (`tipoDeNodoVisual`).
   */
  categoriaNombre: string
}

/**
 * La IP de cada equipo, por su id (tarea 342, anatomía de la fila del
 * handoff móvil "1b Pulgar": la IP técnica a la derecha, en IBM Plex Mono). Se
 * lee de la copia local como `useIdsDeRed`, sin tocar el índice: la IP ya se
 * busca (va en la identidad del equipo), solo que no se veía. Desde la tarea
 * 349 también el nombre de su categoría, para que la fila diga con su icono
 * qué clase de equipo es (una impresora no se dibuja como un computador).
 */
export function useDatosDeEquipos(): ReadonlyMap<string, DatosDeEquipo> {
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  return useMemo(() => {
    const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))
    return new Map(
      dispositivos.map(
        (d) => [d.id, { ip: (d.ip ?? '').trim(), categoriaNombre: nombreCategoria.get(d.categoriaId) ?? '' }] as const,
      ),
    )
  }, [dispositivos, categorias])
}
