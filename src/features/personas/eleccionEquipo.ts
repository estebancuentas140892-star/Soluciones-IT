import type { Dispositivo } from '../../lib/db'
import { sugerirDisponible } from './cicloPersona'
import type { DecisionEquipo } from './operaciones'

// Lo que el técnico va eligiendo en "¿Qué pasa con este equipo?"
// (`DecisionEquipo.tsx`) y su traducción a la decisión que ejecuta
// `retirarPersona`. Vive aparte del componente para que el archivo del
// componente solo exporte componentes (recarga en caliente).

export type Eleccion =
  | { tipo: 'liberar'; marcarDisponible: boolean }
  | { tipo: 'reasignar'; personaId: string }
  | { tipo: 'baja' }

/** La opción más prudente: dejarlo sin responsable, Disponible solo si funcionaba. */
export function eleccionInicial(dispositivo: Pick<Dispositivo, 'estado'>): Eleccion {
  return { tipo: 'liberar', marcarDisponible: sugerirDisponible(dispositivo.estado) === 'si' }
}

/** null mientras la elección no está completa (falta elegir la persona). */
export function aDecision(dispositivoId: string, eleccion: Eleccion): DecisionEquipo | null {
  if (eleccion.tipo === 'reasignar') {
    return eleccion.personaId ? { dispositivoId, tipo: 'reasignar', personaId: eleccion.personaId } : null
  }
  if (eleccion.tipo === 'baja') return { dispositivoId, tipo: 'baja' }
  return { dispositivoId, tipo: 'liberar', marcarDisponible: eleccion.marcarDisponible }
}
