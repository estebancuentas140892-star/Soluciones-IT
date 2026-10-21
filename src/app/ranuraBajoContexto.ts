import { createContext, useContext } from 'react'

// EL HUECO BAJO LA LÍNEA DE LA CABECERA COMPACTA (ver `bandaTarea.tsx`).
//
// Tres estados: `undefined` cuando no hay cabecera compacta (la pantalla no
// la publica), `null` mientras su hueco todavía no se montó y el elemento
// cuando ya está.
export const RanuraBajoContexto = createContext<HTMLElement | null | undefined>(undefined)

/**
 * ¿Hay cabecera compacta del nivel tarea donde pintar? Solo entonces lo que
 * `BandaBajoTarea` recibe (el paso en la cabecera, los segmentos) se ve en
 * ella; sin ella, la pantalla tiene que decir ese dato en su propio cuerpo.
 */
export function useHayCabeceraCompacta(): boolean {
  const ranura = useContext(RanuraBajoContexto)
  return ranura !== undefined && ranura !== null
}
