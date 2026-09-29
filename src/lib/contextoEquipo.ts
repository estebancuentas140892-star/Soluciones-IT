// CONTEXTO VISIBLE DE UN EQUIPO: SOLO LO QUE EL NOMBRE NO DICE YA
// (tarea 277, encargo del 2026-09-29, fase 4).
//
// El nombre es la información principal y el subtítulo solo aporta lo
// nuevo. "Impresora Taquilla" con categoría Impresoras y ubicación Taquilla
// no necesita debajo "Impresoras · Taquilla": se leería dos veces lo mismo.
// "HP M404" sí la necesita, y "HP M404 Taquilla" solo la categoría.
//
// Es PRESENTACIÓN: los nombres, las categorías y las ubicaciones guardados
// no cambian. Y es prudente: una parte se calla solo si TODAS sus palabras
// significativas están en el nombre como palabras enteras (sin distinguir
// mayúsculas ni tildes, y con el plural simple: impresora/impresoras,
// cámara/cámaras, switch/switches). Ante la duda, se muestra: "Taquilla
// Norte" no se calla por un nombre que solo dice "Taquilla", y una parte
// hecha solo de números o de una letra suelta ("2", "B") nunca se calla.

// Palabras que no identifican nada por sí solas: "Puntos de red" y
// "Punto de red Taquilla" dicen lo mismo aunque el nombre no repita "de".
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'e', 'a'])

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function palabras(texto: string): string[] {
  return normalizar(texto).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

// Misma palabra, o la misma con el plural simple del español.
function mismaPalabra(a: string, b: string): boolean {
  if (a === b) return true
  const [corta, larga] = a.length < b.length ? [a, b] : [b, a]
  return larga === `${corta}s` || larga === `${corta}es`
}

/**
 * ¿El nombre ya dice esta parte? Solo si todas sus palabras significativas
 * aparecen en él y al menos una es una palabra de verdad (dos caracteres o
 * más, con alguna letra: "HP" o "PC" sirven; "2" o "B", no).
 */
export function nombreYaLoDice(nombre: string, parte: string): boolean {
  const delNombre = palabras(nombre)
  const significativas = palabras(parte).filter((p) => !VACIAS.has(p))
  if (!significativas.some((p) => p.length >= 2 && /\p{L}/u.test(p))) return false
  return significativas.every((p) => delNombre.some((n) => mismaPalabra(n, p)))
}

/**
 * Las partes de contexto (categoría, ubicación, marca...) que aportan algo
 * que el nombre no dice, en su orden, sin vacías ni repetidas.
 */
export function contextoVisible(nombre: string, partes: ReadonlyArray<string | null | undefined>): string[] {
  const visibles: string[] = []
  for (const parte of partes) {
    const texto = parte?.trim()
    if (!texto || nombreYaLoDice(nombre, texto)) continue
    if (visibles.some((v) => normalizar(v) === normalizar(texto))) continue
    visibles.push(texto)
  }
  return visibles
}

/** El subtítulo de una fila: `contextoVisible` unido con " · ". */
export function lineaDeContexto(nombre: string, partes: ReadonlyArray<string | null | undefined>): string {
  return contextoVisible(nombre, partes).join(' · ')
}
