import { distanciaLevenshtein, FRACCION_DIFUSA, toleranciaDe } from '../../lib/coincidenciaAproximada'
import { normalizarTexto } from '../soluciones/iconosSoluciones'

// LA CONSULTA COMO LA ESCRIBE UNA PERSONA (tarea 288, encargo del
// 2026-10-02). Resolver ya no recibe solo nombres de guías: recibe frases
// ("la impresora de mercadeo no imprime", "no me deja enviar archivo
// pesado"). Este módulo es el vocabulario común del buscador para
// leerlas: qué palabras dicen algo, cuáles no, y cuándo una palabra del
// índice es la misma que la escrita (exacta, por prefijo o con una errata).
//
// Lo usan el índice (`buscarConSinonimos`, para buscar solo lo que dice
// algo y anotar en qué campo coincidió cada palabra) y el ranking
// (`mejores.ts`, para medir cuánto de la consulta explica cada resultado).
// Todo es local y determinista: sin IA generativa ni servicios externos.

// Los mismos separadores con los que MiniSearch parte el texto en
// términos (espacios y signos de puntuación de Unicode). Partir la
// consulta igual garantiza que una palabra de aquí es un término de allá:
// "10.10.6.8" son las palabras 10, 6 y 8, como en el índice.
const SEPARADOR = /[\n\r\p{Z}\p{P}]+/u

/**
 * Palabras sin valor de búsqueda: artículos, preposiciones, conjunciones,
 * pronombres y los verbos de relleno de una frase ("no me DEJA enviar",
 * "no PUEDE entrar"). Buscarlas hacía daño de verdad: MiniSearch busca
 * por prefijo y OR, así que "una" encontraba cada título con "una" y "me"
 * traía "Mercadeo" (el ANTES del benchmark: "llegó una persona nueva"
 * ponía primero "Conectar una impresora de red en Windows").
 *
 * Solo se quitan para BUSCAR. Para leer la intención cuentan ("no" y
 * "sin" son las marcas de un problema; "cómo", la de un procedimiento):
 * eso lo decide `intencionesDeConsulta` sobre la frase entera.
 */
export const PALABRAS_VACIAS_CONSULTA: ReadonlySet<string> = new Set([
  // Artículos y contracciones
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del',
  // Preposiciones
  'a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por',
  'segun', 'sin', 'sobre', 'tras', 'via',
  // Conjunciones
  'y', 'e', 'o', 'u', 'ni', 'pero', 'que', 'si', 'sino', 'porque', 'pues', 'aunque',
  // Pronombres y demostrativos
  'me', 'mi', 'mis', 'te', 'tu', 'tus', 'se', 'su', 'sus', 'le', 'les', 'nos', 'yo', 'ella', 'ellos',
  'esto', 'esta', 'este', 'eso', 'esa', 'ese', 'estos', 'estas',
  // Verbos de relleno y auxiliares
  'es', 'son', 'era', 'fue', 'ser', 'estar', 'estan', 'hay', 'ha', 'han', 'he', 'tiene', 'tienen', 'tengo',
  'puede', 'pueden', 'puedo', 'deja', 'dejan', 'quiero', 'necesito', 'hacer', 'hago',
  // Negación, cantidad e interrogativos
  'no', 'ya', 'muy', 'mas', 'tambien', 'como', 'cual', 'cuales', 'donde', 'cuando', 'quien',
])

/**
 * Las palabras de una consulta, normalizadas (minúsculas y sin tildes,
 * igual que el índice desde la tarea 288) y sin repetir, en el orden en
 * que se escribieron.
 */
export function palabrasDeConsulta(consulta: string): string[] {
  const vistas = new Set<string>()
  const palabras: string[] = []
  for (const parte of normalizarTexto(consulta).split(SEPARADOR)) {
    if (parte !== '' && !vistas.has(parte)) {
      vistas.add(parte)
      palabras.push(parte)
    }
  }
  return palabras
}

/**
 * Las palabras que dicen algo: las de la consulta sin las vacías. Si la
 * consulta SOLO tiene palabras vacías ("no", "de"), se devuelven todas:
 * quien busca eso busca eso, y quitarlas dejaría la búsqueda vacía.
 */
export function palabrasDeContenido(consulta: string): string[] {
  const todas = palabrasDeConsulta(consulta)
  const contenido = todas.filter((palabra) => !PALABRAS_VACIAS_CONSULTA.has(palabra))
  return contenido.length > 0 ? contenido : todas
}

/**
 * ¿Se busca `termino` también por prefijo? Mientras se escribe, sí
 * ("impre" encuentra "impresora"), salvo una letra suelta que ACOMPAÑA a
 * otras palabras (2026-09-14): en "windows r" la "r" es la tecla, no el
 * comienzo de "router". Es la regla que el índice aplica a cada término;
 * vive aquí para que la anotación de campos use exactamente la misma.
 */
export function usaPrefijo(termino: string, terminos: readonly string[]): boolean {
  return termino.length > 1 || terminos.length === 1
}

/** Tolerancia a erratas del índice: una fracción de la longitud del término. */
export { FRACCION_DIFUSA }

/** Cuántas letras distintas tolera el índice en un término de esta longitud. */
export function distanciaMaxima(termino: string): number {
  return toleranciaDe(termino)
}

/**
 * ¿El término del índice `terminoIndice` es la palabra escrita? Igual que
 * lo decide MiniSearch al buscar: idéntico, por prefijo (si la palabra se
 * busca por prefijo) o con una errata dentro de la tolerancia. Es lo que
 * permite decir en qué campo coincidió CADA palabra: MiniSearch devuelve
 * los términos del documento que coincidieron, no de qué palabra salieron.
 */
export function derivaDe(terminoIndice: string, palabra: string, prefijo: boolean): boolean {
  if (terminoIndice === palabra) return true
  if (prefijo && terminoIndice.startsWith(palabra)) return true
  const tope = distanciaMaxima(palabra)
  return tope > 0 && distanciaLevenshtein(terminoIndice, palabra, tope) <= tope
}
