import type { Credencial, Dispositivo, TipoSecreto } from '../../lib/db'
import { claveDeFinalidad } from '../../lib/vinculoProtegido'
import { valoresUnicos } from '../../lib/vocabulario'

export { claveDeFinalidad }

// LA CREDENCIAL DEL EQUIPO CON EL QUE SE TRABAJA (tarea 290).
//
// Una acción de una guía puede pedir un acceso de dos maneras:
//
//   - FIJO: "usa esta credencial" (el vínculo guarda su id). Es lo de
//     siempre y no cambia.
//   - DEL EQUIPO: "usa la credencial del equipo con el que estoy
//     trabajando". Una misma guía de impresoras sirve para varias
//     impresoras con credenciales distintas, y fijar una obligaba a elegir.
//
// Para lo segundo no hace falta ningún dato nuevo: la Bóveda ya relaciona
// cada credencial con los equipos a los que da acceso
// (`Credencial.dispositivos`, sin cifrar a propósito). Este módulo sigue
// esa relación por el IDENTIFICADOR del equipo, nunca por su nombre, su
// modelo, su IP ni el título de la credencial, y decide de forma
// determinista:
//
//   - una credencial: esa (caso A);
//   - ninguna: ninguna, sin buscar "la más parecida" ni otra de reserva
//     (casos B y D: una eliminada o que no está en este teléfono no
//     cuenta);
//   - varias: no se elige ninguna (caso C). El técnico no escoge entre
//     credenciales ni las prueba: la complejidad pertenece al sistema, no
//     al técnico, y si el sistema no puede saber cuál es, lo dice.
//
// FINALIDAD. Un mismo equipo puede tener accesos distintos (al escritorio
// remoto de un servidor y al programa que corre en él). Cuando la acción
// pide una finalidad, solo cuentan las credenciales cuya CATEGORÍA de la
// Bóveda es exactamente esa (sin distinguir mayúsculas, tildes ni
// espacios de más; nunca una coincidencia parcial). Sin finalidad, cuentan
// todas las del equipo. La categoría ya existe y la mantiene quien
// mantiene la Bóveda: no hay campo nuevo ni migración.
//
// Solo lee metadatos que viajan en claro (la relación, la clase, la
// categoría y si está eliminada). Nunca descifra, nunca registra nada y
// nunca escribe en consola: lo que devuelve es la credencial como fila, y
// sus secretos siguen detrás de los controles de siempre (permiso de
// Bóveda, contraseña maestra, ojo y registro de cada consulta).

/**
 * Las clases de secreto que son un ACCESO a un equipo: "Acceso (usuario y
 * contraseña)" y "Clave o PIN". Un token o una licencia, un archivo
 * seguro o una nota segura relacionados con el equipo no son la forma de
 * entrar en él, así que no compiten (si contaran, cualquier equipo con
 * una licencia y un acceso sería ambiguo).
 */
export const TIPOS_DE_ACCESO: readonly TipoSecreto[] = ['cuenta', 'red']

export type ResolucionCredencialDelEquipo =
  /** No hay equipo en contexto (o el identificador no es un texto con contenido). */
  | { estado: 'sin-equipo' }
  /** El identificador no corresponde a un equipo vivo en este teléfono. */
  | { estado: 'equipo-no-disponible' }
  /** Ninguna credencial de acceso viva relacionada con el equipo (y la finalidad). */
  | { estado: 'ninguna' }
  /** Más de una candidata: no se puede saber cuál corresponde a esta acción. */
  | { estado: 'varias'; cuantas: number }
  /** Exactamente una. */
  | { estado: 'resuelta'; credencial: Credencial }

/** ¿Es un identificador de equipo utilizable? Un texto con algo más que espacios. */
export function esIdDeEquipo(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim() !== ''
}

function esDeAcceso(credencial: Credencial): boolean {
  // `tipo` puede faltar en una fila de antes de la columna: es una cuenta.
  return TIPOS_DE_ACCESO.includes(credencial.tipo ?? 'cuenta')
}

// La relación tal como la guarda la Bóveda. Se lee con desconfianza: una
// fila a medio sincronizar o escrita por otra versión puede traer la
// lista vacía, nula o con elementos sin forma, y nada de eso debe romper
// la guía ni contar como relación.
function daAccesoA(credencial: Credencial, equipoId: string): boolean {
  const relacion: unknown = credencial.dispositivos
  if (!Array.isArray(relacion)) return false
  return relacion.some(
    (elemento: unknown) =>
      elemento !== null && typeof elemento === 'object' && (elemento as { id?: unknown }).id === equipoId,
  )
}

/**
 * Las credenciales de acceso vivas relacionadas con un equipo, sin
 * repetir, en el orden recibido. Es la lista de la que sale la
 * resolución; no decide nada por sí misma.
 */
export function credencialesDeAccesoDelEquipo(
  equipoId: string,
  credenciales: readonly Credencial[],
): Credencial[] {
  const porId = new Map<string, Credencial>()
  for (const credencial of credenciales) {
    if (credencial.eliminadoEn || !esDeAcceso(credencial) || !daAccesoA(credencial, equipoId)) continue
    if (!porId.has(credencial.id)) porId.set(credencial.id, credencial)
  }
  return [...porId.values()]
}

/**
 * Qué credencial corresponde a la acción, con el equipo en contexto y la
 * finalidad que pide (vacía: cualquiera de acceso del equipo). Pura y
 * determinista: no lee la base, no descifra y no tiene efectos.
 */
export function resolverCredencialDelEquipo(
  peticion: { equipoId: unknown; finalidad?: unknown },
  datos: {
    equipos: readonly Pick<Dispositivo, 'id' | 'eliminadoEn'>[]
    credenciales: readonly Credencial[]
  },
): ResolucionCredencialDelEquipo {
  const { equipoId } = peticion
  if (!esIdDeEquipo(equipoId)) return { estado: 'sin-equipo' }
  const equipo = datos.equipos.find((candidato) => candidato.id === equipoId)
  if (!equipo || equipo.eliminadoEn) return { estado: 'equipo-no-disponible' }

  const finalidad = typeof peticion.finalidad === 'string' ? claveDeFinalidad(peticion.finalidad) : ''
  const candidatas = credencialesDeAccesoDelEquipo(equipoId, datos.credenciales).filter(
    (credencial) => finalidad === '' || claveDeFinalidad(credencial.categoria ?? '') === finalidad,
  )

  if (candidatas.length === 0) return { estado: 'ninguna' }
  if (candidatas.length > 1) return { estado: 'varias', cuantas: candidatas.length }
  return { estado: 'resuelta', credencial: candidatas[0] }
}

/**
 * Las finalidades que ya existen, para sugerirlas en el editor: las
 * categorías de las credenciales de acceso vivas que la Bóveda relaciona
 * con algún equipo, sin repetir y en orden. Solo nombres de categoría:
 * nada de lo que identifica a una credencial ni de lo que guarda.
 */
export function finalidadesConocidas(credenciales: readonly Credencial[]): string[] {
  return valoresUnicos(
    credenciales
      .filter(
        (credencial) =>
          !credencial.eliminadoEn &&
          esDeAcceso(credencial) &&
          Array.isArray(credencial.dispositivos) &&
          credencial.dispositivos.length > 0,
      )
      .map((credencial) => credencial.categoria ?? ''),
  )
}
