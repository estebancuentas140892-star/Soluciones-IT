import type { BloquePaso, OpcionDecision, PasoProcedimiento } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'
import { decisionDeRuta } from '../../lib/rutaProcedimiento'
import { acortarNombreGuia } from './cierrePaso'
import { presenciaDeAviso } from './tonos'

// LA VENTANA (tarea 348, rediseño móvil por ventanas).
//
// En el teléfono, un paso de la guía se ejecuta como UNA ventana: se lee
// entero y se cierra con un solo "Listo", en vez de marcar cada acción. Lo
// que sigue es la lógica pura de esa presentación, sin React, para que se
// pruebe sola y las pantallas solo pinten.
//
// NO CAMBIA EL MODELO. Una ventana es un paso del procedimiento; sus
// instrucciones siguen siendo las tareas del paso, sus avisos los avisos, su
// comprobación una tarea de verificación y su pregunta la decisión. Lo único
// que cambia es el gesto: "Listo" da por hechas las tareas de la ventana de
// una vez (`completarVentana`, en useProcedimientoEjecucion), pero solo
// cuando la ventana lo permite: sin guías necesarias pendientes, sin pregunta
// sin responder y con las advertencias críticas confirmadas.

/**
 * LAS ADVERTENCIAS CRÍTICAS DE UNA VENTANA: las de tono "Importante", las
 * únicas que piden "Confirmo que la leí" (ajuste 1 del 2026-10-21: la
 * confirmación obligatoria es solo para lo verdaderamente crítico, no para
 * recomendaciones, información ni precauciones de bajo riesgo).
 */
export function criticasDeLaVentana(paso: PasoProcedimiento): BloquePaso[] {
  return paso.bloques.filter((bloque) => bloque.tipo === 'aviso' && bloque.tono === 'importante')
}

/** Las críticas que todavía no se confirmaron, en el orden del autor. */
export function criticasPendientes(paso: PasoProcedimiento, confirmadas: ReadonlySet<string>): BloquePaso[] {
  return criticasDeLaVentana(paso).filter((bloque) => !confirmadas.has(bloque.id))
}

/**
 * LOS NÚMEROS DE LAS INSTRUCCIONES. Solo las acciones se numeran, de 1 en
 * adelante y en el orden del paso; la comprobación y la pregunta no son
 * instrucciones y no entran en la cuenta.
 */
export function numerarInstrucciones(paso: PasoProcedimiento): Map<string, number> {
  const numeros = new Map<string, number>()
  let siguiente = 1
  for (const tarea of tareasDe(paso.bloques)) {
    if (tarea.tipoTarea === 'verificacion' || tarea.tipoTarea === 'decision') continue
    numeros.set(tarea.id, siguiente)
    siguiente += 1
  }
  return numeros
}

/**
 * ¿La decisión SIMPLE (Sí/No) de la ventana es lo último que hay que hacer en
 * ella? Entonces responderla es avanzar, igual que una decisión con opciones
 * (que el editor ya exige como última acción). Si después de ella hay otras
 * tareas, responder solo la marca y la ventana se cierra con "Listo".
 */
export function esDecisionFinal(paso: PasoProcedimiento, decisionId: string): boolean {
  const tareas = tareasDe(paso.bloques)
  return tareas.length > 0 && tareas[tareas.length - 1].id === decisionId
}

/** ¿Esta tarea es una decisión de Sí/No (la que no tiene opciones propias)? */
export function esDecisionSiNo(tarea: BloquePaso): boolean {
  return tarea.tipo === 'tarea' && tarea.tipoTarea === 'decision' && (tarea.opciones?.length ?? 0) === 0
}

/**
 * LAS PREGUNTAS DE SÍ/NO QUE TODAVÍA NO TIENEN RESPUESTA. Una acción se da
 * por hecha con "Listo", pero una pregunta no: responderla es elegir un
 * camino ("No" puede abrir otra guía), así que nunca se contesta por el
 * técnico. Mientras haya una sin responder, la ventana no se cierra.
 */
export function siNoPendientes(paso: PasoProcedimiento, hechas: ReadonlySet<string>): BloquePaso[] {
  return tareasDe(paso.bloques).filter((tarea) => esDecisionSiNo(tarea) && !hechas.has(tarea.id))
}

/**
 * LA PREGUNTA DE SÍ/NO QUE VA FIJA AL PIE: la que cierra la ventana (su última
 * acción) y no abre otra guía con su "No". Responderla es avanzar, igual que
 * una decisión con opciones. Con camino propio para el "No", o si no es lo
 * último, se queda dentro de la ventana, donde esa guía puede desplegarse.
 */
export function siNoDelPie(paso: PasoProcedimiento): BloquePaso | null {
  const tareas = tareasDe(paso.bloques)
  const ultima = tareas[tareas.length - 1]
  if (!ultima || !esDecisionSiNo(ultima)) return null
  return ultima.decisionArticuloId ? null : ultima
}

