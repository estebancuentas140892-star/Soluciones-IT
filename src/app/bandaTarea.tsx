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

// SEGUNDA RANURA, BAJO LA LÍNEA DE LA CABECERA COMPACTA (rediseño móvil "1b
// Pulgar", tarea 328). En la compacta, `BandaTarea` pinta en la MISMA fila
// que el título (el contador de paso). Los segmentos de la guía van debajo,
// dentro del mismo bloque pegajoso y sobre la misma superficie: un segmento
// por paso más el de la comprobación final. Mismo mecanismo y mismas
// garantías que la ranura de arriba.
//
// Tres estados: `undefined` cuando no hay cabecera compacta (la pantalla no
// la publica), `null` mientras su hueco todavía no se montó y el elemento
// cuando ya está.
const RanuraBajoContexto = createContext<HTMLElement | null | undefined>(undefined)

export const ProveedorBandaBajoTarea = RanuraBajoContexto.Provider

/**
 * Pinta `children` bajo la línea de la cabecera compacta del nivel tarea.
 * Sin cabecera compacta, nada; o, con `enLineaSinCabecera`, en su sitio
 * (la guía dentro de un diagnóstico guiado, que monta la cabecera normal,
 * conserva así sus segmentos en el cuerpo). Como función, `children` recibe
 * dónde va a pintarse, para ajustar su margen.
 */
export function BandaBajoTarea({
  children,
  enLineaSinCabecera = false,
}: {
  children: ReactNode | ((enCabecera: boolean) => ReactNode)
  enLineaSinCabecera?: boolean
}) {
  const ranura = useContext(RanuraBajoContexto)
  const contenido = (enCabecera: boolean) => (typeof children === 'function' ? children(enCabecera) : children)
  if (ranura === undefined) return enLineaSinCabecera ? contenido(false) : null
  if (ranura === null) return null
  return createPortal(contenido(true), ranura)
}
