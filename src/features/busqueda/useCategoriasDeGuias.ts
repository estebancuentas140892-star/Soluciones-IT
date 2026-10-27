import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Articulo } from '../../lib/db'

/**
 * El nombre de la categoría de cada guía (con pasos o con preguntas), por su
 * id (tarea 350). Decide el «Icono de categoría» de su tarjeta en los
 * resultados del teléfono: una guía de impresoras se reconoce como tal antes
 * de leer su título. Se lee de la copia local, como `useDatosDeEquipos`, sin
 * tocar el índice ni el orden.
 */
export function useCategoriasDeGuias(): ReadonlyMap<string, string> {
  const articulos = useLiveQuery(() => db.articulos.toArray(), [], [])
  const diagnosticos = useLiveQuery(() => db.diagnosticos.toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])
  return useMemo(() => {
    const nombre = new Map(categorias.map((c) => [c.id, c.nombre]))
    return new Map([
      ...articulos.map((a) => [a.id, nombre.get(a.categoriaId) ?? ''] as const),
      ...diagnosticos.map((d) => [d.id, nombre.get(d.categoriaId) ?? ''] as const),
    ])
  }, [articulos, diagnosticos, categorias])
}

/**
 * Cada guía con pasos por su id (tarea 358): en el teléfono, su tarjeta en los
 * resultados es la del catálogo (`TarjetaGuiaTelefono`), que necesita el tipo,
 * la situación, «Aplica a» y la medida. Se lee de la copia local, sin tocar el
 * índice ni el orden. Solo se lee con `activa` (el teléfono): desde 768 la
 * fila de siempre no la necesita.
 */
export function useArticulosDeGuias(activa = true): ReadonlyMap<string, Articulo> {
  const articulos = useLiveQuery(() => (activa ? db.articulos.toArray() : []), [activa], [])
  return useMemo(() => new Map(articulos.map((articulo) => [articulo.id, articulo])), [articulos])
}
