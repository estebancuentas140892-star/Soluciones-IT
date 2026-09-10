import type { Procedimiento } from '../../lib/db'
import { siguientePasoPendiente } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'
import { guiaTerminada } from './cierrePaso'

// QUE OFRECE LA FICHA DE UNA GUIA (encargo del 2026-09-09, tarea 5;
// ampliado el mismo dia con las comprobaciones finales).
//
// Tres botones que no hacian lo que decian:
//
//   - "Empezar" no empezaba nada: llevaba a la ejecucion, que retomaba
//     lo que hubiera guardado. Con avance viejo a medias, "Empezar"
//     continuaba.
//   - Una guia terminada ofrecia "Repetir", pero repetir tampoco
//     reiniciaba: entraba al procedimiento con todos los pasos hechos,
//     asi que el tecnico veia la pantalla de completado en vez del paso
//     1.
//   - "Seguir en el paso N" calculaba N como `pasosHechos + 1`. Con los
//     pasos completados en otro orden (saltando uno y cerrando los
//     siguientes) esa cuenta señalaba un paso ya hecho y dejaba el
//     pendiente de verdad escondido detras.
//
// Y una cuarta, la que cierra esta tarea: "terminada" se decidia
// mirando SOLO los pasos. Una guia con todos sus pasos cerrados y sus
// comprobaciones finales sin marcar ofrecia "Repetir guia", que estrena
// ejecucion, es decir BORRABA una ejecucion que no habia terminado. La
// respuesta la da ahora `guiaTerminada`, la misma regla que usa la
// ejecucion para avisar de que un vinculo acabo: una sola definicion de
// "terminada" para toda la app.

export type EstadoAccionGuia =
  // Sin ejecucion abierta: hay que crear una.
  | 'empezar'
  // Ejecucion abierta con trabajo pendiente: se conserva.
  | 'continuar'
  // Todo hecho, comprobaciones incluidas: repetir arranca un caso nuevo.
  | 'repetir'

/** Que es lo siguiente que falta por hacer en la guia. */
export type PendienteGuia =
  | { tipo: 'paso'; indice: number; numero: number }
  // Los pasos estan cerrados y quedan comprobaciones finales. No lleva
  // numero de paso a proposito: inventarle uno mandaria al tecnico a un
  // paso que ya hizo.
  | { tipo: 'verificacion' }
  | { tipo: 'ninguno' }

export interface AccionGuia {
  estado: EstadoAccionGuia
  pendiente: PendienteGuia
  pasosHechos: number
  total: number
}

export interface AvanceGuia {
  pasosHechos?: string[]
  verificacionHecha?: number[]
}

/**
 * `hayEjecucionAbierta` es la existencia de la fila de progreso, no la
 * cantidad de pasos marcados: una ejecucion recien creada todavia no
 * tiene ninguno, y puede llevar avance dentro de una guia vinculada,
 * asi que sigue siendo una ejecucion abierta.
 */
export function accionDeGuia(
  procedimiento: Procedimiento,
  avance: AvanceGuia | null | undefined,
  hayEjecucionAbierta: boolean,
): AccionGuia {
  const idsPasos = procedimiento.pasos.map((paso) => paso.id)
  const total = idsPasos.length
  const cuenta = contarHechos(avance?.pasosHechos ?? [], idsPasos)
  const estadoAbierto: EstadoAccionGuia = hayEjecucionAbierta ? 'continuar' : 'empezar'

  // Sin pasos que ejecutar no hay recorrido que ofrecer (caso K1).
  if (total === 0) {
    return { estado: estadoAbierto, pendiente: { tipo: 'ninguno' }, pasosHechos: cuenta, total }
  }

  if (guiaTerminada(procedimiento, avance?.pasosHechos, avance?.verificacionHecha)) {
    return { estado: 'repetir', pendiente: { tipo: 'ninguno' }, pasosHechos: cuenta, total }
  }

  const destino = siguientePasoPendiente(idsPasos, new Set(avance?.pasosHechos ?? []), -1)
  if (destino !== null) {
    return {
      estado: estadoAbierto,
      pendiente: { tipo: 'paso', indice: destino, numero: destino + 1 },
      pasosHechos: cuenta,
      total,
    }
  }

  // Pasos cerrados y comprobaciones sin marcar: la ejecucion sigue
  // abierta aunque la fila todavia no existiera (los pasos se cerraron
  // en algun momento, asi que existe).
  return { estado: 'continuar', pendiente: { tipo: 'verificacion' }, pasosHechos: cuenta, total }
}

/**
 * El rotulo del control, para que la ficha y la tarjeta del catalogo
 * digan lo mismo. La tarjeta abrevia porque compite por ancho con el
 * titulo; la barra de la ficha tiene sitio para la frase entera.
 */
export function etiquetaAccionGuia(accion: AccionGuia, variante: 'barra' | 'tarjeta'): string {
  if (accion.estado === 'repetir') return 'Repetir guía'
  if (accion.estado === 'empezar') return 'Empezar'
  if (accion.pendiente.tipo === 'verificacion') return 'Continuar con las comprobaciones finales'
  if (accion.pendiente.tipo === 'paso') {
    return variante === 'tarjeta'
      ? `Continuar · paso ${accion.pendiente.numero} de ${accion.total}`
      : `Continuar en el paso ${accion.pendiente.numero} de ${accion.total}`
  }
  return 'Continuar'
}

/**
 * ¿Esta accion tiene que ESTRENAR ejecucion antes de navegar? Empezar y
 * repetir si; continuar conserva la abierta y no prepara nada.
 */
export function estrenaEjecucion(accion: AccionGuia): boolean {
  return accion.estado !== 'continuar'
}
