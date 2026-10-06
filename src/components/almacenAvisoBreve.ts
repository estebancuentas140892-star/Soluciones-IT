// EL AVISO BREVE (tarea 291, auditoría UX de Claude Design, sección 11,
// S6; sección 7, F7).
//
// El éxito era a veces mudo y a veces repetido: copiar confirmaba en el
// botón, guardar un formulario volvía a la ficha sin decir nada y, sin
// señal, no decía que el cambio quedaba pendiente. La regla aprobada:
//
// - **Solo si el resultado no se ve en pantalla.** Si la pantalla ya
//   demuestra que funcionó (el "Copiado" del botón, la estrella rellena,
//   el campo guardado en su sitio), no se repite.
// - **Una línea**, abajo, encima de las pestañas o de la barra de la
//   pantalla; se va sola a los **4 s**, **sin ×**.
// - Dice qué pasó y, sin señal, que se subirá solo ("Impresora Bodega
//   guardada · se subirá al recuperar señal").
// - "Cambiar" o "Deshacer" solo si existen.
//
// Un solo aviso a la vez: el nuevo sustituye al anterior. Se pide desde
// cualquier sitio con `avisarBreve()`, y `AvisosBreves` (AvisoBreve.tsx,
// montado una vez en la raíz de la app) lo pinta.

export const DURACION_AVISO_BREVE_MS = 4000

export interface AvisoBreve {
  texto: string
  // "Cambiar" o "Deshacer", solo si existen.
  accion?: { texto: string; onClick: () => void }
}

export type AvisoVigente = AvisoBreve & { id: number }

let vigente: AvisoVigente | null = null
let siguienteId = 1
const suscriptores = new Set<() => void>()

function emitir() {
  for (const escucha of suscriptores) escucha()
}

export function suscribirAvisoBreve(escucha: () => void): () => void {
  suscriptores.add(escucha)
  return () => {
    suscriptores.delete(escucha)
  }
}

export function avisoBreveVigente(): AvisoVigente | null {
  return vigente
}

export function avisarBreve(aviso: AvisoBreve): void {
  vigente = { ...aviso, id: siguienteId++ }
  emitir()
}

export function retirarAvisoBreve(): void {
  vigente = null
  emitir()
}
