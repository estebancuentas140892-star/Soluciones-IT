import type { ItemPendiente } from './pendientes'

// AGENDA OPERATIVA DE INICIO (encargo del 2026-09-11, tarea 2).
//
// Inicio era una colección de bloques sin relación: "Te toca a ti"
// mezclaba una clave vencida hace medio año con un borrador propio y
// con una sugerencia de otro técnico, todo con el mismo peso y bajo un
// rótulo que además mentía (una sugerencia del equipo no está asignada
// a nadie). Al entrar no se podía responder la única pregunta que
// importa a las 8 de la mañana: ¿qué tengo que hacer hoy?
//
// Esto NO es un gestor de tareas ni un calendario: no hay entidad
// "tarea" ni tabla de recordatorios. Es una vista derivada de datos que
// ya existen, agrupada por la única dimensión que el técnico usa para
// decidir: la fecha.
//
// Cinco grupos, y cada ítem cae en UNO SOLO (nada se duplica):
//   - vencidos     fecha pasada
//   - hoy          fecha de hoy
//   - proximos     fecha futura dentro del periodo de aviso del sistema
//   - enCurso      trabajo propio empezado: borradores (y, en la
//                  pantalla, la guía a medias)
//   - porRevisar   asuntos del EQUIPO: sugerencias de diagnóstico sin
//                  convertir en artículo

export interface Agenda {
  vencidos: ItemPendiente[]
  hoy: ItemPendiente[]
  proximos: ItemPendiente[]
  enCurso: ItemPendiente[]
  porRevisar: ItemPendiente[]
}

export const AGENDA_VACIA: Agenda = {
  vencidos: [],
  hoy: [],
  proximos: [],
  enCurso: [],
  porRevisar: [],
}

/**
 * Reparte los pendientes ya ordenados (ver `calcularPendientes`) en los
 * cinco grupos de la agenda. La fecha manda: lo que tiene fecha se
 * agrupa por ella y nunca por su procedencia; lo que no tiene fecha se
 * agrupa por a quién pertenece el trabajo.
 */
export function agruparAgenda(items: ItemPendiente[]): Agenda {
  const agenda: Agenda = { vencidos: [], hoy: [], proximos: [], enCurso: [], porRevisar: [] }
  for (const item of items) {
    if (item.diasRestantes !== null) {
      if (item.diasRestantes < 0) agenda.vencidos.push(item)
      else if (item.diasRestantes === 0) agenda.hoy.push(item)
      else agenda.proximos.push(item)
      continue
    }
    // Un borrador es trabajo propio a medias, no una obligación con
    // plazo: nunca cae en "Vencidos" ni en "Para hoy".
    if (item.categoria === 'borrador') agenda.enCurso.push(item)
    else agenda.porRevisar.push(item)
  }
  return agenda
}

/**
 * Lo que de verdad urge hoy: vencidos y con fecha de hoy. Nada más.
 * Un borrador propio, una sugerencia del equipo o una clave que vence
 * dentro de tres semanas no son urgencias, y contarlas como tales
 * enseña al técnico a ignorar el aviso.
 */
export function asuntosUrgentes(agenda: Agenda): number {
  return agenda.vencidos.length + agenda.hoy.length
}

function frase(cantidad: number, singular: string, plural: string): string | null {
  if (cantidad === 0) return null
  return `${cantidad} ${cantidad === 1 ? singular : plural}`
}

/**
 * Resumen de una línea: "2 vencidos · 1 para hoy · 3 próximos". Las
 * categorías vacías no se nombran (decir "0 vencidos" es ruido que hay
 * que leer para descartarlo). Cadena vacía si no hay nada con fecha.
 */
export function resumenAgenda(agenda: Agenda): string {
  return [
    frase(agenda.vencidos.length, 'vencido', 'vencidos'),
    frase(agenda.hoy.length, 'para hoy', 'para hoy'),
    frase(agenda.proximos.length, 'próximo', 'próximos'),
  ]
    .filter((parte): parte is string => parte !== null)
    .join(' · ')
}

// Fecha de hoy tal como la escribiría alguien en Colombia: "viernes, 11
// de septiembre". Se pone en Inicio porque una agenda sin su día es un
// listado; con él, el técnico sabe respecto a qué se dice "hoy".
export function fechaDeHoy(hoy: Date = new Date()): string {
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(hoy)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
