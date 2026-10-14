// EL ANCHO DE TELÉFONO (tarea 338: el rediseño "1b Pulgar" es solo móvil).
//
// El rediseño móvil vale por debajo de 768 px, el `md` de Tailwind y el
// mismo corte que separa el teléfono en el Chasis (767 todavía es teléfono;
// 768 ya no). Casi todo se resuelve en CSS (`@media (width < 48rem)` en
// src/index.css y variantes `md:` en cada componente); esto es para lo poco
// que tiene que decidirse en JavaScript con el MISMO corte: el color de la
// barra del navegador del tema claro y dónde va el buscador de una raíz
// (abajo, en el dock, solo en el teléfono).
//
// Sin `matchMedia` (un entorno sin ventana) se considera teléfono: la app
// se diseña primero para él.
export const CONSULTA_TELEFONO = '(width < 48rem)'

export function esAnchoTelefono(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(CONSULTA_TELEFONO).matches
}

/** Avisa cada vez que el ancho cruza el corte de 768 px. Devuelve cómo dejar de escuchar. */
export function suscribirAnchoTelefono(avisar: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const consulta = window.matchMedia(CONSULTA_TELEFONO)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}
