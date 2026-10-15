// LO QUE DICE LA PANTALLA FINAL DE UNA GUÍA EN EL TELÉFONO (tarea 341,
// handoff móvil "1b Pulgar"): qué se terminó, dónde, cuánto fue y cuándo.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * "Cambiar el tóner en POSPN01. 4 pasos y 2 comprobaciones." Sin equipo, sin
 * el "en"; sin comprobación final, solo los pasos.
 */
export function resumenDeGuiaCompletada(
  titulo: string,
  equipo: string | null,
  pasos: number,
  comprobaciones: number,
): string {
  const donde = titulo ? (equipo ? `${titulo} en ${equipo}. ` : `${titulo}. `) : ''
  const deLosPasos = `${pasos} ${pasos === 1 ? 'paso' : 'pasos'}`
  const deLasComprobaciones =
    comprobaciones > 0 ? ` y ${comprobaciones} ${comprobaciones === 1 ? 'comprobación' : 'comprobaciones'}` : ''
  return `${donde}${deLosPasos}${deLasComprobaciones}.`
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
