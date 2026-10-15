import { createContext, useContext } from 'react'

// TERCERA RANURA, EL ÍNDICE PERSISTENTE (tarea 339, T5; handoff de tableta y
// escritorio). Desde 1280 px la ejecución de una guía enseña sus pasos en una
// columna fija de 280 a la izquierda, en vez de abrirlos en un panel: "lo
// único persistente es lo que orienta". El chasis publica la columna solo
// en el nivel tarea `amplio` y solo desde 1280 (es un punto de montaje, se
// decide con `useEsAncho`); quien tiene los pasos (`AsistenteVista`) pinta
// ahí su índice por portal. Sin ranura (teléfono, tableta, una guía dentro
// de un diagnóstico), `null`: el índice sigue en su panel.
const RanuraIndiceContexto = createContext<HTMLElement | null>(null)

export const ProveedorRanuraIndice = RanuraIndiceContexto.Provider

/** La columna del índice persistente, o `null` si esta ventana no la tiene. */
export function useRanuraIndice(): HTMLElement | null {
  return useContext(RanuraIndiceContexto)
}
