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
// Esto NO es un gestor de tareas ni un calendario. Es una vista derivada de
// datos que ya existen, agrupada por la única dimensión que el técnico usa
// para decidir: la fecha. Desde la tarea 365 (D5 de la auditoría del
// 2026-10-27, AD-100) existe una entidad mínima «tarea» (qué, fecha y
// equipo opcionales, nota y hecha): entra aquí por su fecha, como lo demás.
//
// Seis grupos, y cada ítem cae en UNO SOLO (nada se duplica):
//   - vencidos     fecha pasada
//   - hoy          fecha de hoy
//   - proximos     fecha futura dentro del periodo de aviso del sistema
//   - sinFecha     las tareas propias sin fecha (tarea 365)
//   - enCurso      las guías en preparación: borradores propios. Desde la
//                  tarea 365 (D7) no cuentan como pendientes ni llevan la
//                  guía a medias, que se queda en «Sigue donde ibas».
//   - porRevisar   asuntos del EQUIPO: sugerencias de diagnóstico sin
//                  convertir en artículo, equipos liberados, personas
//                  retiradas con equipos

export interface Agenda {
  vencidos: ItemPendiente[]
  hoy: ItemPendiente[]
  proximos: ItemPendiente[]
  sinFecha: ItemPendiente[]
  enCurso: ItemPendiente[]
  porRevisar: ItemPendiente[]
}

export const AGENDA_VACIA: Agenda = {
  vencidos: [],
  hoy: [],
  proximos: [],
  sinFecha: [],
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
  const agenda: Agenda = { vencidos: [], hoy: [], proximos: [], sinFecha: [], enCurso: [], porRevisar: [] }
  for (const item of items) {
    if (item.diasRestantes !== null) {
      if (item.diasRestantes < 0) agenda.vencidos.push(item)
      else if (item.diasRestantes === 0) agenda.hoy.push(item)
      else agenda.proximos.push(item)
      continue
    }
    // Un borrador es trabajo propio a medias, no una obligación con
    // plazo: nunca cae en "Vencidos" ni en "Para hoy".
    if (item.categoria === 'tarea') agenda.sinFecha.push(item)
    else if (item.categoria === 'borrador') agenda.enCurso.push(item)
    else agenda.porRevisar.push(item)
  }
  return agenda
}

/**
 * Lo que cuenta «Agenda completa» (tarea 365, D7): lo que tiene fecha y las
 * tareas sin fecha. Las guías en preparación y lo que el equipo deja por
 * revisar se ven en la Agenda, plegados, pero no son pendientes propios.
 */
export function totalDeAgenda(agenda: Agenda): number {
  return agenda.vencidos.length + agenda.hoy.length + agenda.proximos.length + agenda.sinFecha.length
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
/**
 * Solo lo urgente, en una línea: "1 vencido · 2 para hoy". Es lo único
 * de la agenda que sigue asomando en Inicio desde el 2026-09-17: Inicio
 * es para resolver con guías, y la agenda completa vive en su pantalla.
 * Cadena vacía si no hay nada urgente.
 */
export function resumenUrgente(agenda: Agenda): string {
  return [
    frase(agenda.vencidos.length, 'vencido', 'vencidos'),
    frase(agenda.hoy.length, 'para hoy', 'para hoy'),
  ]
    .filter((parte): parte is string => parte !== null)
    .join(' · ')
}

export function fechaDeHoy(hoy: Date = new Date()): string {
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(hoy)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// ----------------------------------------------------------------
// ESTADO Y ACCIÓN DE CADA FILA (encargo del 2026-09-20, tarea 3)
// ----------------------------------------------------------------
//
// Un ítem de la agenda ya dice su fecha ("Venció hace 3 días", "Vence el
// 18 sep"), pero la fecha sola no distingue de un vistazo lo que hay que
// resolver YA de lo que solo hay que tener en cuenta. Cada grupo tiene
// su estado escrito con una palabra, y cada fila la acción que le
// corresponde, para que "qué hago con esto" no haya que deducirlo.

export type EstadoAgenda = 'vencido' | 'hoy' | 'proximo' | 'sinFecha' | 'enCurso' | 'porRevisar'

/** La palabra que se pinta en la fila. Una sola, en singular: describe ESE ítem. */
export const ETIQUETA_ESTADO: Record<EstadoAgenda, string> = {
  vencido: 'Vencido',
  hoy: 'Hoy',
  proximo: 'Próximo',
  sinFecha: 'Sin fecha',
  enCurso: 'En preparación',
  porRevisar: 'Por revisar',
}

/**
 * Qué se hace con este ítem, dicho en un verbo: un borrador propio se
 * CONTINÚA; una sugerencia del equipo, un equipo liberado que espera
 * dueño y una persona retirada con equipos se REVISAN; un acceso con
 * fecha o una persona que ingresa se ABREN (para atenderlos donde
 * viven). Es el nombre accesible del enlace de la fila, así que
 * "Continuar «Guía a medias»" se lee entero.
 */
export function accionDeItem(item: ItemPendiente): string {
  // Una tarea propia se abre para editarla (su fila además la marca hecha).
  if (item.categoria === 'tarea') return 'Editar'
  if (item.categoria === 'borrador') return 'Continuar'
  if (item.categoria === 'sugerencia' || item.categoria === 'equipo_liberado' || item.categoria === 'persona_retirada') {
    return 'Revisar'
  }
  return 'Abrir'
}

/** "Ver el otro" / "Ver los otros 4": el desplegable también concuerda. */
export function textoVerOtros(ocultos: number): string {
  return ocultos === 1 ? 'Ver el otro' : `Ver los otros ${ocultos}`
}
