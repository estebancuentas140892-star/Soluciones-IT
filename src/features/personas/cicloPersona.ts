import type { Dispositivo, EstadoPersona, Persona } from '../../lib/db'
import { estadoCanonico } from '../dispositivos/estados'

// CICLO DE VIDA DE UNA PERSONA Y DE LA ASIGNACIÓN DE SUS EQUIPOS
// (tarea 266, secciones 3 a 9 del encargo del 2026-09-23).
//
// Lógica pura, sin React ni base local, para poder probarla sola. Las
// escrituras viven en `operaciones.ts`; las pantallas solo deciden qué
// pedir.
//
// Dos verdades, cada una en un solo sitio:
//   - QUIÉN TIENE HOY un equipo: `dispositivos.responsableId`.
//   - QUIÉN LO TUVO: el historial (ver `historialAsignaciones.ts`).
// Nada de esto guarda una tercera copia.

type PersonaConEstado = Pick<Persona, 'estado'>

/**
 * El estado de la persona, leído con tolerancia: una fila guardada antes
 * de la tarea 266 (o descargada de una base sin la columna) no lo trae,
 * y entonces es 'activa', que es lo que era antes de que existiera.
 */
export function estadoDePersona(persona: PersonaConEstado): EstadoPersona {
  return persona.estado === 'retirada' ? 'retirada' : 'activa'
}

export function estaActiva(persona: PersonaConEstado): boolean {
  return estadoDePersona(persona) === 'activa'
}

type EquipoConEstado = Pick<Dispositivo, 'estado'>

/** "De baja" o un sinónimo reconocido ("Dado de baja"). */
export function esDeBaja(dispositivo: EquipoConEstado): boolean {
  return estadoCanonico(dispositivo.estado) === 'De baja'
}

type EquipoAsignable = Pick<Dispositivo, 'id' | 'nombre' | 'estado' | 'responsableId' | 'eliminadoEn'>

/**
 * Los equipos que la persona TIENE hoy. Un equipo de baja no cuenta
 * aunque conserve el vínculo (datos anteriores a la tarea 266, cuando la
 * baja no lo soltaba): ya no es de nadie, y su paso por la persona está
 * en el historial. Tampoco uno eliminado.
 */
export function equiposActuales<T extends EquipoAsignable>(personaId: string, dispositivos: T[]): T[] {
  return dispositivos
    .filter((d) => d.responsableId === personaId && !d.eliminadoEn && !esDeBaja(d))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
}

/**
 * Qué hacer con el estado de un equipo que se deja sin responsable.
 *
 * - 'si': funcionaba (Operativo) o ya estaba Disponible. Pasa a
 *   Disponible salvo que el técnico diga lo contrario.
 * - 'preguntar': su estado no dice si funciona (vacío, o un texto que no
 *   es de la lista). Se le ofrece marcarlo Disponible, sin darlo por
 *   hecho: el encargo prohíbe mover un equipo a un estado que su dato no
 *   dice.
 * - 'no': está en mantenimiento, fuera de servicio o de baja. Conserva
 *   su estado; "Disponible" diría que se puede entregar y no es cierto.
 */
export type SugerenciaDisponible = 'si' | 'preguntar' | 'no'

export function sugerirDisponible(estado: string): SugerenciaDisponible {
  const canonico = estadoCanonico(estado)
  if (canonico === 'Operativo' || canonico === 'Disponible') return 'si'
  if (canonico === null) return 'preguntar'
  return 'no'
}

/**
 * El estado con el que queda un equipo al asignarlo a alguien: un
 * Disponible pasa a Operativo (ya está en uso). Cualquier otro se
 * conserva tal cual, incluido el vacío: asignar no dice nada de si el
 * equipo funciona.
 */
export function estadoAlAsignar(estado: string): string {
  return estadoCanonico(estado) === 'Disponible' ? 'Operativo' : estado
}

// ----------------------------------------------------------------
// A quién se le puede asignar qué
// ----------------------------------------------------------------

/**
 * Grupo de un equipo en la lista de "Asignar equipo", en el orden en que
 * se ofrecen (sección 7 del encargo: primero los disponibles, luego los
 * que no tienen responsable y al final los que ya tiene otra persona).
 */
export type GrupoCandidato = 'disponible' | 'sinResponsable' | 'deOtraPersona'

export const ORDEN_GRUPOS: GrupoCandidato[] = ['disponible', 'sinResponsable', 'deOtraPersona']

export interface CandidatoAsignacion<T> {
  dispositivo: T
  grupo: GrupoCandidato
}

type EquipoCandidato = EquipoAsignable & Pick<Dispositivo, 'categoriaId'>

/**
 * Las categorías cuyos equipos ya se entregan a personas: las que tienen
 * al menos un equipo con responsable. Lo dicen los datos, no el nombre de
 * la categoría (no se adivina que "Portátiles" o "Equipos de cómputo"
 * sean computadores).
 */
