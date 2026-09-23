import type { Categoria, Dispositivo, Ubicacion } from '../../lib/db'
import { esDeBaja } from '../personas/cicloPersona'
import { idsDescendientes } from './arbol'

// "¿QUÉ HAY AQUÍ?" (tarea 267, sección 12 del encargo del 2026-09-23).
//
// La ficha de una ubicación enseña lo que contiene agrupado por la
// CATEGORÍA real de cada equipo (Computadores, Impresoras, Switches,
// Puntos de red...), en el orden que el equipo ya dio a sus categorías.
// No se clasifica por parecido del nombre: el grupo es el dato que el
// técnico eligió al crear el equipo. Los de baja van aparte, al final:
// siguen estando en el lugar (su ficha se conserva), pero no son parte
// de lo que funciona ahí.
//
// Lógica pura, sin React ni base local, para poder probarla sola.

type EquipoContenido = Pick<Dispositivo, 'id' | 'nombre' | 'categoriaId' | 'ubicacionId' | 'estado' | 'eliminadoEn'>

export interface GrupoContenido<T> {
  categoriaId: string
  titulo: string
  equipos: T[]
}

export interface ContenidoUbicacion<T> {
  grupos: GrupoContenido<T>[]
  deBaja: T[]
  total: number
}

function porNombre<T extends { nombre: string }>(a: T, b: T): number {
  return a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
}

/** Los equipos que están directamente en la ubicación, agrupados por categoría. */
export function contenidoDeUbicacion<T extends EquipoContenido>(
  ubicacionId: string,
  dispositivos: T[],
  categorias: Pick<Categoria, 'id' | 'nombre' | 'orden'>[],
): ContenidoUbicacion<T> {
  const aqui = dispositivos.filter((d) => !d.eliminadoEn && d.ubicacionId === ubicacionId)
  const deBaja = aqui.filter((d) => esDeBaja(d)).sort(porNombre)
  const activos = aqui.filter((d) => !esDeBaja(d))

  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]))
  const porCategoria = new Map<string, T[]>()
  for (const d of activos) {
    const lista = porCategoria.get(d.categoriaId)
    if (lista) lista.push(d)
    else porCategoria.set(d.categoriaId, [d])
  }

  const grupos: GrupoContenido<T>[] = [...porCategoria.entries()]
    .map(([categoriaId, equipos]) => ({
      categoriaId,
      titulo: categoriaPorId.get(categoriaId)?.nombre ?? 'Sin categoría',
      equipos: equipos.sort(porNombre),
    }))
    .sort((a, b) => {
      const ordenA = categoriaPorId.get(a.categoriaId)?.orden ?? Number.MAX_SAFE_INTEGER
      const ordenB = categoriaPorId.get(b.categoriaId)?.orden ?? Number.MAX_SAFE_INTEGER
      return ordenA - ordenB || a.titulo.localeCompare(b.titulo, 'es')
    })

  return { grupos, deBaja, total: aqui.length }
}

/**
 * Cuántos equipos hay en la ubicación CONTANDO sus sububicaciones (una
 * sede con tres áreas cuenta los equipos de las tres). Solo los vivos;
 * los de baja cuentan, porque siguen estando ahí.
 */
export function totalConSububicaciones(
  ubicacionId: string,
  ubicaciones: Pick<Ubicacion, 'id' | 'padreId' | 'eliminadoEn'>[],
  dispositivos: Pick<Dispositivo, 'ubicacionId' | 'eliminadoEn'>[],
): number {
  const ids = idsDescendientes(ubicacionId, ubicaciones as Ubicacion[])
  return dispositivos.filter((d) => !d.eliminadoEn && d.ubicacionId !== null && ids.has(d.ubicacionId)).length
}
