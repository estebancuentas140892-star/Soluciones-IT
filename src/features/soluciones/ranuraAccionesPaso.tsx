import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Ranura para la barra de "añadir" del editor de pasos (handoff
// "Diseño móvil", tablero 6b).
//
// El problema de dueño del dato es el mismo que ya resolvió
// `src/app/bandaTarea.tsx`: los cuatro botones de añadir (Tarea, Aviso,
// Foto, Reusar) tienen que vivir en la barra fija del pie, que la monta
// `ArticuloForm`, pero saben del paso activo y de cómo se crea un
// bloque, que es cosa de `PasosEditor`. Subir ese estado al formulario
// obligaría a llevarse también la creación de bloques; poner una
// segunda barra fija con un `bottom` calculado a mano contra el alto de
// la de `ArticuloForm` (que cambia con las sugerencias de completitud
// abiertas) sería peor.
//
// Así que el formulario publica un hueco dentro de su propia barra y el
// editor lo llena por portal. Una sola barra fija, sin medir nada.
//
// Por qué la barra y no los botones dentro de la tarjeta: en el editor
// anterior los cuatro "Agregar" iban en un `flex-wrap` al final del
// cuerpo del paso, con `px-1 py-[7px]` e icono de 13, es decir 31 px de
// alto: los controles MÁS usados al escribir una guía eran los objetivos
// MÁS pequeños de la pantalla, y además se movían de sitio según lo
// largo que fuera el paso.

const RanuraContexto = createContext<HTMLElement | null>(null)

export const ProveedorAccionesPaso = RanuraContexto.Provider

/**
 * Pinta `children` dentro de la barra fija del editor de artículo, sobre
 * la fila de completitud. Fuera de esa barra no dibuja nada (no falla).
 */
export function AccionesPaso({ children }: { children: ReactNode }) {
  const ranura = useContext(RanuraContexto)
  if (!ranura) return null
  return createPortal(children, ranura)
}
