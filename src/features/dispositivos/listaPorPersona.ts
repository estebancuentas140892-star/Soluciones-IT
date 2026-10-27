import type { Dispositivo } from '../../lib/db'
import { personaQueLoTiene, type PersonasPorId } from './responsableEnLista'

// LA PERSONA PRIMERO (auditoría de Resolver, Equipos y Agenda del 2026-10-27,
// D4, tarea 364). La tarjeta de un equipo empezaba por su nombre técnico
// («PC-COMPRAS-04»), seguía la IP y, más tenue, «Daniel Restrepo · Parque
// Norte»: lo que se recuerda, la persona, era lo menos visible. Y la lista iba
// por nombre de equipo, así que los dos equipos de Daniel Restrepo no quedaban
// juntos.
//
// Con responsable vinculado (la ficha de una persona, vigente, y el equipo no
// de baja: `personaQueLoTiene`), la persona es el título y el equipo con su IP
// va debajo; la lista se ordena por lo que se lee primero. Al buscar, los
// equipos de una misma persona van juntos, bajo su cabecera. Sin responsable,
// anotado por validar, de baja o de red: el equipo sigue siendo el título (lo
// anotado nunca se presenta como una persona).
//
// Lógica pura, sin React ni base de datos, para probarla sola.

/** Lo que se lee primero de un equipo de la lista: quien lo tiene o, si nadie, su nombre. */
export function tituloEnLista(dispositivo: Dispositivo, personas: PersonasPorId): string {
  return personaQueLoTiene(dispositivo, personas)?.nombre ?? dispositivo.nombre
}

/** Un elemento de la lista de Equipos al buscar: un equipo o una persona con los suyos. */
export type ElementoDeLista =
  | { tipo: 'equipo'; dispositivo: Dispositivo }
  | { tipo: 'persona'; personaId: string; nombre: string; area: string; equipos: Dispositivo[] }

/**
 * Los equipos de una misma persona, juntos (D4): una persona con dos o más
 * equipos en la lista pasa a un solo elemento, en el sitio del primero, con
 * sus equipos en el orden de la lista. Una persona con uno, y los equipos sin
 * nadie, siguen sueltos.
 */
export function agruparPorPersona(lista: Dispositivo[], personas: PersonasPorId): ElementoDeLista[] {
  const deQuien = (d: Dispositivo) => (personaQueLoTiene(d, personas) ? d.responsableId : null)
  const cuantos = new Map<string, number>()
  for (const dispositivo of lista) {
    const id = deQuien(dispositivo)
    if (id) cuantos.set(id, (cuantos.get(id) ?? 0) + 1)
  }
  const hechos = new Set<string>()
  const elementos: ElementoDeLista[] = []
  for (const dispositivo of lista) {
    const id = deQuien(dispositivo)
    if (!id || (cuantos.get(id) ?? 0) < 2) {
      elementos.push({ tipo: 'equipo', dispositivo })
      continue
    }
    if (hechos.has(id)) continue
    hechos.add(id)
    const persona = personaQueLoTiene(dispositivo, personas)
    elementos.push({
      tipo: 'persona',
      personaId: id,
      nombre: persona?.nombre ?? '',
      area: persona?.area?.trim() ?? '',
      equipos: lista.filter((d) => deQuien(d) === id),
    })
  }
  return elementos
}

/**
 * Lo que dice la cabecera de una persona con varios equipos y, en cada uno, lo
 * que falta: su área y, si todos están en el mismo sitio, ese sitio una vez;
 * si no, el sitio de cada equipo en su fila. Sin área ni sitio común, «Sin
 * área registrada».
 */
export function contextoDePersona(
  area: string,
  ubicaciones: readonly string[],
): { cabecera: string; ubicacionEnFila: boolean } {
  const distintas = [...new Set(ubicaciones.map((u) => u.trim()).filter(Boolean))]
  const comun = distintas.length === 1 && ubicaciones.every((u) => u.trim() === distintas[0]) ? distintas[0] : ''
  const cabecera = [area, comun].filter(Boolean)
  // Un área igual al sitio («Sistemas» en «Sistemas») se dice una vez.
  const unica = cabecera.filter((parte, i) => cabecera.findIndex((p) => p.toLowerCase() === parte.toLowerCase()) === i)
  return { cabecera: unica.join(' · ') || 'Sin área registrada', ubicacionEnFila: comun === '' }
}
