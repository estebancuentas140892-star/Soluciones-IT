import type { Dispositivo, Persona } from '../../lib/db'
import { textoVivo } from '../../lib/referencia'
import { esDeBaja, responsablePorValidar } from '../personas/cicloPersona'

// QUIÉN TIENE EL EQUIPO Y DE QUÉ ÁREA ES, EN LA LISTA DE EQUIPOS
// (tarea 317, hallazgo de UX del 2026-10-09).
//
// "metrojp19 / Computadores" repetía lo que el icono ya dice. La lista
// responde primero qué equipo es, quién lo tiene y de qué área es:
// "metrojp19 / Esteban Cardona Rendón · Control Interno".
//
// El área es de la PERSONA y aquí solo se lee: `responsableId → Persona →
// area`. El equipo no la guarda, así que si alguien cambia de área sus
// equipos lo dicen sin reescribir ningún dispositivo. Las personas llegan
// en un mapa que la pantalla carga una vez (nunca una consulta por fila).
//
// Lógica pura, sin React ni base de datos, para probarla sola.

/** Las personas por id, con lo que la lista necesita de ellas. */
export type PersonasPorId = ReadonlyMap<string, Pick<Persona, 'nombre' | 'area' | 'eliminadoEn'>>

/** Sin personas cargadas: el equipo se lee como sin responsable vinculado. */
export const SIN_PERSONAS: PersonasPorId = new Map()

/**
 * La persona que tiene hoy el equipo: la vinculada por `responsableId`, si
 * su ficha existe y no está eliminada. Un equipo de baja no lo tiene nadie
 * (su "último responsable" es historia, no quien lo tiene).
 */
export function personaQueLoTiene(
  dispositivo: Pick<Dispositivo, 'responsableId' | 'estado'>,
  personas: PersonasPorId,
): Pick<Persona, 'nombre' | 'area' | 'eliminadoEn'> | null {
  if (!dispositivo.responsableId || esDeBaja(dispositivo)) return null
  const persona = personas.get(dispositivo.responsableId)
  return persona && !persona.eliminadoEn ? persona : null
}

/** El área de quien tiene el equipo, leída de su ficha, o ''. */
export function areaDeQuienLoTiene(
  dispositivo: Pick<Dispositivo, 'responsableId' | 'estado'>,
  personas: PersonasPorId,
): string {
  return personaQueLoTiene(dispositivo, personas)?.area?.trim() ?? ''
}

/**
 * Las partes del subtítulo de un equipo en la lista de Equipos, por
 * prioridad. Se unen con " · " y, como el resto, callan lo que el nombre
 * del equipo ya dice (`lineasDeContexto`, regla 22):
 *   1. Una persona lo tiene: su nombre y su área. Sin área, solo el
 *      nombre: nunca "· Sin área".
 *   2. Un nombre escrito que no es una ficha de persona: "Anotado: «X» ·
 *      por validar", como en la ficha (AD-061). Sin área: no se inventa,
 *      y no se presenta como una persona vinculada.
 *   3. Nadie: el contexto de siempre que recibe (categoría y ubicación).
 */
export function partesDelSubtitulo(
  dispositivo: Pick<Dispositivo, 'responsable' | 'responsableId' | 'estado' | 'eliminadoEn'>,
  contexto: ReadonlyArray<string | null | undefined>,
  personas: PersonasPorId,
): ReadonlyArray<string | null | undefined> {
  const persona = personaQueLoTiene(dispositivo, personas)
  if (persona) return [textoVivo(persona.nombre, dispositivo.responsable), persona.area?.trim()]
  const anotado = esDeBaja(dispositivo) ? '' : responsablePorValidar(dispositivo)
  if (anotado) return [`Anotado: «${anotado}» · por validar`]
  return contexto
}
