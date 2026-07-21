import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../lib/db'
import { construirGrafo, type Arista } from '../lib/grafo'

// Grafo de referencias en memoria, reconstruido cuando cambian los datos
// locales (edición o sincronización), igual que el índice de búsqueda.
// Para un equipo de 5 técnicos el volumen es pequeño y recorrerlo es
// instantáneo. Lo comparten el bloque "Referenciado por" de las fichas y
// el aviso de impacto antes de eliminar, así ambos ven exactamente las
// mismas relaciones sin duplicar la lógica de recorrido.
export function useGrafo(): Arista[] {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const diagnosticos = useLiveQuery(() => db.diagnosticos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  // Solo llegan aqui las filas que la RLS descargo (permiso de boveda).
  const camposProtegidos = useLiveQuery(
    () => db.campos_protegidos.filter((c) => !c.eliminadoEn).toArray(),
    [],
    [],
  )

  return useMemo(
    () => construirGrafo({ articulos, dispositivos, credenciales, diagnosticos, conexiones, camposProtegidos }),
    [articulos, dispositivos, credenciales, diagnosticos, conexiones, camposProtegidos],
  )
}
