import type { Dispositivo } from '../../lib/db'
import { estadoCanonico } from './estados'

// ESTADOS ESCRITOS A MANO (tarea 268, sección 9 del encargo del
// 2026-09-23).
//
// `estado` es texto libre y el inventario institucional trajo el suyo:
// "OPERATIVO", "Activo", "Dañado"... La lista canónica son cinco estados
// (Operativo, Disponible, En mantenimiento, Fuera de servicio, De baja).
// Esta lógica pura prepara la unificación asistida, con las dos clases
// de parecido de siempre (mismo criterio que la migración de
// ubicaciones, RN-052):
//
//   - EQUIVALENCIA SEGURA: el texto ya ES un estado de la lista, escrito
//     con otras mayúsculas, tildes o espacios, o con un sinónimo
//     declarado ("Dado de baja"). Se propone pasarlo a su forma canónica.
//   - POR VALIDAR: cualquier otro texto. Puede traer una SUGERENCIA
//     ("Activo" parece Operativo), pero nunca se aplica sola: el técnico
//     elige el estado o lo deja como está. Un texto que no dice su estado
//     no se convierte en ninguno.
//
// Los equipos sin estado no aparecen: no hay texto que unificar, y
// darles uno sería inventarlo.

type EquipoConEstado = Pick<Dispositivo, 'id' | 'estado' | 'eliminadoEn'>

export interface TextoEstado {
  /** Clave del grupo: el texto sin mayúsculas ni espacios de sobra. */
  clave: string
  /** La primera forma vista, recortada. */
  texto: string
  cantidad: number
  /** Las formas distintas en que aparece. */
  variantes: string[]
  /** Estado de la lista al que equivale de forma segura, o null. */
  canonico: string | null
  /** Solo si no hay equivalencia: el estado que PARECE, a confirmar. */
  sugerido: string | null
}

function limpio(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

export function claveEstado(texto: string): string {
  return limpio(texto).toLowerCase()
}

function sinTildes(texto: string): string {
  return claveEstado(texto).normalize('NFD').replace(/\p{M}/gu, '')
}

// Palabras que suelen decir un estado, a CONFIRMAR. Conservadoras a
// propósito, porque el encargo prohíbe inferir un estado: no están
// "Inactivo" ni "Asignado" (no dicen si el equipo funciona: un inactivo
// puede estar guardado o averiado), "En bodega" ni "Stock" (dicen dónde
// está, no cómo), "Fuera de uso" (guardado o dañado), "Para baja" (aún
// no se dio de baja) ni "Obsoleto" (viejo, pero puede seguir en uso).
const SUGERENCIAS: [string, string[]][] = [
  ['Operativo', ['activo', 'activa', 'en uso', 'funcionando', 'funcional', 'bueno', 'buen estado', 'en servicio', 'operativa']],
  ['Disponible', ['libre', 'sin asignar', 'disponible para asignar']],
  ['En mantenimiento', ['mantenimiento', 'en reparacion', 'reparacion', 'en revision', 'revision']],
  ['Fuera de servicio', ['danado', 'averiado', 'malo', 'no funciona', 'dano']],
  ['De baja', ['baja', 'desechado']],
]

/** El estado que parece un texto que no es de la lista, o null si no se parece a ninguno. */
export function sugerenciaDeEstado(texto: string): string | null {
  const plano = sinTildes(texto).replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()
  for (const [estado, palabras] of SUGERENCIAS) {
    if (palabras.includes(plano)) return estado
  }
  return null
}

/**
 * Los textos de estado que no están escritos exactamente como en la
 * lista, agrupados sin distinguir mayúsculas ni espacios, con cuántos
 * equipos los usan. Ordenados: primero los de equivalencia segura, luego
 * los que tienen sugerencia y al final el resto; dentro, los más usados.
 */
export function estadosPorUnificar(dispositivos: EquipoConEstado[]): TextoEstado[] {
  const porClave = new Map<string, TextoEstado>()
  for (const d of dispositivos) {
    if (d.eliminadoEn) continue
    const texto = limpio(d.estado)
    if (texto === '') continue
    const canonico = estadoCanonico(texto)
    // Ya escrito tal cual (y sin espacios de sobra): nada que unificar.
    if (canonico === d.estado) continue
    const clave = claveEstado(texto)
    const grupo = porClave.get(clave)
    if (grupo) {
      grupo.cantidad += 1
      if (!grupo.variantes.includes(texto)) grupo.variantes.push(texto)
    } else {
      porClave.set(clave, {
        clave,
        texto,
        cantidad: 1,
        variantes: [texto],
        canonico,
        sugerido: canonico ? null : sugerenciaDeEstado(texto),
      })
    }
  }
  const peso = (t: TextoEstado) => (t.canonico ? 0 : t.sugerido ? 1 : 2)
  return [...porClave.values()].sort(
    (a, b) => peso(a) - peso(b) || b.cantidad - a.cantidad || a.texto.localeCompare(b.texto, 'es'),
  )
}

export interface CambioDeEstado {
  dispositivoId: string
  de: string
  a: string
}

/**
 * Los cambios concretos: cada equipo cuyo texto (por su clave) tiene un
 * estado elegido. Un texto sin elección no produce cambios.
 */
export function cambiosDeEstado(
  dispositivos: EquipoConEstado[],
  elecciones: Map<string, string>,
): CambioDeEstado[] {
  const cambios: CambioDeEstado[] = []
  for (const d of dispositivos) {
    if (d.eliminadoEn) continue
    const destino = elecciones.get(claveEstado(d.estado))
    if (!destino || destino === d.estado) continue
    cambios.push({ dispositivoId: d.id, de: d.estado, a: destino })
  }
  return cambios
}

/** Cuántos equipos tienen un estado escrito fuera de la lista (para la puerta). */
export function cuantosEstadosPorUnificar(dispositivos: EquipoConEstado[]): number {
  return estadosPorUnificar(dispositivos).reduce((suma, t) => suma + t.cantidad, 0)
}
