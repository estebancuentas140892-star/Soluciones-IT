import type { Articulo } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'

// VALIDACION DE VINCULOS AL CONFIGURARLOS (seccion 5, punto 10 del
// encargo del 2026-09-08: "Validar referencias circulares y destinos
// invalidos al configurar vinculos y decisiones").
//
// La ejecucion ya estaba a salvo de un bucle infinito: `modoVinculo`
// solo despliega un nivel y a partir de ahi enlaza. Pero a salvo no es
// lo mismo que correcto. Un ciclo A -> B -> A es casi siempre un error
// del autor, y hoy no se le decia nada: lo descubria el tecnico frente
// al equipo, cuando la guia vinculada le pedia volver a la que estaba
// haciendo.
//
// Esto NO impide guardar: avisa. Hay casos legitimos ("si esto falla,
// mira la guia general", y la general referencia esta como ejemplo), y
// el autor es quien sabe cual es el suyo.

/** Todos los articulos a los que apunta el procedimiento de uno dado. */
export function destinosDe(articulo: Articulo | undefined | null): Set<string> {
  const destinos = new Set<string>()
  const procedimiento = normalizarProcedimiento(articulo?.procedimiento)
  if (!procedimiento) return destinos
  for (const paso of procedimiento.pasos) {
    if (paso.subArticuloId) destinos.add(paso.subArticuloId)
    if (paso.solucionArticuloId) destinos.add(paso.solucionArticuloId)
    for (const bloque of paso.bloques) {
      if (bloque.decisionArticuloId) destinos.add(bloque.decisionArticuloId)
      if (bloque.guiaArticuloId) destinos.add(bloque.guiaArticuloId)
    }
  }
  return destinos
}

/**
 * ¿Vincular `destino` desde `articuloId` cierra un ciclo? True cuando
 * el destino apunta de vuelta al articulo que se esta editando, directa
 * o indirectamente (se recorre el grafo, con tope de profundidad para
 * que un ciclo entre terceros no cuelgue la busqueda).
 */
export function cierraCiclo(
  articuloId: string,
  destinoId: string,
  articulosPorId: ReadonlyMap<string, Articulo>,
): boolean {
  if (destinoId === articuloId) return true
  const vistos = new Set<string>([destinoId])
  const cola = [destinoId]
  while (cola.length > 0) {
    const actual = cola.shift() as string
    for (const siguiente of destinosDe(articulosPorId.get(actual))) {
      if (siguiente === articuloId) return true
      if (vistos.has(siguiente)) continue
      vistos.add(siguiente)
      cola.push(siguiente)
    }
  }
  return false
}

/**
 * Aviso legible para el autor, o null si el vinculo no tiene problema.
 * Solo describe: no bloquea el guardado (ver la cabecera).
 */
export function avisoDeVinculo(
  articuloId: string,
  destinoId: string,
  articulosPorId: ReadonlyMap<string, Articulo>,
): string | null {
  const destino = articulosPorId.get(destinoId)
  if (!destino || destino.eliminadoEn) {
    return 'Esa guía ya no está disponible en este dispositivo. Revísala antes de publicar.'
  }
  if ((destino.estado ?? 'publicado') !== 'publicado') {
    return `«${destino.titulo}» todavía no está publicada, así que el equipo no la verá al ejecutar esta guía.`
  }
  if (cierraCiclo(articuloId, destinoId, articulosPorId)) {
    return `«${destino.titulo}» vuelve a apuntar a esta guía. Revisa el recorrido: quien la siga puede acabar dando vueltas.`
  }
  return null
}
