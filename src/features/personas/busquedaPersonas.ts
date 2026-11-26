import type { Persona } from '../../lib/db'
import { normalizarTexto } from '../../lib/texto'

// LO QUE ENCUENTRA EL BUSCADOR DE PERSONAS (encargo del 2026-11-26,
// optimización integral, sección 6).
//
// Hasta ahora buscaba la consulta entera, tal cual, dentro del nombre:
// "daniel garcia" no encontraba a "Daniel Esteban García", y nada se podía
// buscar por el área ("control interno"), que es justo lo que distingue a
// dos personas con el nombre parecido. Ahora:
//
//   - cada palabra escrita tiene que estar en el nombre o en el área, en
//     cualquier orden, sin tildes ni mayúsculas (la misma normalización de
//     Resolver y Equipos, `normalizarTexto`);
//   - primero quien coincide por el principio de las palabras de su nombre
//     ("ana" trae antes a "Ana María" que a "Juliana"), después quien
//     coincide en otra parte del nombre y al final quien solo coincide por
//     el área. Dentro de cada grupo se conserva el orden de la lista.
//
// Lógica pura, sin React ni base de datos, para probarla sola.

type PersonaBuscable = Pick<Persona, 'nombre' | 'area'>

function palabrasDe(consulta: string): string[] {
  return normalizarTexto(consulta).split(/\s+/).filter(Boolean)
}

/**
 * Qué tan bien coincide una persona con lo escrito: 0 si cada palabra
 * empieza una palabra de su nombre, 1 si todas están en el nombre, 2 si
 * alguna solo está en el área; null si no coincide.
 */
export function coincidenciaDePersona(persona: PersonaBuscable, consulta: string): 0 | 1 | 2 | null {
  const palabras = palabrasDe(consulta)
  if (palabras.length === 0) return 0
  const nombre = normalizarTexto(persona.nombre)
  const area = normalizarTexto(persona.area ?? '')
  if (!palabras.every((p) => nombre.includes(p) || area.includes(p))) return null
  if (!palabras.every((p) => nombre.includes(p))) return 2
  const inicios = nombre.split(/[\s.,;:()/-]+/).filter(Boolean)
  return palabras.every((p) => inicios.some((inicio) => inicio.startsWith(p))) ? 0 : 1
}

/** Las personas que coinciden con lo escrito, las mejores primero. */
export function buscarPersonas<T extends PersonaBuscable>(personas: readonly T[], consulta: string): T[] {
  if (palabrasDe(consulta).length === 0) return [...personas]
  return personas
    .map((persona, indice) => ({ persona, indice, nivel: coincidenciaDePersona(persona, consulta) }))
    .filter((e): e is { persona: T; indice: number; nivel: 0 | 1 | 2 } => e.nivel !== null)
    .sort((a, b) => a.nivel - b.nivel || a.indice - b.indice)
    .map((e) => e.persona)
}
