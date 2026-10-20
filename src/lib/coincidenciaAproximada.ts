import { normalizarTexto } from './texto'

// COINCIDENCIA APROXIMADA COMPARTIDA (tarea 346, encargo del 2026-10-20).
//
// Resolver y Equipos tienen que encontrar lo que se buscaba aunque la
// palabra llegue con un error habitual: "impresra" (una letra de menos),
// "impirme" o "garcia" por "gracia" (dos letras cambiadas de sitio), "jose"
// por "José" (sin tilde). Este módulo es la regla común de las dos
// pantallas: cuándo dos palabras son la misma, cuándo se parecen lo
// bastante y qué no se aproxima NUNCA.
//
// 1. Tildes y mayúsculas no son errores: se comparan normalizadas
//    (`normalizarTexto`) y la coincidencia sigue siendo EXACTA.
// 2. La tolerancia es la del índice de siempre (`FRACCION_DIFUSA`): una
//    fracción de la longitud de la palabra, 1 letra de 3 a 7 y 2 de 8 a 12.
//    No se amplía: lo que cambia es CÓMO se cuenta. MiniSearch mide con
//    Levenshtein, donde dos letras cambiadas de sitio cuestan 2 ("impirme"
//    no llegaba a "imprime"); aquí se mide con Damerau-Levenshtein (la
//    variante de alineación óptima), donde cuestan 1, como lo que son: un
//    solo error al teclear.
// 3. Lo que identifica algo por su valor exacto no se aproxima nunca: una
//    IP, un serial, una placa, un modificador de comando ("/flushdns"), una
//    ruta o un correo. Se reconoce por cómo se escribió: con un dígito o un
//    símbolo propio de esos valores (`palabrasLiterales`). "XK7Q2291" no
//    puede traer el equipo "XK7Q2292".
// 4. Solo se aproxima una palabra hecha de letras contra un término hecho
//    de letras.
//
// Es lógica pura, sin React ni base de datos: la prueban
// `coincidenciaAproximada.test.ts` y las pruebas de cada buscador.

// Los mismos separadores con los que MiniSearch parte un texto en
// términos (espacios y signos de puntuación de Unicode).
export const SEPARADOR_TERMINOS = /[\n\r\p{Z}\p{P}]+/u

/** Los términos de un texto, normalizados y en orden (con repeticiones). */
export function terminosDe(texto: string | null | undefined): string[] {
  if (!texto) return []
  return normalizarTexto(texto)
    .split(SEPARADOR_TERMINOS)
    .filter((termino) => termino !== '')
}

/** Tolerancia a erratas: una fracción de la longitud del término (la del índice). */
export const FRACCION_DIFUSA = 0.2
// El tope por defecto de MiniSearch (`maxFuzzy`).
const MAXIMA_DISTANCIA = 6

/** Cuántos errores tolera una palabra de esta longitud. */
export function toleranciaDe(palabra: string): number {
  return Math.min(MAXIMA_DISTANCIA, Math.round(palabra.length * FRACCION_DIFUSA))
}

const SOLO_LETRAS = /^\p{L}+$/u

/** ¿Es una palabra hecha solo de letras (ya normalizada)? */
export function esSoloLetras(palabra: string): boolean {
  return SOLO_LETRAS.test(palabra)
}

/** ¿Esta palabra (normalizada) admite una coincidencia aproximada? */
export function esAproximable(palabra: string): boolean {
  return esSoloLetras(palabra) && toleranciaDe(palabra) > 0
}

/**
 * Distancia de edición de Levenshtein con corte: en cuanto una fila entera
 * supera el tope, ya no puede bajar y se abandona (devuelve `tope + 1`).
 * Es la que usa MiniSearch para su tolerancia.
 */
export function distanciaLevenshtein(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    let minimo = i
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      const valor = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + costo)
      actual.push(valor)
      if (valor < minimo) minimo = valor
    }
    if (minimo > tope) return tope + 1
    anterior = actual
  }
  return anterior[b.length]
}

/**
 * Distancia de Damerau-Levenshtein (alineación óptima) con corte: como
 * Levenshtein, pero dos letras vecinas cambiadas de sitio cuestan 1 y no 2
 * ("garcia" y "gracia" están a 1). Devuelve `tope + 1` si la supera.
 */
export function distanciaDamerau(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1
  // Tres filas: la de hace dos (para la transposición), la anterior y la actual.
  let antepenultima: number[] = []
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    let minimo = i
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      let valor = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + costo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valor = Math.min(valor, antepenultima[j - 2] + 1)
      }
      actual.push(valor)
      if (valor < minimo) minimo = valor
    }
    if (minimo > tope) return tope + 1
    antepenultima = anterior
    anterior = actual
  }
  return anterior[b.length]
}

// Lo escrito que identifica algo por su VALOR: con un dígito (IP, serial,
// placa, puerto) o con un símbolo propio de esos valores (el punto de una
// IP o un dominio, la barra de un modificador o una ruta, los dos puntos de
// una MAC, la arroba de un correo, el guion bajo de un identificador). Un
// guion al principio es un modificador de comando ("-t").
const PARECE_VALOR = /[\p{Nd}./\\:@_#]/u

/**
 * Las palabras (normalizadas) que vienen de algo escrito como un valor
 * exacto: nunca se aproximan. "ping 10.10.6.8 -t" protege 10, 6, 8 y t;
 * "ipconfig /flushdns" protege flushdns, pero no ipconfig.
 */
export function palabrasLiterales(consulta: string): Set<string> {
  const literales = new Set<string>()
  for (const escrito of consulta.trim().split(/\s+/)) {
    // La puntuación de la frase no es parte del valor: "no impirme." sigue
    // siendo una palabra de letras.
    const trozo = escrito.replace(/^[¿¡"'«(]+/u, '').replace(/[.,;:!?"'»)]+$/u, '')
    if (trozo === '') continue
    if (PARECE_VALOR.test(trozo) || trozo.startsWith('-')) {
      for (const termino of terminosDe(trozo)) literales.add(termino)
    }
  }
  return literales
}

/** Cómo coincide un término de los datos con una palabra escrita. */
export type ClaseCoincidencia = 'exacta' | 'prefijo' | 'aproximada'

export interface CoincidenciaDePalabra {
  clase: ClaseCoincidencia
  /** 0 si es exacta o por prefijo; los errores que se toleraron, si no. */
  distancia: number
}

/**
 * ¿El término de los datos es la palabra escrita? Exacto, por prefijo (si
 * se permite: es lo que se está tecleando) o aproximado (si la palabra lo
 * admite y el término también es de letras). Las dos llegan normalizadas.
 */
export function coincidenciaDePalabra(
  palabra: string,
  termino: string,
  { prefijo = true, aproximada = true }: { prefijo?: boolean; aproximada?: boolean } = {},
): CoincidenciaDePalabra | null {
  if (termino === palabra) return { clase: 'exacta', distancia: 0 }
  if (prefijo && termino.startsWith(palabra)) return { clase: 'prefijo', distancia: 0 }
  if (!aproximada || !esAproximable(palabra) || !esSoloLetras(termino)) return null
  const tope = toleranciaDe(palabra)
  const distancia = distanciaDamerau(termino, palabra, tope)
  return distancia <= tope ? { clase: 'aproximada', distancia } : null
}
