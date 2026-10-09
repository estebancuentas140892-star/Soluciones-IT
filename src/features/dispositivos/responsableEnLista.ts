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
 * El nombre escrito como responsable que no es una ficha de persona (por
 * validar), o ''. Un equipo de baja no lo tiene nadie: tampoco anotado.
 */
export function anotadoEnLista(
  dispositivo: Pick<Dispositivo, 'responsable' | 'responsableId' | 'estado' | 'eliminadoEn'>,
): string {
  return esDeBaja(dispositivo) ? '' : responsablePorValidar(dispositivo)
}

/** Lo que la lista sabe del equipo además de quién lo tiene. */
export interface ContextoDeEquipo {
  categoria?: string | null
  /** La de `ubicacionDeEquipo`: la ficha vinculada y, si no, el texto heredado. */
  ubicacion?: string | null
}

/**
 * Las partes del subtítulo de un equipo en la lista de Equipos, por
 * prioridad. Se unen con " · " y, como el resto, callan lo que el nombre
 * del equipo ya dice y no repiten una parte igual a otra sin contar
 * mayúsculas ni tildes (`lineasDeContexto`, regla 22):
 *   1. Una persona lo tiene: su nombre, su área y dónde está el equipo
 *      (ampliación de la tarea 317). Sin área, nombre y ubicación (nunca
 *      "· Sin área"); si el área y la ubicación son la misma ("Sistemas"),
 *      se dice una vez.
 *   2. Un nombre escrito que no es una ficha de persona: "Anotado: «X» ·
 *      por validar", como en la ficha (AD-061), y la ubicación. Sin área:
 *      no se inventa, y no se presenta como una persona vinculada.
 *   3. Nadie: categoría y ubicación, como siempre.
 */
export function partesDelSubtitulo(
  dispositivo: Pick<Dispositivo, 'responsable' | 'responsableId' | 'estado' | 'eliminadoEn'>,
  { categoria, ubicacion }: ContextoDeEquipo,
  personas: PersonasPorId,
): ReadonlyArray<string | null | undefined> {
  const persona = personaQueLoTiene(dispositivo, personas)
  if (persona) return [textoVivo(persona.nombre, dispositivo.responsable), persona.area?.trim(), ubicacion]
  const anotado = anotadoEnLista(dispositivo)
  if (anotado) return [`Anotado: «${anotado}» · por validar`, ubicacion]
  return [categoria, ubicacion]
}