/**
 * LO QUE FALTA DE UNA GUÍA NECESARIA, dicho para la ventana: la misma frase
 * para la guía del paso y para las que exigen sus tareas. Con varias, la
 * primera por su nombre y cuántas quedan detrás.
 */
export function motivoGuiasDeLaVentana(titulos: readonly string[]): string | null {
  if (titulos.length === 0) return null
  const limpio = titulos[0].trim()
  const primera = limpio ? `«${limpio}»` : 'lo que falta'
  if (titulos.length === 1) return `Completa ${primera} para poder cerrar la ventana.`
  const restantes = titulos.length - 1
  return `Completa ${primera} y ${restantes} ${restantes === 1 ? 'guía más' : 'guías más'} para poder cerrar la ventana.`
}

/** Cuántas respuestas caben fijas junto al pie sin que la ventana pierda su contenido. */
export const MAXIMO_RESPUESTAS_EN_EL_PIE = 3

/**
 * LA PREGUNTA DE LA VENTANA QUE VA FIJA AL PIE: la decisión con opciones del
 * paso (por construcción, su última acción), siempre que tenga pocas
 * respuestas. Con más, se queda dentro de la ventana, a su altura, y el pie
 * dice que hay que responderla.
 */
export function preguntaDelPie(paso: PasoProcedimiento): BloquePaso | null {
  const decision = decisionDeRuta(paso)
  if (!decision) return null
  const opciones = decision.opciones?.length ?? 0
  return opciones > 0 && opciones <= MAXIMO_RESPUESTAS_EN_EL_PIE ? decision : null
}

/**
 * LA DISPOSICIÓN DE LAS RESPUESTAS. Con rótulos cortos ("Sí", "No") la
 * etiqueta va a la izquierda y el criterio a su lado, en una sola fila de
 * 52 px; con rótulos largos ("Outlook clásico") se apilan, y el criterio
 * queda debajo. El umbral es el del prototipo medido a 360 px.
 */
export function disposicionDeRespuestas(opciones: readonly OpcionDecision[]): 'fila' | 'apilada' {
  const mayor = opciones.reduce((largo, opcion) => Math.max(largo, opcion.titulo.trim().length), 0)
  return mayor > 4 ? 'apilada' : 'fila'
}

export type AccionPie =
  // Cierra la ventana y sigue.
  | 'listo'
  // Revisando una ventana ya hecha: lleva a la siguiente sin cerrar nada.
  | 'seguir'
  // Consultando una ventana de más adelante: devuelve a donde está el trabajo.
  | 'volver'
  // No se puede cerrar todavía: el pie lo dice con palabras.
  | 'no-disponible'

export interface PieDeLaVentana {
  accion: AccionPie
  /** Lo que dice el botón principal. Nunca promete lo que no hará. */
  etiqueta: string
  /** El mismo texto sin acortar, para el nombre accesible. */
  etiquetaCompleta: string
  /**
   * POR QUÉ NO SE PUEDE, en una frase aparte (ajuste 5 del 2026-10-21): un
   * botón apagado sin explicación parece una aplicación que falla. Presente
   * solo cuando `accion` es 'no-disponible'.
   */
  motivo: string | null
}

export interface DatosPieDeLaVentana {
  /** La ventana ya se cerró y se está revisando. */
  hecha: boolean
  /**
   * El número (1..n) de la ventana donde está el trabajo, cuando la que se ve
   * es una de más adelante abierta solo para consultarla: no se puede cerrar
   * desde ahí sin haber hecho las anteriores. Null si no es el caso.
   */
  numeroDelTrabajo: number | null
  /** Dónde llevaría "Listo": la ventana siguiente, el final con comprobación o el fin. */
  destino: 'siguiente' | 'comprobar' | 'fin'
  /** Número (1..n) de la ventana a la que se pasa al revisar una hecha, o null. */
  numeroSiguiente: number | null
  /** La primera advertencia crítica sin confirmar, o null. */
  criticaPendiente: BloquePaso | null
  /** Lo que falta de una guía necesaria, ya redactado, o null (ver `motivoGuiasPendientes`). */
  guiaPendiente: string | null
  /** La ventana termina en una pregunta que todavía no tiene respuesta. */
  preguntaPendiente: boolean
  /** La pregunta va fija al pie (y por tanto el botón principal no se pinta). */
  preguntaEnElPie: boolean
}

/**
 * EL BOTÓN PRINCIPAL DEL PIE Y SU EXPLICACIÓN. Una sola respuesta para todas
 * las ventanas: nunca promete lo que no hará y, cuando no se puede, dice qué
 * falta y cómo se resuelve.
 *
 * El orden de lo que falta es el del trabajo: primero la guía necesaria (es
 * lo que el recorrido pone antes), después la advertencia crítica y, al
 * final, la pregunta.
 */
