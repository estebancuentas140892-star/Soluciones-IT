import type { Alcance } from './alcanceBusqueda'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

// LA FILA DE CATEGORÍAS DENTRO DE UN ALCANCE (auditoría de Resolver, Equipos y
// Agenda del 2026-10-27, D2, tarea 362). Los chips de tipo (tarea 330) dicen
// qué es cada resultado, pero no se podía acotar por la categoría técnica:
// buscando «impresora» y tocando «Guías», las de Impresoras, POS y Software
// seguían mezcladas. Elegido «Guías» o «Equipos», si lo encontrado reparte en
// dos o más categorías, aparece una segunda fila: «Todas» y cada categoría con
// cuántos tiene, de la que más a la que menos. Tipo y categoría se combinan.
//
// Como los chips de tipo, solo filtra la vista de lo que ya se encontró: no
// cambia qué se busca, ni el orden, ni el índice (BUSCADOR.md).

/** Una categoría de la fila, con cuántos resultados suyos hay. */
export interface CategoriaConCuenta {
  nombre: string
  cantidad: number
}

/** El nombre de la categoría de un resultado, o '' si no tiene. */
export type CategoriaDe = (resultado: ResultadoBusqueda) => string

/** Lo que cuenta en la fila: las guías (con pasos o con preguntas) y los equipos. */
function cuentaEnLaFila(resultado: ResultadoBusqueda): boolean {
  return resultado.tipo === 'articulo' || resultado.tipo === 'diagnostico' || resultado.tipo === 'dispositivo'
}

/**
 * Las categorías de lo encontrado en un alcance, de la que más tiene a la que
 * menos (con empate, en el orden en que aparecen). Vacío fuera de «Guías» y
 * «Equipos», o si todo es de una sola categoría: una fila con un chip no
 * acota nada. `total` es lo que dice «Todas».
 */
export function categoriasDelAlcance(
  alcance: Alcance,
  resultados: ResultadoBusqueda[],
  categoriaDe: CategoriaDe,
): { categorias: CategoriaConCuenta[]; total: number } {
  if (alcance !== 'guias' && alcance !== 'equipos') return { categorias: [], total: 0 }
  const cuentas = new Map<string, number>()
  let total = 0
  for (const resultado of resultados) {
    if (!cuentaEnLaFila(resultado)) continue
    total += 1
    const nombre = categoriaDe(resultado)
    if (nombre) cuentas.set(nombre, (cuentas.get(nombre) ?? 0) + 1)
  }
  if (cuentas.size < 2) return { categorias: [], total: 0 }
  const categorias = [...cuentas]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
  return { categorias, total }
}

/**
 * La categoría que de verdad se aplica: la elegida mientras esté en la fila;
 * si al cambiar lo escrito se queda sin resultados, «Todas».
 */
export function categoriaEfectiva(categoria: string | null, categorias: CategoriaConCuenta[]): string | null {
  return categoria !== null && categorias.some((c) => c.nombre === categoria) ? categoria : null
}

/**
 * Lo encontrado de una categoría, en el orden de siempre. Una categoría que
 * coincide (el resultado «Impresoras») se queda con su propia categoría.
 */
export function filtrarPorCategoria(
  resultados: ResultadoBusqueda[],
  categoria: string | null,
  categoriaDe: CategoriaDe,
): ResultadoBusqueda[] {
  if (categoria === null) return resultados
  return resultados.filter((resultado) => (resultado.tipo === 'categoria' ? resultado.titulo : categoriaDe(resultado)) === categoria)
}

/**
 * El id de la guía de un resultado de guía: el suyo, o el de la guía que
 * contiene un adjunto (`adjunto:<guía>:<paso>:<referencia>`).
 */
export function idDeGuiaDe(resultado: ResultadoBusqueda): string {
  const partes = resultado.id.split(':')
  return partes[1] ?? ''
}
