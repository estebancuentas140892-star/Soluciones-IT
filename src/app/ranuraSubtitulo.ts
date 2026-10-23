import { createContext, useContext } from 'react'

// EL HUECO BAJO EL TÍTULO DE LA GUÍA EN EL TELÉFONO (tarea 351; ver
// `bandaTarea.tsx`). Vive aparte, como `ranuraBajoContexto.ts`, para que el
// archivo de los componentes solo exporte componentes.
//
// El elemento cuando la cabecera de la guía en el teléfono lo montó; null si
// no existe (desde 768 px, o cualquier otra cabecera).
export const RanuraSubtitulo = createContext<HTMLElement | null>(null)

/**
 * ¿Hay hueco bajo el título? Si no, quien tenía que pintar ahí (la línea
 * «Ventana 2 de 4») lo pinta donde iba antes.
 */
export function useHaySubtituloTarea(): boolean {
  return useContext(RanuraSubtitulo) !== null
}
