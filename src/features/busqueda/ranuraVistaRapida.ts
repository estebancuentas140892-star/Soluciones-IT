import { createContext, useContext } from 'react'

// LA VISTA RÁPIDA EN SU PANEL (tarea 339, T6; handoff de tableta y
// escritorio). Por debajo de 1280 la vista rápida de un resultado se
// despliega en la lista, bajo su fila. Desde 1280 la paleta del buscador
// global publica a la derecha de la lista una columna de 380 y la fila pinta
// ahí su vista por portal: la lista no se mueve y se compara de un vistazo.
// Es la misma vista, con sus mismas acciones y la misma regla de una a la
// vez; solo cambia dónde se pinta. Sin columna (el teléfono, la tableta,
// Resolver), `null`: en línea, como siempre.
const RanuraVistaRapidaContexto = createContext<HTMLElement | null>(null)

export const ProveedorRanuraVistaRapida = RanuraVistaRapidaContexto.Provider

/** La columna de la vista rápida de la paleta, o `null` si no la hay. */
export function useRanuraVistaRapida(): HTMLElement | null {
  return useContext(RanuraVistaRapidaContexto)
}
