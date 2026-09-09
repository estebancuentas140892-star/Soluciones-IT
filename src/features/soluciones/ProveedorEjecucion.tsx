import { useMemo, type ReactNode } from 'react'
import { ContextoEjecucion } from './contextoEjecucion'

// Abre una ejecucion para todo lo que quede dentro (encargo del
// 2026-09-09, tarea 2): la guia principal y, con ella, el avance de
// todas sus guias vinculadas, que vive en la fila de `raizId` y no en
// la de cada vinculado.
//
// Vive en su propio archivo por la regla de fast refresh: el resto del
// modulo son hooks y funciones puras, y mezclarlos con un componente
// rompe la recarga en caliente del editor.
export function ProveedorEjecucion({ raizId, children }: { raizId: string; children: ReactNode }) {
  const valor = useMemo(() => ({ raizId }), [raizId])
  return <ContextoEjecucion.Provider value={valor}>{children}</ContextoEjecucion.Provider>
}
