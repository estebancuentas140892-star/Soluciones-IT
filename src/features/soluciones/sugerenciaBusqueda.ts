import { normalizarTexto } from './iconosSoluciones'

// "Quizá quisiste decir zebra": la corrección que ofrece el estado vacío
// del buscador de Soluciones cuando nada coincide (mockup 1d de la
// auditoría, decisión P1-12).
//
// Por qué no reutiliza el índice global (MiniSearch, que ya trae
// `fuzzy: 0.2`): ese índice EXCLUYE borradores y obsoletos a propósito, y
// Soluciones los muestra igual (es la razón por la que la tarea 145
// decidió no unificar este buscador con el global, ver BUSCADOR.md §8).
// Sugerir contra un vocabulario que no incluye lo que la lista sí enseña
// daría "no hay nada parecido" con el artículo delante. Así que el
// vocabulario se arma aquí, con lo que esta pantalla realmente lista.

// Distancia de edición con corte temprano: en cuanto la fila mínima supera
// el máximo tolerado se abandona, porque el resultado exacto ya no
// importa (solo si entra o no en la tolerancia). El vocabulario de una
// categoría son decenas de palabras, no miles, pero esto se ejecuta en
// cada pulsación sin resultados.
export function distanciaEdicion(a: string, b: string, maximo: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1

  let previa = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i, ...new Array<number>(b.length).fill(0)]
    let mejorDeLaFila = actual[0]
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1
      actual[j] = Math.min(
        previa[j] + 1, // borrar
        actual[j - 1] + 1, // insertar
        previa[j - 1] + coste, // sustituir
      )
      if (actual[j] < mejorDeLaFila) mejorDeLaFila = actual[j]
    }
    if (mejorDeLaFila > maximo) return maximo + 1
    previa = actual
  }
  return previa[b.length]
}

// Cuánto error se tolera según lo que se escribió. Una consulta corta no
// admite correcciones: con 3 letras, "red" y "web" están a distancia 2 y
// sugerir una por la otra sería adivinar. Mismo criterio que el `fuzzy`
// del índice global, pero explícito.
function toleranciaPara(longitud: number): number {
  if (longitud < 4) return 0
  if (longitud < 7) return 1
  return 2
}

// Parte un texto en palabras normalizadas de 4 letras o más: las cortas
// ("de", "en", "el") no son candidatas útiles a sugerencia.
function palabrasDe(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length >= 4)
}

// El vocabulario contra el que se corrige: títulos, etiquetas y nombres de
// categoría de lo que la lista está mostrando. Se devuelve la forma
// ORIGINAL (con acentos y mayúsculas) indexada por su forma normalizada,
// para poder sugerir "Cámaras" y no "camaras".
export function vocabularioDe(textos: string[]): Map<string, string> {
  const vocabulario = new Map<string, string>()
  for (const texto of textos) {
    for (const palabra of palabrasDe(texto)) {
      if (!vocabulario.has(palabra)) {
        // Se guarda el fragmento original que corresponde a esta palabra
        // normalizada, para poder sugerirla con sus acentos.
        vocabulario.set(palabra, recuperarOriginal(texto, palabra))
      }
    }
  }
  return vocabulario
}

// Encuentra en el texto original la palabra cuya forma normalizada es la
// dada, para devolverla con sus acentos. Si no la encuentra (no debería),
// cae a la normalizada, que sigue siendo legible.
function recuperarOriginal(texto: string, normalizada: string): string {
  for (const palabra of texto.split(/[^\p{L}\p{N}]+/u)) {
    if (normalizarTexto(palabra) === normalizada) return palabra
  }
  return normalizada
}

// La palabra del vocabulario más parecida a la consulta, o null si
// ninguna entra en la tolerancia. Con empate gana la más corta y, a
// igual longitud, la primera alfabéticamente: el resultado tiene que ser
// estable entre teléfonos, no depender del orden de la base.
export function sugerenciaBusqueda(consulta: string, textos: string[]): string | null {
  const termino = normalizarTexto(consulta.trim())
  const tolerancia = toleranciaPara(termino.length)
  if (tolerancia === 0) return null

  const vocabulario = vocabularioDe(textos)
  // Si la consulta YA es una palabra del vocabulario, no hay nada que
  // corregir (no coincidió por otra razón, no por una errata).
  if (vocabulario.has(termino)) return null

  let mejor: { palabra: string; original: string; distancia: number } | null = null
  for (const [palabra, original] of vocabulario) {
    const d = distanciaEdicion(termino, palabra, tolerancia)
    if (d > tolerancia) continue
    if (
      !mejor ||
      d < mejor.distancia ||
      (d === mejor.distancia &&
        (palabra.length < mejor.palabra.length ||
          (palabra.length === mejor.palabra.length && palabra < mejor.palabra)))
    ) {
      mejor = { palabra, original, distancia: d }
    }
  }
  return mejor?.original ?? null
}
