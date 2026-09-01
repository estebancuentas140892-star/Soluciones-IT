import { siguientePasoPendiente } from '../../lib/procedimiento'

// Las dos decisiones de la hoja "Algo va mal en el paso N" (handoff
// "Diseño móvil", tablero 3d) que no son interfaz sino reglas: a dónde
// lleva "saltar el paso y seguir", y qué se le promete al técnico sobre
// su avance antes de que elija una salida.
//
// Viven fuera del componente porque las dos tienen casos límite que se
// razonan mejor con pruebas que mirando la pantalla: el último paso, el
// procedimiento de un solo paso, y el paso que se salta cuando todos
// los demás ya están hechos.

/**
 * A qué paso lleva "saltar el paso y seguir".
 *
 * Saltar es AVANZAR sin marcar: el paso queda pendiente y el índice lo
 * pinta como "saltado" (estado derivado, ver `estadoPasos.ts`). Por eso
 * el destino natural es el siguiente en orden, esté hecho o no: el
 * técnico salta el paso 3 y aterriza en el 4, como si hubiera avanzado.
 *
 * Devuelve `null` cuando no hay a dónde ir, y entonces la salida NO se
 * ofrece. Es el caso del último paso pendiente: saltarlo dejaría el
 * procedimiento sin ningún paso por delante, y la pantalla de cierre
 * diría "procedimiento completado" sobre un paso que falló. Un botón
 * que miente es peor que un botón que no está.
 */
export function destinoAlSaltar(
  indiceActual: number,
  idsPasos: string[],
  hechos: ReadonlySet<string>,
): number | null {
  if (indiceActual + 1 < idsPasos.length) return indiceActual + 1
  // Último paso: solo queda volver a alguno pendiente de más atrás.
  // `siguientePasoPendiente` nunca devuelve el paso de partida, así que
  // no puede dejar al técnico donde ya estaba.
  return siguientePasoPendiente(idsPasos, hechos, indiceActual)
}

/**
 * La promesa que acompaña a la lista de salidas: ninguna de ellas borra
 * lo que ya se marcó. Se dice con el número real de pasos hechos porque
 * "no se pierde nada" suena a fórmula y "los 4 pasos que llevas hechos
 * no se pierden" se puede comprobar.
 */
export function fraseAvanceConservado(pasosHechos: number): string {
  if (pasosHechos <= 0) return 'Elige la salida. Ninguna borra lo que ya marcaste.'
  if (pasosHechos === 1) return 'Elige la salida. El paso que llevas hecho no se pierde.'
  return `Elige la salida. Los ${pasosHechos} pasos que llevas hechos no se pierden.`
}
