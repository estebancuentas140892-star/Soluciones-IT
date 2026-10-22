// LO QUE DICE LA PANTALLA FINAL DE UNA GUÍA EN EL TELÉFONO (tarea 341,
// handoff móvil "1b Pulgar"): qué se terminó, dónde, cuánto fue y cuándo.
// Desde la tarea 350 (prototipo de Claude Design) cuánto fue va arriba, en su
// línea de mayúsculas, y qué y dónde debajo del título, sin repetir la cuenta.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * "4 ventanas · 2 comprobaciones", la línea sobre «Guía completada». Un paso,
 * en el teléfono, es una ventana. Sin comprobación final, solo las ventanas.
 */
export function cuentaDeGuiaCompletada(ventanas: number, comprobaciones: number): string {
  const deLasVentanas = `${ventanas} ${ventanas === 1 ? 'ventana' : 'ventanas'}`
  if (comprobaciones <= 0) return deLasVentanas
  return `${deLasVentanas} · ${comprobaciones} ${comprobaciones === 1 ? 'comprobación' : 'comprobaciones'}`
}

/** "Cambiar el tóner · POSPN01": la guía y con qué equipo; sin equipo, la guía. */
export function queYDondeDeGuiaCompletada(titulo: string, equipo: string | null): string {
  return [titulo, equipo].filter(Boolean).join(' · ')
}

/**
 * "15 oct 2026 · 9:41", la hora local en que quedó guardado el cierre. Vacía
 * si no hay fecha que decir.
 */
export function fechaHoraDeCierre(iso: string | undefined): string {
  if (!iso) return ''
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return ''
  const minutos = String(fecha.getMinutes()).padStart(2, '0')
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()} · ${fecha.getHours()}:${minutos}`
}
