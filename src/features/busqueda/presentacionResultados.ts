import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { ETIQUETA_TIPO, subtituloConTipo } from './mejores'
import type { ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// CÓMO SE LEE UNA LISTA DE RESULTADOS (propuesta final de Claude Design,
// 2026-10-01, fila "Resultados de búsqueda"). Solo presentación: el
// buscador, el ranking, los sinónimos, el difuso, el modo consulta y las
// reglas de la Bóveda no se tocan, y ningún título se cambia: se pinta
// distinto.
//
//   - LISTA HOMOGÉNEA. Cuando 3 o más filas de una misma sección EMPIEZAN
//     por lo buscado como palabra ("Impresora Mercadeo", "Impresora Caja
//     PN"...), esa parte se atenúa (gris, con subrayado punteado: la
//     coincidencia sigue reconocible) y lo que distingue a cada fila queda
//     en claro. Se comparan "Mercadeo" y "Caja PN" sin leer "Impresora"
//     cinco veces.
//   - EL TIPO SUBE AL ENCABEZADO cuando todos los mejores resultados son
//     del mismo tipo ("Mejores resultados · 5 equipos") y deja de
//     repetirse en cada fila.
//   - LISTA MIXTA. Si no, la coincidencia se resalta con acento y cada fila
//     dice su tipo ("Guía", "Equipo", "Persona"...), con su icono y tinte.
//
// Prudencia (encargo): la optimización no se aplica donde crearía
// ambigüedad. Una fila cuyo título ES lo buscado, o que solo lo contiene a
// medias de palabra ("Impresoras" buscando "impresora"), no se atenúa, y
// el tipo solo sube al encabezado si es el mismo en TODAS las filas.

/** Cuántas filas tienen que compartir el comienzo para atenuarlo. */
export const MINIMO_FILAS_PREFIJO = 3

/** El tipo en plural, para el encabezado de una lista de un solo tipo. */
export const PLURAL_TIPO: Record<TipoResultado, string> = {
  articulo: 'guías',
  categoria: 'categorías',
  diagnostico: 'guías con preguntas',
  adjunto: 'adjuntos',
  dispositivo: 'equipos',
  credencial: 'accesos de la Bóveda',
  ubicacion: 'ubicaciones',
  persona: 'personas',
  herramienta: 'herramientas',
  termino: 'términos',
  atajo: 'atajos',
  comando: 'comandos',
}

const LETRA_O_NUMERO = /[\p{L}\p{N}]/u

/**
 * Los dos tramos de un título que EMPIEZA por la consulta como palabra
 * entera y sigue con algo que lo distingue, o null. La consulta llega ya
 * normalizada (minúsculas, sin tildes); se devuelve el título original.
 */
export function partirPorPrefijo(titulo: string, consulta: string): { prefijo: string; resto: string } | null {
  const buscado = consulta.trim()
  if (!buscado) return null
  const normal = normalizarTexto(titulo)
  if (!normal.startsWith(buscado)) return null
  // A medias de palabra no cuenta: "impresora" no es el comienzo de
  // "Impresoras Caja".
  const siguiente = normal.charAt(buscado.length)
  if (siguiente === '' || LETRA_O_NUMERO.test(siguiente)) return null
  const resto = titulo.slice(buscado.length)
  // Lo que queda tiene que decir algo: "Impresora ·" no distingue nada.
  if (!LETRA_O_NUMERO.test(resto)) return null
  return { prefijo: titulo.slice(0, buscado.length), resto }
}

/**
 * Los ids de las filas que se pintan con el comienzo atenuado: las que
 * empiezan por lo buscado, siempre que sean al menos
 * `MINIMO_FILAS_PREFIJO`. Con menos, ninguna: dos filas no son una lista
 * que comparar.
 */
export function filasConPrefijoComun(resultados: ResultadoBusqueda[], consulta: string): Set<string> {
  const ids = resultados.filter((r) => partirPorPrefijo(r.titulo, consulta) !== null).map((r) => r.id)
  return new Set(ids.length >= MINIMO_FILAS_PREFIJO ? ids : [])
}

/** El tipo que comparten TODAS las filas, o null si hay más de uno (o menos de dos filas). */
export function tipoComun(resultados: ResultadoBusqueda[]): TipoResultado | null {
  if (resultados.length < 2) return null
  const tipo = resultados[0].tipo
  return resultados.every((r) => r.tipo === tipo) ? tipo : null
}

/** "5 equipos", "2 guías con preguntas". */
export function cuentaDeTipo(tipo: TipoResultado, cantidad: number): string {
  if (cantidad === 1) return `1 ${ETIQUETA_TIPO[tipo].toLowerCase()}`
  return `${cantidad} ${PLURAL_TIPO[tipo]}`
}

/**
 * La segunda línea de una fila de lista mixta, en dos tramos: el tipo
 * ("Guía", "Equipo") y el resto del contexto. Es `subtituloConTipo`
 * partido para poder pintar el tipo más claro; si el subtítulo no empieza
 * exactamente por el tipo, va entero como contexto.
 */
export function partesSubtituloConTipo(resultado: ResultadoBusqueda): { tipo: string; detalle: string } {
  const completo = subtituloConTipo(resultado)
  const etiqueta = ETIQUETA_TIPO[resultado.tipo]
  const [primero, ...resto] = completo.split(' · ')
  if (normalizarTexto(primero.trim()) === normalizarTexto(etiqueta)) {
    return { tipo: primero.trim(), detalle: resto.join(' · ') }
  }
  return { tipo: '', detalle: completo }
}
