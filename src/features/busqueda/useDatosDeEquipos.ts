import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'
import { esDeBaja } from '../personas/cicloPersona'

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

/** Lo que la fila de una persona enseña además de su nombre (tarea 362). */
export interface DatosDePersona {
  /** Su área ("Compras"), o '' si no se sabe. */
  area: string
  /** Cuántos equipos vigentes tiene a su nombre (sin los dados de baja). */
  equipos: number
}

/**
 * El área y los equipos de cada persona, por su id (tarea 362, prototipo de
 * Claude Design: «Compras · 2 equipos»). Antes la fila decía solo «Persona»,
 * que su grupo ya dice. Se lee de la copia local, sin tocar el índice.
 */
export function useDatosDePersonas(): ReadonlyMap<string, DatosDePersona> {
  const personas = useLiveQuery(() => db.personas.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  return useMemo(() => {
    const equipos = new Map<string, number>()
    for (const d of dispositivos) {
      if (!d.responsableId || d.eliminadoEn || esDeBaja(d)) continue
      equipos.set(d.responsableId, (equipos.get(d.responsableId) ?? 0) + 1)
    }
    return new Map(personas.map((p) => [p.id, { area: (p.area ?? '').trim(), equipos: equipos.get(p.id) ?? 0 }] as const))
  }, [personas, dispositivos])
}
