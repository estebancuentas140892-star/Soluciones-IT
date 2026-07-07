// Logica pura del patron de desbloqueo (una cuadricula 3x3, como el
// de muchos telefonos). Sin React ni APIs del navegador para poder
// probarla de forma aislada. El patron se guarda en la app SIEMPRE
// serializado a texto (por ejemplo "0-4-8") y ese texto es el "secreto"
// del que se deriva la clave del verificador: el dibujo nunca viaja ni
// se guarda tal cual.
//
// Los nodos se numeran por fila, de 0 a 8:
//   0 1 2
//   3 4 5
//   6 7 8

export const LADO_PATRON = 3
export const TOTAL_NODOS = LADO_PATRON * LADO_PATRON
// Minimo de puntos para que el patron valga: menos de 4 es demasiado
// facil de adivinar (es el mismo minimo que usa Android).
export const MIN_NODOS_PATRON = 4

// Nodo que queda EN MEDIO de dos nodos alineados que se saltan al
// arrastrar en linea recta (misma fila, columna o diagonal). Devuelve
// null si no hay ninguno en medio. Regla estilo movil: 0->2 pasa por 1,
// 0->8 pasa por 4, 2->6 pasa por 4.
export function nodoIntermedio(a: number, b: number): number | null {
  const filaA = Math.floor(a / LADO_PATRON)
  const colA = a % LADO_PATRON
  const filaB = Math.floor(b / LADO_PATRON)
  const colB = b % LADO_PATRON
  const df = filaB - filaA
  const dc = colB - colA
  // Solo cruza un nodo si ambas diferencias son pares (0 o +-2): asi
  // el punto medio cae exactamente sobre otro nodo de la cuadricula.
  if (df % 2 !== 0 || dc % 2 !== 0) return null
  if (df === 0 && dc === 0) return null
  const filaMedia = filaA + df / 2
  const colMedia = colA + dc / 2
  return filaMedia * LADO_PATRON + colMedia
}

// Agrega un nodo a la secuencia respetando las reglas del patron:
// - un nodo no se repite,
// - si al ir del ultimo nodo al nuevo se cruza un nodo aun sin usar,
//   ese intermedio entra primero (igual que al deslizar el dedo).
// Devuelve una secuencia nueva (no muta la recibida).
export function agregarNodo(secuencia: number[], nodo: number): number[] {
  if (!Number.isInteger(nodo) || nodo < 0 || nodo >= TOTAL_NODOS) return secuencia
  if (secuencia.includes(nodo)) return secuencia
  const resultado = [...secuencia]
  const ultimo = resultado[resultado.length - 1]
  if (ultimo !== undefined) {
    const medio = nodoIntermedio(ultimo, nodo)
    if (medio !== null && !resultado.includes(medio)) resultado.push(medio)
  }
  resultado.push(nodo)
  return resultado
}

export function patronValido(secuencia: number[]): boolean {
  return (
    secuencia.length >= MIN_NODOS_PATRON &&
    new Set(secuencia).size === secuencia.length &&
    secuencia.every((n) => Number.isInteger(n) && n >= 0 && n < TOTAL_NODOS)
  )
}

export function serializarPatron(secuencia: number[]): string {
  return secuencia.join('-')
}

// Cantidad de puntos de un patron serializado ("0-4-8" -> 3). Se usa
// para validar la longitud minima sin tener que reconstruir el dibujo.
export function contarNodosSerializados(patron: string): number {
  return patron ? patron.split('-').length : 0
}
