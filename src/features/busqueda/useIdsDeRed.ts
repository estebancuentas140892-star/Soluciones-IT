import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../lib/db'

/**
 * Los ids de los equipos de red (los de una categoría con `esRed`), para
 * separar "Red" de "Equipos" en los chips de alcance.
 */
export function useIdsDeRed(): ReadonlySet<string> {
  const categoriasDeRed = useLiveQuery(
    async () => new Set((await db.categorias.toArray()).filter((c) => c.esRed).map((c) => c.id)),
    [],
    new Set<string>(),
  )
  const dispositivos = useLiveQuery(() => db.dispositivos.toArray(), [], [])
  return useMemo(
    () => new Set(dispositivos.filter((d) => categoriasDeRed.has(d.categoriaId)).map((d) => d.id)),
    [dispositivos, categoriasDeRed],
  )
}
