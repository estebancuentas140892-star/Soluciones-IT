import type { Articulo } from '../../lib/db'
import { coincidenciaArticulo, type CoincidenciaArticulo } from '../soluciones/coincidencia'

// BORRADORES QUE COINCIDEN CON LA BÚSQUEDA (encargo del 2026-09-20,
// tarea 1).
//
// El defecto que cierra, encontrado con la guía de la resolución DIAN:
// esa guía existe, tiene nueve pasos y no está eliminada, pero está en
// `borrador`, y el índice del buscador solo indexa lo PUBLICADO (así
// debe seguir: un borrador no es un procedimiento del equipo). Inicio ya
// contaba los borradores que coincidían, pero solo lo decía en el estado
// "Sin coincidencias". Buscar "DIAN" encuentra la ficha de HKA Factura,
// así que había resultados, el aviso no se dibujaba nunca y la guía
// parecía no existir.
//
// La regla nueva: los borradores que coinciden se muestran SIEMPRE que
// se esté buscando, en su propio bloque y con su propia pastilla, haya o
// no resultados oficiales. Nunca se mezclan con ellos y NO entran en
// `documentosDeBusqueda`.
//
// Esto es lógica pura (sin DOM ni Dexie) para poder probar el caso
// exacto: "DIAN" con la ficha de HKA Factura entre los resultados.

export interface BorradorCoincidente {
  id: string
  titulo: string
  categoriaId: string
  /** Nombre vivo de la categoría, o cadena vacía si ya no existe. */
  categoriaNombre: string
  /** El editor del artículo: revisar un borrador es abrirlo donde se corrige. */
  ruta: string
  /** Por dónde coincidió, para poder decirlo en la fila. */
  coincidencia: CoincidenciaArticulo
}

/** ¿Es un borrador vivo? Ni publicado, ni obsoleto, ni eliminado. */
export function esBorradorVivo(articulo: Articulo): boolean {
  return !articulo.eliminadoEn && articulo.estado === 'borrador'
}

/**
 * Los borradores vivos que coinciden con `consulta` (YA normalizada:
 * minúsculas y sin acentos, como la normaliza quien busca).
 *
 * Mira los mismos campos que la lista de Guías, porque usa la misma
 * `coincidenciaArticulo`: título, etiquetas, categoría y tipo. Orden:
 * primero los que coinciden en el TÍTULO (es lo que el técnico
 * reconoce), después el resto, y a igualdad, por título.
 */
export function borradoresCoincidentes(
  articulos: Articulo[],
  nombresCategoriaPorId: Map<string, string>,
  consulta: string,
): BorradorCoincidente[] {
  if (!consulta) return []
  return articulos
    .filter(esBorradorVivo)
    .flatMap((articulo) => {
      const categoriaNombre = nombresCategoriaPorId.get(articulo.categoriaId) ?? ''
      const coincidencia = coincidenciaArticulo(articulo, consulta, categoriaNombre)
      if (!coincidencia) return []
      return [
        {
          id: articulo.id,
          titulo: articulo.titulo || '(sin título)',
          categoriaId: articulo.categoriaId,
          categoriaNombre,
          ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}/editar`,
          coincidencia,
        },
      ]
    })
    .sort((a, b) => {
      if (a.coincidencia.enTitulo !== b.coincidencia.enTitulo) return a.coincidencia.enTitulo ? -1 : 1
      return a.titulo.localeCompare(b.titulo, 'es')
    })
}

// Cuántos se ven antes de "Ver todos en Guías". Tres bastan para
// reconocer el que se buscaba; el resto está en la lista de Guías, que
// es donde los borradores viven con su filtro.
export const BORRADORES_VISIBLES = 3

/** "1 borrador coincide" / "3 borradores coinciden". */
export function fraseBorradores(cantidad: number): string {
  return cantidad === 1 ? '1 borrador coincide' : `${cantidad} borradores coinciden`
}

// ----------------------------------------------------------------
// COINCIDENCIA FUERTE: EL BORRADOR SUBE (encargo del 2026-09-20, tarea 1)
// ----------------------------------------------------------------
//
// Enseñar el borrador en un bloque al final no bastaba. Buscando "DIAN"
// el técnico ve primero la ficha de HKA Factura, que explica qué es la
// herramienta, cuando lo que quiere es HACER el procedimiento. La guía
// que lleva ese nombre en el título es la respuesta, aunque esté sin
// publicar.
//
// La regla: si el borrador coincide EN EL TÍTULO, sube con los
// resultados; si solo coincide por etiqueta, categoría o tipo, se queda
// en el bloque de abajo. Nada de esto cambia el índice ni el estado del
// artículo: es orden de presentación, y la fila dice en todo momento que
// es un borrador.

export interface RepartoBorradores {
  /** Coincide en el título: se muestra arriba, con los resultados. */
  destacados: BorradorCoincidente[]
  /** Coincide por otro campo: se queda en "Borradores coincidentes". */
  secundarios: BorradorCoincidente[]
}

export function repartirBorradores(borradores: BorradorCoincidente[]): RepartoBorradores {
  return {
    destacados: borradores.filter((b) => b.coincidencia.enTitulo),
    secundarios: borradores.filter((b) => !b.coincidencia.enTitulo),
  }
}

/**
 * ¿Hay ya una GUÍA PUBLICADA que coincide en el título?
 *
 * Es lo que decide si el borrador se pone delante de los resultados o
 * detrás: lo publicado manda siempre. Se mira sobre los resultados que
 * ya están en pantalla (ids `articulo:<id>`), no sobre otra consulta.
 */
export function hayGuiaPublicadaEnTitulo(
  resultados: { id: string; tipo: string; titulo: string }[],
  consulta: string,
  normalizar: (texto: string) => string,
): boolean {
  if (!consulta) return false
  return resultados.some((r) => r.tipo === 'articulo' && normalizar(r.titulo).includes(consulta))
}

/**
 * Quita los borradores cuyo artículo ya está entre los resultados
 * oficiales. No debería pasar (el índice solo lleva lo publicado y la
 * lista solo borradores), pero entre que Dexie responde a una consulta y
 * a la otra hay un instante en el que un artículo recién publicado
 * podría estar en las dos: la fila se pintaría dos veces.
 */
export function sinLosYaOficiales(
  borradores: BorradorCoincidente[],
  resultados: { id: string }[],
): BorradorCoincidente[] {
  const oficiales = new Set(resultados.map((r) => r.id))
  return borradores.filter((b) => !oficiales.has(`articulo:${b.id}`))
}