export function categoriasQueSeAsignan(dispositivos: Pick<Dispositivo, 'categoriaId' | 'responsableId' | 'eliminadoEn'>[]): Set<string> {
  return new Set(dispositivos.filter((d) => !d.eliminadoEn && d.responsableId).map((d) => d.categoriaId))
}

/**
 * Los equipos que se le pueden asignar a una persona, agrupados y en
 * orden. Fuera quedan los eliminados, los de baja, los que ya tiene esta
 * misma persona y los de infraestructura de red (un switch o un punto de
 * red no se "entrega" a alguien); el buscador de la pantalla los sigue
 * encontrando si hiciera falta. Dentro de cada grupo, primero los de las
 * categorías que ya se entregan a personas (con 149 equipos, una
 * impresora o una cámara sin responsable no deben tapar a los
 * computadores), luego los que funcionan y luego por nombre.
 */
export function candidatosParaAsignar<T extends EquipoCandidato>(
  dispositivos: T[],
  personaId: string,
  categoriasDeRed: Set<string>,
  categoriasHabituales: Set<string> = new Set(),
): CandidatoAsignacion<T>[] {
  const candidatos: CandidatoAsignacion<T>[] = []
  for (const d of dispositivos) {
    if (d.eliminadoEn || esDeBaja(d) || d.responsableId === personaId) continue
    if (categoriasDeRed.has(d.categoriaId)) continue
    candidatos.push({ dispositivo: d, grupo: grupoDe(d) })
  }
  const habitual = (d: T) => (categoriasHabituales.has(d.categoriaId) ? 0 : 1)
  return candidatos.sort((a, b) => {
    const porGrupo = ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo)
    if (porGrupo !== 0) return porGrupo
    const porCategoria = habitual(a.dispositivo) - habitual(b.dispositivo)
    if (porCategoria !== 0) return porCategoria
    const porEstado = pesoEstado(a.dispositivo.estado) - pesoEstado(b.dispositivo.estado)
    if (porEstado !== 0) return porEstado
    return a.dispositivo.nombre.localeCompare(b.dispositivo.nombre, 'es', { numeric: true })
  })
}

function grupoDe(d: EquipoAsignable): GrupoCandidato {
  if (d.responsableId) return 'deOtraPersona'
  return estadoCanonico(d.estado) === 'Disponible' ? 'disponible' : 'sinResponsable'
}

// Los que funcionan antes que los averiados, sin esconder ninguno.
function pesoEstado(estado: string): number {
  const canonico = estadoCanonico(estado)
  if (canonico === 'Disponible' || canonico === 'Operativo') return 0
  if (canonico === null) return 1
  return 2
}

// ----------------------------------------------------------------
// Responsable escrito que no es una ficha (sección 8 del encargo)
// ----------------------------------------------------------------

type EquipoConResponsable = Pick<Dispositivo, 'responsable' | 'responsableId' | 'eliminadoEn'>

/**
 * El texto de responsable de un equipo SIN persona vinculada: "Archivo",
 * "Disponible en Área de Contabilidad", dos nombres en el mismo campo...
 * Se enseña como anotación del inventario "por validar", nunca como una
 * persona, y nunca se resuelve solo. Cadena vacía si no hay texto o si
 * el equipo sí tiene una persona.
 */
export function responsablePorValidar(dispositivo: EquipoConResponsable): string {
  if (dispositivo.responsableId) return ''
  return dispositivo.responsable.trim()
}

/** Equipos vivos con un responsable escrito que no es una ficha de persona. */
export function equiposPorValidar<T extends EquipoConResponsable & Pick<Dispositivo, 'estado'>>(
  dispositivos: T[],
): T[] {
  return dispositivos.filter((d) => !d.eliminadoEn && !esDeBaja(d) && responsablePorValidar(d) !== '')
}

// ----------------------------------------------------------------
// Fechas
// ----------------------------------------------------------------

/** Hoy en formato "YYYY-MM-DD", con la fecha LOCAL del teléfono. */
export function fechaDeHoy(ahora: Date = new Date()): string {
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** ¿Es una fecha "YYYY-MM-DD" válida? El campo de fecha vacío no lo es. */
export function esFechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [anio, mes, dia] = texto.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

// 'es' y no 'es-CO': es el formato corto del resto de fichas ("12 jul",
// "12 sept 2025"); 'es-CO' escribe "12 de sept de 2025".
const FORMATO_FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * "12 mar 2025" para una fecha "YYYY-MM-DD" (se lee en UTC para que el
 * día no se corra por la zona horaria) o para un instante ISO completo
 * del historial (se lee en la hora local del teléfono, que es el día que
 * el técnico vivió).
 */
export function fechaLegible(valor: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number)
    return FORMATO_FECHA.format(new Date(Date.UTC(anio, mes - 1, dia)))
  }
  const instante = new Date(valor)
  if (Number.isNaN(instante.getTime())) return valor
  return FORMATO_FECHA.format(new Date(Date.UTC(instante.getFullYear(), instante.getMonth(), instante.getDate())))
}
