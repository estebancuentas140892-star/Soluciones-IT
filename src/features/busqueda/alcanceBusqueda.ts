import type { ResultadoBusqueda } from './useIndiceBusqueda'

// LOS ALCANCES DE LA BÚSQUEDA (rediseño móvil "1b Pulgar", tarea 330,
// AD-080). Son chips que SOLO filtran la vista de lo que ya se encontró: no
// cambian qué se busca, ni el orden, ni el índice (BUSCADOR.md). "Todo" es la
// lista de siempre.
//
// Los alcances siguen a los grupos de la lista (`GRUPOS_BUSQUEDA`): "Guías"
// junta guías, guías con preguntas, categorías y adjuntos, como su grupo.
// Lo que no cae en ningún alcance (el Centro de consulta: herramientas,
// términos, atajos y comandos) se ve solo en "Todo". El diseño
// trae también "Facturación": hoy las autorizaciones no se indexan (tarea
// 321), así que no tiene resultados y su chip no se dibuja; si un día se
// indexan, basta con darles su alcance aquí.

export type Alcance = 'todo' | 'equipos' | 'red' | 'guias' | 'personas' | 'lugares' | 'claves'

export const ALCANCES: { valor: Exclude<Alcance, 'todo'>; etiqueta: string }[] = [
  { valor: 'equipos', etiqueta: 'Equipos' },
  { valor: 'red', etiqueta: 'Red' },
  { valor: 'guias', etiqueta: 'Guías' },
  { valor: 'personas', etiqueta: 'Personas' },
  { valor: 'lugares', etiqueta: 'Lugares' },
  { valor: 'claves', etiqueta: 'Claves' },
]

/** El id del equipo de un resultado de equipo, por su ruta (`/dispositivos/:id`). */
function idDeEquipo(resultado: ResultadoBusqueda): string {
  return resultado.ruta.split('?')[0].split('/')[2] ?? ''
}

/** A qué alcance pertenece un resultado, o null si solo se ve en "Todo". */
export function alcanceDe(resultado: ResultadoBusqueda, idsDeRed: ReadonlySet<string>): Exclude<Alcance, 'todo'> | null {
  switch (resultado.tipo) {
    case 'dispositivo':
      return idsDeRed.has(idDeEquipo(resultado)) ? 'red' : 'equipos'
    case 'articulo':
    case 'diagnostico':
    case 'categoria':
    case 'adjunto':
      return 'guias'
    case 'persona':
      return 'personas'
    case 'ubicacion':
      return 'lugares'
    case 'credencial':
      return 'claves'
    default:
      return null
  }
}

/** Cuántos resultados tiene cada alcance ("todo" incluido). */
export function conteoPorAlcance(
  resultados: ResultadoBusqueda[],
  idsDeRed: ReadonlySet<string>,
): Record<Alcance, number> {
  const conteo: Record<Alcance, number> = { todo: resultados.length, equipos: 0, red: 0, guias: 0, personas: 0, lugares: 0, claves: 0 }
  for (const resultado of resultados) {
    const alcance = alcanceDe(resultado, idsDeRed)
    if (alcance) conteo[alcance] += 1
  }
  return conteo
}

/** Los resultados de un alcance, en el orden de siempre. */
export function filtrarPorAlcance(
  resultados: ResultadoBusqueda[],
  alcance: Alcance,
  idsDeRed: ReadonlySet<string>,
): ResultadoBusqueda[] {
  if (alcance === 'todo') return resultados
  return resultados.filter((resultado) => alcanceDe(resultado, idsDeRed) === alcance)
}

/**
 * El alcance que de verdad se aplica: el elegido mientras tenga resultados;
 * si al cambiar lo escrito se queda sin ninguno, "Todo" (un chip vacío no se
 * dibuja, así que no se podría salir de él).
 */
export function alcanceEfectivo(alcance: Alcance, conteo: Record<Alcance, number>): Alcance {
  return alcance !== 'todo' && conteo[alcance] === 0 ? 'todo' : alcance
}
