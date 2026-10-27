import { normalizarTexto } from '../soluciones/iconosSoluciones'
import { palabrasDeContenido, usaPrefijo } from './consultaNatural'
import { ETIQUETA_TIPO, subtituloConTipo } from './mejores'
import { agruparResultados, partirTitulo, type GrupoResultados } from './resultados'
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

// ATENUAR LO REPETIDO EN CUALQUIER POSICIÓN (tarea 358, D12, segunda ronda de
// Claude Design). La lista homogénea de arriba solo mira el COMIENZO del
// título: sirve para equipos («Impresora Mercadeo»), pero los títulos de las
// guías empiezan por el verbo («Configurar impresora de red»), así que casi
// nunca se activaba, y la palabra que todas comparten se pintaba en acento en
// cada tarjeta. Aquí cuenta la palabra buscada en cualquier sitio del título,
// también en plural, y se atenúa ENTERA: «impresoras» buscando «impresora» no
// se parte en «[impresora]s».

// Con las marcas combinantes (`\p{M}`): un título guardado en NFD («Impresión»
// con la tilde aparte) es una sola palabra, no «Impresio» y «n».
const PALABRA = /[\p{L}\p{N}\p{M}]+/gu

/**
 * Los tramos del título con cada palabra que EMPIEZA por una palabra buscada
 * marcada como atenuada, o null si ninguna. Las palabras buscadas son las de
 * contenido de la consulta (sin las vacías, como el buscador); se devuelve el
 * texto original del título, con sus tildes y mayúsculas.
 */
export function partirPorPalabra(titulo: string, consulta: string): { texto: string; atenuado: boolean }[] | null {
  const buscadas = palabrasDeContenido(consulta)
  if (buscadas.length === 0) return null
  const tramos: { texto: string; atenuado: boolean }[] = []
  const agregar = (texto: string, atenuado: boolean) => {
    if (!texto) return
    const anterior = tramos[tramos.length - 1]
    if (anterior && anterior.atenuado === atenuado) anterior.texto += texto
    else tramos.push({ texto, atenuado })
  }
  let hayAtenuada = false
  let desde = 0
  for (const palabra of titulo.matchAll(PALABRA)) {
    const inicio = palabra.index ?? 0
    const normal = normalizarTexto(palabra[0])
    // Por su comienzo, con la misma regla del índice: una letra suelta que
    // acompaña a otras palabras («windows r») solo cuenta entera.
    const atenuada = buscadas.some(
      (buscada) => normal === buscada || (usaPrefijo(buscada, buscadas) && normal.startsWith(buscada)),
    )
    agregar(titulo.slice(desde, inicio), false)
    agregar(palabra[0], atenuada)
    hayAtenuada ||= atenuada
    desde = inicio + palabra[0].length
  }
  agregar(titulo.slice(desde), false)
  return hayAtenuada ? tramos : null
}

/**
 * Los ids de las filas con alguna palabra atenuable, si son al menos
 * `MINIMO_FILAS_PREFIJO`; si no, ninguna (dos filas no son una lista que
 * comparar). Una fila que coincidió por otra cosa (la categoría, el tipo) no
 * entra: va sin resaltado.
 */
export function filasConPalabraComun(resultados: { id: string; titulo: string }[], consulta: string): Set<string> {
  const ids = resultados.filter((r) => partirPorPalabra(r.titulo, consulta) !== null).map((r) => r.id)
  return new Set(ids.length >= MINIMO_FILAS_PREFIJO ? ids : [])
}

/**
 * La categoría que comparten TODAS las guías de la lista, o null si hay más de
 * una, alguna sin categoría o menos de dos guías (D13). Es el criterio de
 * `tipoComun`: lo común sube al encabezado y deja de repetirse en cada tarjeta.
 */
export function categoriaComun(categoriasDeGuias: string[]): string | null {
  if (categoriasDeGuias.length < 2) return null
  const primera = categoriasDeGuias[0]
  if (!primera) return null
  return categoriasDeGuias.every((categoria) => categoria === primera) ? primera : null
}

/** Un tramo del título de una guía: en claro, atenuado (lo repetido) o resaltado (lo buscado). */
export interface TramoTitulo {
  texto: string
  atenuado?: boolean
  resaltado?: boolean
}

/**
 * Cómo se pinta el título de una guía en una lista del teléfono (D12). En una
 * lista homogénea (`filasConPalabraComun` no vacío), la palabra repetida se
 * atenúa y nada va en acento; una fila de esa lista sin la palabra va en
 * claro. Si la lista no llega, lo de siempre: el comienzo común atenuado
 * (`filasConPrefijoComun`) o lo buscado resaltado. Sin consulta, el título.
 */
