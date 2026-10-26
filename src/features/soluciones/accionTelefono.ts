import type { BloquePaso, PasoAdjunto, Referencia, ResultadoVisual } from '../../lib/db'
import type { NotaDeGuia } from './notasGuia'
import type { PieDeLaVentana } from './ventana'

// UNA ACCIÓN POR PANTALLA EN EL TELÉFONO (tarea 355, «Equilibrada esencial»
// de Claude Design, elegida por el usuario el 2026-10-26; AD-098).
//
// Por debajo de 768 px la guía se ejecuta una acción a la vez, y la pantalla
// enseña SOLO lo necesario para hacerla: dónde, el riesgo real si lo hay, la
// instrucción, «Cómo hacerlo», el dato técnico, el comando, la credencial y,
// en una comprobación o una decisión, lo suyo. Lo que acompaña (imágenes,
// notas, para qué, qué significa un término, archivos, guías de consulta, lo
// que sigue y los requisitos) se abre a pedido en la hoja «Ayuda con este
// paso». Lo que sigue es la lógica pura de esa pantalla, sin React, para que
// se pruebe sola y la pantalla solo pinte.

// ----------------------------------------------------------------
// La instrucción
// ----------------------------------------------------------------

/** Los cuatro tamaños de la instrucción, en px, a 390 de ancho. */
export type TamanoInstruccion = 30 | 26 | 22 | 19

/**
 * EL TAMAÑO DE LA INSTRUCCIÓN SEGÚN SU LARGO (sección 8 de la
 * especificación): una orden corta («Pulsa Guardar») se lee de un vistazo a
 * 30 px; una larga baja de tamaño para no ocupar media pantalla, y nunca se
 * recorta (regla 23). Se cuenta en caracteres del texto sin espacios de los
 * bordes.
 */
export function tamanoDeInstruccion(texto: string): TamanoInstruccion {
  const largo = [...texto.trim()].length
  if (largo <= 22) return 30
  if (largo <= 44) return 26
  if (largo <= 80) return 22
  return 19
}

// El ajuste por ancho, en CSS y no en JavaScript: −3 px por debajo de 350,
// −1 de 350 a 379 y +1 desde 420. Las cadenas son literales para que
// Tailwind las encuentre; `max-[349px]` va después de `max-[379px]` en la
// hoja generada, así que manda en el teléfono más estrecho.
const CLASES_TAMANO: Record<TamanoInstruccion, string> = {
  30: 'text-[30px] max-[379px]:text-[29px] max-[349px]:text-[27px] min-[420px]:text-[31px]',
  26: 'text-[26px] max-[379px]:text-[25px] max-[349px]:text-[23px] min-[420px]:text-[27px]',
  22: 'text-[22px] max-[379px]:text-[21px] max-[349px]:text-[19px] min-[420px]:text-[23px]',
  19: 'text-[19px] max-[379px]:text-[18px] max-[349px]:text-[16px] min-[420px]:text-[20px]',
}

/** Las clases de tamaño de la instrucción (peso, interlineado e interletrado van aparte). */
export function claseTamanoInstruccion(texto: string): string {
  return CLASES_TAMANO[tamanoDeInstruccion(texto)]
}

// ----------------------------------------------------------------
// La línea bajo el título de la guía
// ----------------------------------------------------------------

/**
 * «Paso 2 de 4 · acción 1 de 3 · POSPN01». La acción solo cuando el paso tiene
 * más de una: «acción 1 de 1» no dice nada que no diga el paso (regla 22). El
 * equipo, si lo hay.
 */
export function lineaDeLaAccion(paso: string, accion: { actual: number; total: number } | null, equipo: string): string {
  return partesDeLaLinea(paso, accion, equipo).join(' · ')
}

/** Las mismas partes por separado, para que la línea baje entre ellas y no a mitad de una. */
export function partesDeLaLinea(
  paso: string,
  accion: { actual: number; total: number } | null,
  equipo: string,
): string[] {
  const partes = [paso]
  if (accion && accion.total > 1) partes.push(`acción ${accion.actual + 1} de ${accion.total}`)
  if (equipo.trim()) partes.push(equipo.trim())
  return partes
}

// ----------------------------------------------------------------
// El pie
// ----------------------------------------------------------------

/** A dónde lleva «Listo» desde la acción: la siguiente, la comprobación final o el fin de la guía. */
export type DestinoListo = 'siguiente' | 'comprobar' | 'fin'

