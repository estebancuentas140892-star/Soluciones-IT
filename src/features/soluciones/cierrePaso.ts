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
  /**
   * El mismo rotulo sin acortar. Solo difiere de `etiqueta` cuando el
   * nombre de una guia vinculada es largo y se abrevio dentro de las
   * comillas: es el nombre accesible del control, para que nadie pierda
   * el nombre entero (propuesta final de Claude Design, 2026-10-01).
   */
  etiquetaCompleta: string
  /** Guia vinculada que falta terminar, si es eso lo que bloquea. */
  guiaPendiente: string | null
  /** Tareas del paso sin marcar. */
  tareasPendientes: number
}

// EL ROTULO DICE LA CONSECUENCIA (propuesta final de Claude Design,
// 2026-10-01). "Completar y seguir" cierra y abre lo siguiente,
// "Completar y terminar" cierra lo ultimo, "Ir al paso N" solo navega
// y, si falta trabajo, el rotulo dice cuanto y el control queda
// inactivo. "Comprobado" o "Hecho" a secas no decian que iba a pasar.
//
// El nombre de una guia vinculada puede ser largo y el boton de la
// ejecucion admite dos lineas como mucho. Se acorta DENTRO de las
// comillas y por palabras: el verbo ("Completa") va siempre entero, y
// el nombre completo viaja en `etiquetaCompleta`.

/** Caracteres del nombre de una guia que caben en el boton sin pasar de dos lineas a 360 px. */
export const LARGO_MAXIMO_NOMBRE_GUIA = 30

/**
 * El nombre de una guia, acortado por palabras a `maximo` caracteres con
 * "…" al final. Un nombre que ya cabe sale intacto. Si la primera
 * palabra sola ya no cabe, se corta dentro de ella: nunca devuelve solo
 * los puntos suspensivos.
 */
export function acortarNombreGuia(nombre: string, maximo = LARGO_MAXIMO_NOMBRE_GUIA): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio.length <= maximo) return limpio
  const corte = limpio.slice(0, maximo)
  const ultimoEspacio = corte.lastIndexOf(' ')
  // Cortar por palabra solo si no deja el nombre en un muñon: con menos
  // de la mitad del espacio usado, se corta dentro de la palabra.
  const base = ultimoEspacio >= maximo / 2 ? corte.slice(0, ultimoEspacio) : corte
  return `${base.replace(/[\s.,;:·-]+$/, '')}…`
}

/** "Completa «nombre»", con el nombre acortado para la vista y entero para el nombre accesible. */
export function rotuloCompletaGuia(nombre: string): { visible: string; completo: string } {
  const limpio = nombre.trim()
  // Sin nombre no se inventa uno ni se habla de vínculos (tarea 289).
  if (limpio === '') return { visible: 'Completa lo que falta', completo: 'Completa lo que falta' }
  return { visible: `Completa «${acortarNombreGuia(limpio)}»`, completo: `Completa «${limpio}»` }
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
  /**
   * ¿Queda a donde ir despues de este paso? En un paso pendiente: si al
   * cerrarlo queda otro paso por hacer (si no, cerrarlo termina la
   * guia). En un paso ya hecho: si navegar lleva a otro paso.
   */
  hayPasoSiguiente: boolean
  /**
   * Numero (1..n) del paso al que se ira desde este, o null cuando esa
   * numeracion no es la que ve el tecnico: dentro del flujo de otra guia
   * (tarea 289), donde el contador es el de la guia que se abrio.
   */
  numeroPasoSiguiente: number | null
}

/**
 * Lo que falta del paso que reutiliza otra guia, mientras siga pendiente,
 * nombrado por EL PASO: "Completa «Ingresar al programa de caja»". El
 * tecnico recorre un solo flujo (tarea 289), asi que el boton no nombra
 * la guia de dentro. `subSatisfecho` lo resuelve la ejecucion con lectura
 * en vivo y ya cuenta como satisfecho el vinculo roto.
 */
export function guiaPendienteDelPaso(
  paso: PasoProcedimiento,
  subSatisfecho: boolean,
): string | null {
  if (!paso.subArticuloId || subSatisfecho) return null
  return paso.titulo.trim() || paso.subArticuloTitulo || ''
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
    const etiqueta = !hayPasoSiguiente
      ? 'Continuar'
      : numeroPasoSiguiente === null
        ? 'Seguir'
        : `Ir al paso ${numeroPasoSiguiente}`
    return {
      accion: 'navegar',
      etiqueta,
      etiquetaCompleta: etiqueta,
      guiaPendiente: null,
      tareasPendientes,
    }
  }

  if (guiaPendiente !== null) {
    const rotulo = rotuloCompletaGuia(guiaPendiente)
    return {
      accion: 'bloqueado',
      etiqueta: rotulo.visible,
      etiquetaCompleta: rotulo.completo,
      guiaPendiente,
      tareasPendientes,
    }
  }

  if (tareasPendientes > 0) {
    const etiqueta = tareasPendientes === 1 ? 'Falta 1 tarea' : `Faltan ${tareasPendientes} tareas`
    return {
      accion: 'bloqueado',
      etiqueta,
      etiquetaCompleta: etiqueta,
      guiaPendiente: null,
      tareasPendientes,
    }
  }

  const etiqueta = hayPasoSiguiente ? 'Completar y seguir' : 'Completar y terminar'
  return {
    accion: 'completar',
    etiqueta,
    etiquetaCompleta: etiqueta,
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