export function tramosDeTitulo(
  titulo: string,
  consulta: string,
  lista: { palabraComun: ReadonlySet<string>; prefijoComun?: ReadonlySet<string>; id: string },
): TramoTitulo[] {
  if (!consulta.trim()) return [{ texto: titulo }]
  if (lista.palabraComun.size > 0) {
    return (lista.palabraComun.has(lista.id) ? partirPorPalabra(titulo, consulta) : null) ?? [{ texto: titulo }]
  }
  const conPrefijo = lista.prefijoComun?.has(lista.id) ? partirPorPrefijo(titulo, consulta) : null
  if (conPrefijo) return [{ texto: conPrefijo.prefijo, atenuado: true }, { texto: conPrefijo.resto }]
  const { pre, match, post } = partirTitulo(titulo, consulta)
  return [{ texto: pre }, { texto: match, resaltado: true }, { texto: post }].filter((tramo) => tramo.texto !== '')
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

/**
 * LA LECTURA DEL TELÉFONO (rediseño móvil, fase 1, tarea 344; DESPUÉS de
 * Claude Design). Los mismos resultados, en el mismo orden global, leídos de
 * otra forma: en vez de "Mejores resultados" (cinco filas con el mismo peso,
 * que había que leer todas para decidir), lo primero del orden global se
 * destaca si es una guía, y lo demás va por tipo (Guías, Equipos, Bóveda...),
 * para que se distinga a qué se llega. Los grupos van en el orden de su
 * mejor resultado y, dentro de cada uno, lo que estaba entre los mejores va
 * primero: buscando un equipo por su nombre, Equipos sube por encima de
 * Guías. Nada se filtra ni se reordena en el índice: es presentación.
 */
export function lecturaParaTelefono(
  resultados: ResultadoBusqueda[],
  mejores: ResultadoBusqueda[],
  idsDeRed: ReadonlySet<string> = new Set(),
): { destacada: ResultadoBusqueda | null; grupos: GrupoResultados[] } {
  const primera = mejores[0]
  const destacada = primera && (primera.tipo === 'articulo' || primera.tipo === 'diagnostico') ? primera : null
  const rango = new Map(mejores.map((resultado, indice) => [resultado.id, indice]))
  const posicion = (resultado: ResultadoBusqueda) => rango.get(resultado.id) ?? Number.MAX_SAFE_INTEGER
  const grupos = agruparResultados(destacada ? resultados.filter((r) => r.id !== destacada.id) : resultados, idsDeRed)
    .map((grupo, orden) => ({
      grupo: { ...grupo, items: [...grupo.items].sort((a, b) => posicion(a) - posicion(b)) },
      orden,
      mejor: Math.min(...grupo.items.map(posicion)),
    }))
    .sort((a, b) => a.mejor - b.mejor || a.orden - b.orden)
    .map(({ grupo }) => grupo)
  return { destacada, grupos }
}

/**
 * UNA GUÍA QUE SOLO MENCIONA LO BUSCADO (tarea 362, auditoría del
 * 2026-10-27). Coincidió únicamente en su contenido (el texto de los pasos,
 * las etiquetas o las causas: el campo `texto` del índice), nunca en su
 * título, sus formas de búsqueda, sus síntomas o su «cuándo usarla». Pesaba
 * igual que la que lo tiene en el título; ahora va plegada al final de su
 * grupo. Se mira lo escrito y sus sinónimos. Sin metadatos de la coincidencia
 * (un resultado armado a mano) no se decide nada: cuenta como principal.
 */
export function soloLaMenciona(resultado: ResultadoBusqueda): boolean {
  if (resultado.tipo !== 'articulo' && resultado.tipo !== 'diagnostico') return false
  const campos = new Set([
    ...(resultado.camposCoincidentes ?? []),
    ...(resultado.camposPorPalabra ?? []).flat(),
    ...(resultado.camposPorSinonimo ?? []).flat(),
  ])
  return campos.size > 0 && [...campos].every((campo) => campo === 'texto')
}

/** Las filas del grupo Guías, repartidas para la lectura de la tarea 362. */
export interface GuiasRepartidas {
  /** Las guías, guías con preguntas y adjuntos que coinciden por lo que son. */
  principales: ResultadoBusqueda[]
  /** Las que solo lo mencionan en su contenido (`soloLaMenciona`). */
  mencionan: ResultadoBusqueda[]
  /** Las categorías que coinciden: llevan a su catálogo. */
  categorias: ResultadoBusqueda[]
}

/** Reparte las filas del grupo Guías sin cambiar su orden dentro de cada parte. */
export function repartirGuias(items: ResultadoBusqueda[]): GuiasRepartidas {
  const repartidas: GuiasRepartidas = { principales: [], mencionan: [], categorias: [] }
  for (const item of items) {
    if (item.tipo === 'categoria') repartidas.categorias.push(item)
    else if (soloLaMenciona(item)) repartidas.mencionan.push(item)
    else repartidas.principales.push(item)
  }
  return repartidas
}

/**
 * LAS FILAS DE UN GRUPO A LA VISTA (tarea 362, D1). En «Todo» cada grupo
 * enseña sus primeras `tope` filas; en Guías, las principales (si no hay
 * ninguna, las que la mencionan, y si tampoco, las categorías). Elegido el
 * alcance, todo: las que solo la mencionan se pliegan aparte y las categorías
 * van al final. `hayMas` dice si queda algo detrás de «Ver las N».
 */
export function filasDelGrupo(
  idGrupo: string,
  items: ResultadoBusqueda[],
  enTodo: boolean,
  tope: number,
): { filas: ResultadoBusqueda[]; mencionan: ResultadoBusqueda[]; categorias: ResultadoBusqueda[]; hayMas: boolean } {
  if (idGrupo !== 'soluciones') {
    const filas = enTodo ? items.slice(0, tope) : items
    return { filas, mencionan: [], categorias: [], hayMas: filas.length < items.length }
  }
  const { principales, mencionan, categorias } = repartirGuias(items)
  if (!enTodo) return { filas: principales, mencionan, categorias, hayMas: false }
  const primeras = principales.length > 0 ? principales : mencionan.length > 0 ? mencionan : categorias
  const filas = primeras.slice(0, tope)
  return { filas, mencionan: [], categorias: [], hayMas: filas.length < items.length }
}

/** «2 guías más mencionan «impresora» en su contenido» (tarea 362). */
export function textoMencionan(cantidad: number, consultaCruda: string): string {
  return `${cantidad} ${cantidad === 1 ? 'guía más menciona' : 'guías más mencionan'} «${consultaCruda}» en su contenido`
}