/** «Listo · Siguiente», «Listo · Comprobar el resultado» o «Listo · Terminar guía». */
export function rotuloListo(destino: DestinoListo): string {
  if (destino === 'fin') return 'Listo · Terminar guía'
  if (destino === 'comprobar') return 'Listo · Comprobar el resultado'
  return 'Listo · Siguiente'
}

export interface DatosPieDeLaAccion {
  /**
   * Se consulta un paso de más adelante: el número (1..n) del paso donde está
   * el trabajo. Desde ahí no se marca nada: el único gesto es volver.
   */
  numeroDelTrabajo: number | null
  /**
   * Se revisa algo ya hecho (se llegó con «Anterior»): a dónde lleva seguir
   * sin marcar nada («Ir a la acción 3», «Ir al paso 4»). Null si no.
   */
  seguir: { etiqueta: string; etiquetaCompleta?: string } | null
  /** Lo que falta de una guía necesaria, ya redactado (`motivoGuiasDeLaAccion`), o null. */
  guiaPendiente: string | null
  /** Hay una advertencia crítica de esta acción sin confirmar. */
  criticaPendiente: boolean
  /** La pregunta de la acción espera respuesta y sus respuestas no van en el pie. */
  preguntaPendiente: boolean
  /** A dónde lleva «Listo». */
  destino: DestinoListo
}

/**
 * EL BOTÓN PRINCIPAL DEL PIE Y SU EXPLICACIÓN: la misma gramática que el pie
 * de la ventana (`pieDeLaVentana`), para una acción. Nunca promete lo que no
 * hará y, cuando no se puede, una frase dice qué falta (regla 31 b). El orden
 * de lo que falta es el del trabajo: la guía necesaria, la advertencia crítica
 * y la pregunta.
 */
export function pieDeLaAccion(datos: DatosPieDeLaAccion): PieDeLaVentana {
  if (datos.numeroDelTrabajo !== null) {
    const etiqueta = `Volver al paso ${datos.numeroDelTrabajo}`
    return { accion: 'volver', etiqueta, etiquetaCompleta: etiqueta, motivo: null }
  }
  if (datos.seguir !== null) {
    return {
      accion: 'seguir',
      etiqueta: datos.seguir.etiqueta,
      etiquetaCompleta: datos.seguir.etiquetaCompleta ?? datos.seguir.etiqueta,
      motivo: null,
    }
  }
  if (datos.guiaPendiente !== null) {
    return noDisponible('Falta terminar la guía necesaria', datos.guiaPendiente)
  }
  if (datos.criticaPendiente) {
    return noDisponible('Falta confirmar la advertencia', 'Confirma la advertencia crítica de arriba para poder seguir.')
  }
  if (datos.preguntaPendiente) {
    return noDisponible('Responde la pregunta', 'Elige una respuesta: lo que sigue depende de ella.')
  }
  const etiqueta = rotuloListo(datos.destino)
  return { accion: 'listo', etiqueta, etiquetaCompleta: etiqueta, motivo: null }
}

function noDisponible(etiqueta: string, motivo: string): PieDeLaVentana {
  return { accion: 'no-disponible', etiqueta, etiquetaCompleta: etiqueta, motivo }
}

/**
 * LO QUE FALTA DE UNA GUÍA NECESARIA, dicho para la acción: la primera por su
 * nombre y cuántas quedan detrás. Null sin ninguna.
 */
export function motivoGuiasDeLaAccion(titulos: readonly string[]): string | null {
  if (titulos.length === 0) return null
  const limpio = titulos[0].trim()
  const primera = limpio ? `«${limpio}»` : 'lo que falta'
  if (titulos.length === 1) return `Completa ${primera} para poder seguir.`
  const restantes = titulos.length - 1
  return `Completa ${primera} y ${restantes} ${restantes === 1 ? 'guía más' : 'guías más'} para poder seguir.`
}

// ----------------------------------------------------------------
// «Ayuda con este paso»
// ----------------------------------------------------------------

/** Una imagen de la ayuda: un bloque imagen (con su pie) o una de la galería del paso. */
export interface ImagenDeAyuda {
  id: string
  adjunto: PasoAdjunto
  pie: string
}

