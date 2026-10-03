import type { VinculoProtegido, VinculoProtegidoDelEquipo } from './db'

// EL VÍNCULO PROTEGIDO, FIJO O DEL EQUIPO (tarea 290).
//
// Un vínculo fijo se identifica por su id; uno del equipo no tiene id (se
// resuelve en la ejecución), así que se identifica por su finalidad. Todo
// lo que compara vínculos (el historial de cambios, la credencial que una
// acción reutilizada presta a la siguiente) pasa por aquí en lugar de
// comparar `id`, que el del equipo no tiene.

/** La forma de una finalidad con la que se compara: sin mayúsculas, tildes ni espacios de más. */
export function claveDeFinalidad(finalidad: string): string {
  return finalidad
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** ¿Pide la credencial del equipo con el que se trabaja? */
export function esVinculoDelEquipo(vinculo: VinculoProtegido | null | undefined): vinculo is VinculoProtegidoDelEquipo {
  return vinculo?.tipo === 'equipo'
}

/** Lo que se lee de un vínculo del equipo mientras no se resuelve. */
export function tituloVinculoDelEquipo(finalidad: string): string {
  const limpia = finalidad.trim()
  return limpia ? `Credencial del equipo · ${limpia}` : 'Credencial del equipo'
}

/** Un vínculo del equipo con su título derivado de la finalidad: una sola verdad. */
export function vinculoDelEquipo(finalidad: string): VinculoProtegidoDelEquipo {
  const limpia = finalidad.trim()
  return { tipo: 'equipo', finalidad: limpia, titulo: tituloVinculoDelEquipo(limpia) }
}

/** Identidad de un vínculo para compararlo, o null si no hay vínculo. */
export function claveVinculoProtegido(vinculo: VinculoProtegido | null | undefined): string | null {
  if (!vinculo) return null
  if (vinculo.tipo === 'equipo') return `equipo:${claveDeFinalidad(vinculo.finalidad)}`
  return `${vinculo.tipo}:${vinculo.id}`
}

/** ¿Piden lo mismo? Dos vínculos del equipo con la misma finalidad, o dos fijos al mismo dato. */
export function mismoVinculoProtegido(
  a: VinculoProtegido | null | undefined,
  b: VinculoProtegido | null | undefined,
): boolean {
  return claveVinculoProtegido(a) === claveVinculoProtegido(b)
}
