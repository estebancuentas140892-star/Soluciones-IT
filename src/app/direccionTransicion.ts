import { esRaizDePestana } from '../lib/navegacion'

export type Direccion = 'entra' | 'vuelve' | 'lateral'

function profundidad(pathname: string): number {
  return pathname.split('/').filter(Boolean).length
}

// Memoria de la última navegación PROCESADA, a nivel de módulo: Chasis
// se desmonta y se vuelve a montar en cada navegación (cada pantalla
// instancia el suyo), así que un `useRef` no sobreviviría de una
// pantalla a la siguiente. Se indexa por `location.key` (no por cuántas
// veces se renderiza) para que sea segura bajo `StrictMode`: React monta,
// desmonta y vuelve a montar cada componente una vez en desarrollo, y
// las dos pasadas comparten el mismo `location.key` porque es la MISMA
// navegación. Sin esta memoización por clave, la segunda pasada vería la
// ruta anterior ya actualizada por la primera y calcularía "lateral" para
// todo, un falso negativo que solo se nota en desarrollo.
let procesada: { key: string; pathname: string; direccion: Direccion } | null = null

// Dirección de la transición de entrada según la jerarquía (R21): más
// profundo es "entra" (bajaste un nivel), menos profundo es "vuelve"
// (subiste), y cambiar entre raíces de pestaña siempre es "lateral"
// (te moviste al lado, no hacia dentro ni hacia afuera) aunque sus
// rutas tengan distinta cantidad de segmentos (`/` y `/soluciones`).
export function direccionPara(location: { pathname: string; key: string }): Direccion {
  if (procesada && procesada.key === location.key) return procesada.direccion

  const anterior = procesada?.pathname ?? null
  let direccion: Direccion = 'lateral'
  if (anterior !== null && anterior !== location.pathname) {
    if (esRaizDePestana(anterior) && esRaizDePestana(location.pathname)) {
      direccion = 'lateral'
    } else {
      const profAnterior = profundidad(anterior)
      const profActual = profundidad(location.pathname)
      direccion = profActual > profAnterior ? 'entra' : profActual < profAnterior ? 'vuelve' : 'lateral'
    }
  }

  procesada = { key: location.key, pathname: location.pathname, direccion }
  return direccion
}