/** Lo que una acción tiene para acompañarla, ya repartido. */
export interface ContenidoDeAyuda {
  /** Los requisitos de la guía: solo en su primera acción y sin avance (lo decide quien llama). */
  requisitos: readonly string[]
  /** La imagen de «Debes ver» de una ACCIÓN (en una comprobación se queda en pantalla). */
  resultadoVisual: ResultadoVisual | null
  imagenes: readonly ImagenDeAyuda[]
  /** Los términos y herramientas del glosario enlazados a la acción. */
  terminos: readonly BloquePaso[]
  /** Los comandos y atajos que la instrucción escribe y tienen ficha («¿Qué hace «X»?»). */
  queHace: readonly Referencia[]
  /** El «Para qué» del paso, en su primera acción. */
  paraQue: string
  notas: readonly NotaDeGuia[]
  archivos: readonly PasoAdjunto[]
  /** Las guías de consulta de la acción (bloques `guia` con intención `consulta`). */
  guiasDeConsulta: readonly BloquePaso[]
  /** La instrucción de lo que viene después, «Comprobación final», «Fin de la guía», o null. */
  loQueSigue: string | null
}

export type SeccionAyuda =
  | { clave: 'requisitos'; requisitos: string[] }
  | { clave: 'funciono'; resultado: ResultadoVisual }
  | { clave: 'imagenes'; imagenes: ImagenDeAyuda[] }
  | { clave: 'significa'; terminos: BloquePaso[]; queHace: Referencia[] }
  | { clave: 'paraQue'; texto: string }
  | { clave: 'notas'; notas: NotaDeGuia[] }
  | { clave: 'archivos'; archivos: PasoAdjunto[] }
  | { clave: 'consulta'; guias: BloquePaso[] }
  | { clave: 'loQueSigue'; texto: string }

/** El rótulo de cada sección, tal como lo lee el técnico. */
export const ROTULOS_AYUDA: Record<SeccionAyuda['clave'], string> = {
  requisitos: 'Antes de empezar, ten a mano',
  funciono: 'Así sabes que funcionó',
  imagenes: 'Imágenes',
  significa: 'Qué significa',
  paraQue: 'Para qué',
  notas: 'Notas',
  archivos: 'Archivos',
  consulta: 'Guías de consulta',
  loQueSigue: 'Lo que sigue',
}

/**
 * LAS SECCIONES DE LA AYUDA, EN SU ORDEN (sección 6 de la especificación).
 * Cada una aparece solo si tiene contenido: nunca hay una sección vacía, y una
 * acción sin nada que la acompañe no tiene ayuda (el botón no se dibuja).
 */
export function seccionesDeAyuda(contenido: ContenidoDeAyuda): SeccionAyuda[] {
  const secciones: SeccionAyuda[] = []
  const requisitos = contenido.requisitos.map((r) => r.trim()).filter(Boolean)
  if (requisitos.length > 0) secciones.push({ clave: 'requisitos', requisitos })
  if (contenido.resultadoVisual) secciones.push({ clave: 'funciono', resultado: contenido.resultadoVisual })
  if (contenido.imagenes.length > 0) secciones.push({ clave: 'imagenes', imagenes: [...contenido.imagenes] })
  if (contenido.terminos.length > 0 || contenido.queHace.length > 0) {
    secciones.push({ clave: 'significa', terminos: [...contenido.terminos], queHace: [...contenido.queHace] })
  }
  const paraQue = contenido.paraQue.trim()
  if (paraQue) secciones.push({ clave: 'paraQue', texto: paraQue })
  if (contenido.notas.length > 0) secciones.push({ clave: 'notas', notas: [...contenido.notas] })
  if (contenido.archivos.length > 0) secciones.push({ clave: 'archivos', archivos: [...contenido.archivos] })
  if (contenido.guiasDeConsulta.length > 0) secciones.push({ clave: 'consulta', guias: [...contenido.guiasDeConsulta] })
  const sigue = contenido.loQueSigue?.trim() ?? ''
  if (sigue) secciones.push({ clave: 'loQueSigue', texto: sigue })
  return secciones
}

/**
 * LA ETIQUETA DEL BOTÓN DE AYUDA: «Ten a mano 2 cosas», solo cuando hay
 * requisitos que ver (la primera acción de la guía, sin avance). Null si no.
 */
export function etiquetaTenAMano(requisitos: readonly string[]): string | null {
  const cuantos = requisitos.filter((r) => r.trim()).length
  if (cuantos === 0) return null
  return `Ten a mano ${cuantos} ${cuantos === 1 ? 'cosa' : 'cosas'}`
}

/** ¿El adjunto es una imagen? Las de la galería del paso van a «Imágenes»; lo demás, a «Archivos». */
export function esImagen(adjunto: PasoAdjunto): boolean {
  return adjunto.tipo.startsWith('image/')
}