export function pieDeLaVentana(datos: DatosPieDeLaVentana): PieDeLaVentana {
  if (datos.hecha) {
    const etiqueta =
      datos.numeroSiguiente === null ? 'Seguir' : `Seguir en la ventana ${datos.numeroSiguiente}`
    return { accion: 'seguir', etiqueta, etiquetaCompleta: etiqueta, motivo: null }
  }

  if (datos.numeroDelTrabajo !== null) {
    const etiqueta = `Volver a la ventana ${datos.numeroDelTrabajo}`
    return { accion: 'volver', etiqueta, etiquetaCompleta: etiqueta, motivo: null }
  }

  if (datos.guiaPendiente !== null) {
    return {
      accion: 'no-disponible',
      etiqueta: 'Falta terminar la guía necesaria',
      etiquetaCompleta: 'Falta terminar la guía necesaria',
      motivo: datos.guiaPendiente,
    }
  }

  if (datos.criticaPendiente !== null) {
    return {
      accion: 'no-disponible',
      etiqueta: 'Falta confirmar la advertencia',
      etiquetaCompleta: 'Falta confirmar la advertencia',
      motivo: 'Confirma la advertencia crítica de arriba para poder seguir.',
    }
  }

  if (datos.preguntaPendiente && !datos.preguntaEnElPie) {
    return {
      accion: 'no-disponible',
      etiqueta: 'Responde la pregunta',
      etiquetaCompleta: 'Responde la pregunta',
      motivo: 'Responde la pregunta de la ventana: lo que sigue depende de tu respuesta.',
    }
  }

  const etiqueta =
    datos.destino === 'fin'
      ? 'Listo · Terminar guía'
      : datos.destino === 'comprobar'
        ? 'Listo · Comprobar el resultado'
        : 'Listo · Siguiente ventana'
  return { accion: 'listo', etiqueta, etiquetaCompleta: etiqueta, motivo: null }
}

/**
 * LA FRASE DE LA PREGUNTA BLOQUEADA, junto a las respuestas del pie: la misma
 * explicación que el botón principal, dicha donde están los botones. Null
 * cuando las respuestas se pueden tocar.
 */
export function motivoDeLasRespuestas(datos: {
  criticaPendiente: BloquePaso | null
  guiaPendiente: string | null
}): string | null {
  if (datos.guiaPendiente !== null) return datos.guiaPendiente
  if (datos.criticaPendiente !== null) return 'Primero confirma la advertencia de arriba.'
  return null
}

/** Las partes de la ventana que quedan fuera de la vista, para el indicador «Más abajo». */
export type ParteDeLaVentana = 'critica' | 'precaucion' | 'instruccion' | 'comprobacion' | 'pregunta'

export interface FueraDeVista {
  parte: ParteDeLaVentana
  /** El número de la instrucción, solo para 'instruccion'. */
  numero?: number
}

/**
 * EL TEXTO DE «MÁS ABAJO». Un indicador puramente visual (ajuste 4 del
 * 2026-10-21): no se toca, no pide nada, y solo anuncia lo que todavía no se
 * ve. Lo más serio manda: una advertencia crítica fuera de vista lo dice
 * (y el indicador se pinta en rojo); si no, las instrucciones que faltan, con
 * su rango, y la comprobación.
 */
export function textoMasAbajo(fuera: readonly FueraDeVista[]): { texto: string; critico: boolean } | null {
  if (fuera.length === 0) return null
  if (fuera.some((parte) => parte.parte === 'critica')) {
    return { texto: 'Más abajo: advertencia crítica', critico: true }
  }
  const numeros = fuera
    .filter((parte) => parte.parte === 'instruccion' && parte.numero !== undefined)
    .map((parte) => parte.numero as number)
    .sort((a, b) => a - b)
  const comprobacion = fuera.some((parte) => parte.parte === 'comprobacion')
  const pregunta = fuera.some((parte) => parte.parte === 'pregunta')
  const precaucion = fuera.some((parte) => parte.parte === 'precaucion')

  const partes: string[] = []
  if (numeros.length === 1) partes.push(`acción ${numeros[0]}`)
  else if (numeros.length > 1) partes.push(`acciones ${numeros[0]} a ${numeros[numeros.length - 1]}`)
  if (comprobacion) partes.push('comprobación')
  if (pregunta) partes.push('pregunta')
  if (partes.length === 0 && precaucion) partes.push('precaución')
  if (partes.length === 0) return null
  return { texto: `Más abajo: ${partes.join(' y ')}`, critico: false }
}

/** ¿Este aviso se ve en la ventana como una advertencia (precaución o crítica)? */
export function esAdvertencia(bloque: BloquePaso): boolean {
  return bloque.tipo === 'aviso' && presenciaDeAviso(bloque.tono) === 'alerta'
}

/**
 * EL TÍTULO DE LA GUÍA EN LA CABECERA, abreviado cuando el espacio es poco
 * (ajuste 3 del 2026-10-21): el nombre general de la guía puede acortarse, el
 * de la ventana actual nunca. Se acorta por palabras y con «…».
 */
export function tituloAbreviadoDeLaGuia(titulo: string, maximo = 34): string {
  return acortarNombreGuia(titulo, maximo)
}
