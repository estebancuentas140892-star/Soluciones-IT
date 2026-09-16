import type { TipoResultado } from './useIndiceBusqueda'

// MEDIR EL RECORRIDO, NO LO QUE SE BUSCA (encargo del 2026-09-15, tarea
// 241, seccion 17).
//
// La pregunta que esta tarea quiere poder responder mas adelante es
// cuantas interacciones necesita un tecnico desde que escribe en el
// buscador hasta que RESUELVE algo (empezar o continuar una guia,
// iniciar un diagnostico, abrir un equipo, copiar una credencial). Sin
// esa cuenta, "menos pasos" es una opinion.
//
// LO QUE NUNCA SE REGISTRA (seccion 19). Ni contrasenas, ni usuarios, ni
// secretos, ni valores cifrados, ni el contenido de un campo protegido,
// ni el titulo del resultado, ni su id, ni la consulta escrita: una
// consulta puede contener el nombre de un acceso concreto y registrarla
// filtraria por la puerta de atras lo que la boveda protege por delante.
// De la consulta solo viaja su LONGITUD, que es un numero.
//
// POR QUE NO HAY SISTEMA DE TELEMETRIA. El encargo lo dice explicito: si
// no existe una forma clara y segura, se deja preparada la medicion en
// codigo y NO se crea un sistema externo en esta tarea. La app no tiene
// hoy un canal de analitica (`accesos_boveda` es una auditoria de
// seguridad, no una metrica de uso, y meter ahi eventos de navegacion
// ensuciaria el registro que el equipo revisa). Asi que el sumidero por
// defecto no guarda nada: es un punto de enganche de una sola linea, con
// su forma ya fijada y probada.

/** Que resolvio el tecnico al final del recorrido. */
export type AccionResuelta =
  | 'empezar_guia'
  | 'continuar_guia'
  | 'iniciar_diagnostico'
  | 'abrir_equipo'
  | 'copiar_credencial'

export interface EventoResolucion {
  accion: AccionResuelta
  /** Tipo de resultado sobre el que se actuo (nunca su titulo ni su id). */
  tipo: TipoResultado
  /** Salio de "Mejores resultados" o de un grupo. */
  desdeMejores: boolean
  /**
   * Interacciones contadas desde el buscador: escribir (1) + la accion
   * (1), y una mas si hubo que desbloquear la boveda por el camino.
   */
  interacciones: number
  /** Cuantos caracteres tenia la consulta. NUNCA la consulta. */
  longitudConsulta: number
}

/** Las dos interacciones minimas: escribir y tocar la accion. */
export const INTERACCIONES_BASE = 2

/**
 * Arma el evento a partir de lo que la fila sabe. Funcion pura y
 * separada del sumidero para poder comprobar en pruebas que el evento
 * NO lleva texto libre de ninguna clase.
 */
export function eventoDeResolucion(datos: {
  accion: AccionResuelta
  tipo: TipoResultado
  desdeMejores: boolean
  consulta: string
  huboDesbloqueo?: boolean
}): EventoResolucion {
  return {
    accion: datos.accion,
    tipo: datos.tipo,
    desdeMejores: datos.desdeMejores,
    interacciones: INTERACCIONES_BASE + (datos.huboDesbloqueo ? 1 : 0),
    longitudConsulta: datos.consulta.trim().length,
  }
}

/**
 * Punto de enganche unico. Hoy no guarda nada a proposito (ver la nota
 * de arriba); el dia que el equipo decida donde medir, se conecta aqui y
 * en ningun otro sitio, con la garantia de que lo que llega ya viene sin
 * datos sensibles.
 */
export function registrarResolucion(evento: EventoResolucion): void {
  void evento
}
