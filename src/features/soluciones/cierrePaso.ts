import type { PasoProcedimiento, Procedimiento } from '../../lib/db'
import { contarHechos, verificacionFinalCompleta } from '../../lib/progresoPasos'

// COMO SE CIERRA UN PASO, DICHO UNA SOLA VEZ (encargo del 2026-09-09,
// tarea 3).
//
// Habia cuatro formas distintas de dar un paso por terminado y cada una
// con su regla:
//
//   - La insignia numerada de la vista de lista lo marcaba hecho de un
//     toque Y ARRASTRABA TODAS SUS TAREAS, asi que el numero del paso,
//     que sirve para situarse, completaba trabajo que nadie hizo.
//   - La accion dominante del asistente decia "Paso hecho" incluso
//     cuando faltaban tareas o la guia vinculada; se apagaba, pero
//     seguia prometiendo lo que no iba a pasar.
//   - El boton "Siguiente" del nivel anidado validaba solo el trabajo
//     previo, sin nombrar nunca lo que faltaba.
//   - Y con una contingencia vinculada, terminar la guia del paso no
//     cerraba el paso: pedia despues otro clic en "Paso hecho". Esa
//     puerta existia para la pregunta "¿Ocurrio algun error?", que ya
//     no existe: la contingencia es una fila disponible siempre.
//
// Aqui vive la regla y el rotulo. Quien pinta solo pregunta.

export type AccionPaso =
  // El paso puede cerrarse ya.
  | 'completar'
  // Ya esta hecho: el control lleva al siguiente, no vuelve a cerrarlo.
  | 'navegar'
  // Falta trabajo. El rotulo dice cual.
  | 'bloqueado'

export interface CierrePaso {
  accion: AccionPaso
  /** Rotulo del control de finalizacion. Nunca promete lo que no hara. */
  etiqueta: string
  /** Guia vinculada que falta terminar, si es eso lo que bloquea. */
  guiaPendiente: string | null
  /** Tareas del paso sin marcar. */
  tareasPendientes: number
}

export interface DatosCierrePaso {
  pasoHecho: boolean
  totalTareas: number
  tareasMarcadas: number
  /**
   * Titulo de la guia vinculada del paso MIENTRAS siga pendiente; null
   * cuando el paso no tiene guia, cuando ya termino o cuando el vinculo
   * esta roto (un vinculo que no se puede abrir no bloquea: criterio
   * A12).
   */
  guiaPendiente: string | null
  hayPasoSiguiente: boolean
  /** Numero (1..n) del paso al que se ira al cerrar este. */
  numeroPasoSiguiente: number
}

/**
 * El titulo de la guia vinculada del paso mientras siga pendiente.
 * `subSatisfecho` lo resuelve la ejecucion con lectura en vivo y ya
 * cuenta como satisfecho el vinculo roto.
 */
export function guiaPendienteDelPaso(
  paso: PasoProcedimiento,
  subSatisfecho: boolean,
): string | null {
  if (!paso.subArticuloId || subSatisfecho) return null
  return paso.subArticuloTitulo || 'la guía vinculada'
}

/**
 * Que puede hacer ahora mismo el control que cierra este paso, y como
 * se llama esa accion.
 *
 * La guia manda sobre las tareas cuando faltan las dos: es el trabajo
 * que el recorrido pone primero, asi que nombrar las tareas mientras el
 * tecnico esta dentro de la guia seria señalar lo que no toca.
 */
export function cierreDelPaso({
  pasoHecho,
  totalTareas,
  tareasMarcadas,
  guiaPendiente,
  hayPasoSiguiente,
  numeroPasoSiguiente,
}: DatosCierrePaso): CierrePaso {
  const tareasPendientes = Math.max(0, totalTareas - tareasMarcadas)

  if (pasoHecho) {
    return {
      accion: 'navegar',
      etiqueta: hayPasoSiguiente ? `Ir al paso ${numeroPasoSiguiente}` : 'Continuar',
      guiaPendiente: null,
      tareasPendientes,
    }
  }

  if (guiaPendiente !== null) {
    return {
      accion: 'bloqueado',
      etiqueta: `Completa «${guiaPendiente}»`,
      guiaPendiente,
      tareasPendientes,
    }
  }

  if (tareasPendientes > 0) {
    return {
      accion: 'bloqueado',
      etiqueta: tareasPendientes === 1 ? 'Falta 1 tarea' : `Faltan ${tareasPendientes} tareas`,
      guiaPendiente: null,
      tareasPendientes,
    }
  }

  return {
    accion: 'completar',
    etiqueta: hayPasoSiguiente ? 'Completar paso y continuar' : 'Completar paso y terminar',
    guiaPendiente: null,
    tareasPendientes: 0,
  }
}

/**
 * CUANDO UNA GUIA ESTA TERMINADA DE VERDAD (encargo del 2026-09-09,
 * tarea 4).
 *
 * Sus pasos cerrados Y sus comprobaciones finales hechas. Las tareas
 * obligatorias de cada paso ya estan dentro de "pasos cerrados": un
 * paso no se cierra sin ellas (`cierreDelPaso`).
 *
 * Antes bastaban los pasos, asi que una guia vinculada con
 * comprobaciones finales daba por cerrado el paso que la exigia sin que
 * nadie las hiciera. Una guia SIN comprobaciones termina al cerrar su
 * ultimo paso, como siempre.
 */
export function guiaTerminada(
  procedimiento: Procedimiento,
  pasosHechos: string[] | undefined,
  verificacionHecha: number[] | undefined,
): boolean {
  const ids = procedimiento.pasos.map((paso) => paso.id)
  // Sin pasos que ejecutar no hay nada que cerrar (caso K1: una guia
  // que es solo metadata). No bloquea, como no bloqueaba antes.
  const pasosListos = contarHechos(pasosHechos ?? [], ids) === ids.length
  return (
    pasosListos &&
    verificacionFinalCompleta(verificacionHecha, procedimiento.verificacionFinal.length)
  )
}
