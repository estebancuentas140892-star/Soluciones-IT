import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Ranura pegajosa del nivel tarea del chasis (auditoría móvil del
// 2026-08-03, hallazgo M-010, regla M-R1).
//
// `BarraTarea` ya es un bloque pegajoso que dice qué se está haciendo y
// a dónde se vuelve, y admite una banda propia debajo. El problema es de
// dueño del dato: la banda que el modo ejecución necesita ("Paso 3 de 7
// · Sustituir el cartucho", con su progreso) depende del paso actual,
// que vive dentro de `AsistenteVista`, varios niveles por debajo del
// `Chasis` que monta la barra.
//
// Las dos salidas malas eran subir todo el estado del asistente a la
// pantalla (un componente de 600 líneas que además se anida en sí mismo)
// o poner un segundo bloque pegajoso con un `top` calculado a mano
// contra el alto medido de la barra, que cambia con el largo del título.
// Esta ranura evita las dos: el chasis publica un hueco dentro de su
// propio bloque pegajoso y quien tenga el dato lo llena por portal. Un
// solo bloque, un solo `sticky`, sin medir nada.

const RanuraContexto = createContext<HTMLElement | null>(null)

export const ProveedorBandaTarea = RanuraContexto.Provider

/**
 * Pinta `children` dentro del bloque pegajoso de la barra de tarea, bajo
 * el título. Fuera del nivel tarea del chasis no dibuja nada (no falla):
 * el mismo componente puede montarse en una pantalla de documento.
 */
export function BandaTarea({ children }: { children: ReactNode }) {
  const ranura = useContext(RanuraContexto)
  if (!ranura) return null
  return createPortal(children, ranura)
}
