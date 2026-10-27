import type { Articulo, Categoria } from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import { esGuiaPublicadaEjecutable } from '../inicio/resolver'
import { cuandoUsarParaMostrar } from './preparacionGuia'
import { TIPOS_ARTICULO } from './tiposArticulo'

// EL CATÁLOGO DE GUÍAS EN EL TELÉFONO (tarea 358, alternativa A2 de Claude
// Design, «cada guía con su identidad»). Solo la lógica: cómo se ordena y se
// agrupa la lista, qué número lleva cada categoría y qué línea distingue a una
// guía de su vecina. La pintan `GrupoGuiasTelefono` y `TarjetaGuiaTelefono`;
// desde 768 px la lista de siempre no usa nada de esto.

const ORDEN_DE_TIPO = new Map(TIPOS_ARTICULO.map((tipo, indice) => [tipo.valor, indice]))

/**
 * El orden dentro de una categoría (D5): las obsoletas al final; luego por
 * tipo, en el orden de `TIPOS_ARTICULO` (las guías del mismo tipo quedan
 * juntas y la forma del glifo se repite seguida); y a igualdad, por título.
 */
export function ordenarEnCategoria(a: Articulo, b: Articulo): number {
  const obsoletaA = a.estado === 'obsoleto' ? 1 : 0
  const obsoletaB = b.estado === 'obsoleto' ? 1 : 0
  return (
    obsoletaA - obsoletaB ||
    (ORDEN_DE_TIPO.get(a.tipo) ?? TIPOS_ARTICULO.length) - (ORDEN_DE_TIPO.get(b.tipo) ?? TIPOS_ARTICULO.length) ||
    a.titulo.localeCompare(b.titulo, 'es', { numeric: true })
  )
}

/** El grupo de las guías cuya categoría no está (borrada o aún sin sincronizar). */
export const SIN_CATEGORIA: Pick<Categoria, 'id' | 'nombre'> = { id: '__sin-categoria', nombre: 'Sin categoría' }

/**
 * Un grupo por categoría, en el orden en que llegan las categorías (el de
 * `orden`), cada uno con sus guías ordenadas. Las categorías sin guías en la
 * lista no forman grupo. Una guía cuya categoría no llegó no se pierde: va al
 * final, en «Sin categoría».
 */
export function agruparPorCategoria(
  articulos: Articulo[],
  categorias: Categoria[],
): { categoria: Pick<Categoria, 'id' | 'nombre'>; articulos: Articulo[] }[] {
  const porCategoria = new Map<string, Articulo[]>()
  for (const articulo of articulos) {
    const lista = porCategoria.get(articulo.categoriaId)
    if (lista) lista.push(articulo)
    else porCategoria.set(articulo.categoriaId, [articulo])
  }
  const conocidas = new Set(categorias.map((categoria) => categoria.id))
  const huerfanas = articulos.filter((articulo) => !conocidas.has(articulo.categoriaId))
  return [
    ...categorias.flatMap((categoria) => {
      const delGrupo = porCategoria.get(categoria.id)
      return delGrupo ? [{ categoria, articulos: [...delGrupo].sort(ordenarEnCategoria) }] : []
    }),
    ...(huerfanas.length > 0 ? [{ categoria: SIN_CATEGORIA, articulos: [...huerfanas].sort(ordenarEnCategoria) }] : []),
  ]
}

/**
 * EL MISMO NÚMERO EN RESOLVER Y EN GUÍAS (D9). Las guías son las publicadas
 * con pasos, con la misma función que cuenta Resolver
 * (`esGuiaPublicadaEjecutable`); las de leer, las publicadas sin pasos, van
 * aparte. Los borradores y las obsoletas no se cuentan: se ven en la lista,
 * pero no son lo que la categoría ofrece.
 */
export function cuentaDeCategoria(articulos: Articulo[]): { guias: number; paraLeer: number } {
  let guias = 0
  let paraLeer = 0
  for (const articulo of articulos) {
    if (esGuiaPublicadaEjecutable(articulo)) guias += 1
    else if (
      !articulo.eliminadoEn &&
      (articulo.estado ?? 'publicado') === 'publicado' &&
      !procedimientoEjecutable(normalizarProcedimiento(articulo.procedimiento))
    )
      paraLeer += 1
  }
  return { guias, paraLeer }
}

/** «6 guías · 2 para leer», «1 guía», «3 para leer», o '' si no hay nada que contar. */
export function textoCuenta({ guias, paraLeer }: { guias: number; paraLeer: number }): string {
  return [guias > 0 ? `${guias} ${guias === 1 ? 'guía' : 'guías'}` : '', paraLeer > 0 ? `${paraLeer} para leer` : '']
    .filter(Boolean)
    .join(' · ')
}

const CUANDO_INICIAL = /^cuando\s+/i

/**
 * La situación de una guía para la lista (D11): su «cuándo usarla», como se
 * lee en Detalles, sin el «Cuando» inicial que repetirían todas las tarjetas
 * de una categoría, y con mayúscula. Lo que no empieza por «Cuando» («Antes de
 * cambiar…», «Solo cuando…») queda como está.
 */
export function situacionParaLista(descripcion: string): string {
  const cuando = cuandoUsarParaMostrar(descripcion)
  if (!CUANDO_INICIAL.test(cuando)) return cuando
  const resto = cuando.replace(CUANDO_INICIAL, '')
  return resto.charAt(0).toUpperCase() + resto.slice(1)
}

/**
 * La línea que distingue una guía de su vecina sin abrirla (D11): su
 * situación; si no la tiene, su primer síntoma; si tampoco, nada (regla 22:
 * un hueco vacío antes que un dato que no aporta).
 */
export function lineaQueDistingue(articulo: Articulo): string {
  const procedimiento = normalizarProcedimiento(articulo.procedimiento)
  const situacion = procedimiento ? situacionParaLista(procedimiento.descripcion) : ''
  if (situacion) return situacion
  return (articulo.sintomas ?? []).map((sintoma) => sintoma.trim()).find(Boolean) ?? ''
}
