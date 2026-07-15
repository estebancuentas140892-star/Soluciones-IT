import type { Articulo, Conexion, Credencial, Diagnostico, Dispositivo } from './db'
import { normalizarProcedimiento } from './procedimiento'

// Grafo de referencias entre entidades (fase N1 de
// PROPUESTA_BASE_CONOCIMIENTO.md). Es la pieza central del principio
// "cada dato una sola vez": en vez de guardar los vínculos inversos (qué
// procedimientos usan esta credencial, qué diagnósticos ejecutan este
// artículo), se DERIVAN recorriendo los datos locales, igual que el
// índice de búsqueda. Ventaja decisiva: un grafo derivado no puede estar
// desactualizado (se reconstruye de la verdad, los datos), no necesita
// esquema ni sincronización nueva, y es lógica pura y probada.
//
// Las aristas apuntan del que REFERENCIA al REFERENCIADO. Los títulos
// del origen son vivos por construcción: se toman de la fila local al
// construir el grafo, así que renombrar algo se refleja sin tocar copias.

export type TipoEntidad = 'articulo' | 'dispositivo' | 'credencial' | 'diagnostico'

// Cómo un origen referencia a un destino. El nombre describe el vínculo
// desde el origen; la etiqueta que ve el usuario (desde el destino) la
// resuelve `ReferenciadoPor`.
export type TipoRelacion =
  | 'subprocedimiento' // un paso de un artículo vincula otro artículo como subprocedimiento
  | 'solucion' // un paso vincula otro artículo como solución de error
  | 'decision' // una tarea de decisión vincula otro artículo
  | 'credencial_paso' // un paso vincula una credencial de la bóveda
  | 'credencial_tarea' // una tarea concreta vincula una credencial
  | 'relacionado' // artículo -> artículo por la lista "relacionados"
  | 'dispositivo_afectado' // artículo -> dispositivo por "dispositivos afectados"
  | 'diagnostico_articulo' // una opción de un diagnóstico ejecuta un artículo
  | 'conexion' // dispositivo <-> dispositivo (cableado/instalación)

// Referencia navegable a una entidad: lo justo para pintar un enlace sin
// volver a consultar la base. `titulo` y `ruta` se calculan al construir
// el grafo (título vivo de la fila local).
export interface NodoRef {
  tipo: TipoEntidad
  id: string
  titulo: string
  ruta: string
}

export interface Arista {
  origen: NodoRef
  destinoTipo: TipoEntidad
  destinoId: string
  relacion: TipoRelacion
}

export interface DatosGrafo {
  articulos: Articulo[]
  dispositivos: Dispositivo[]
  credenciales: Credencial[]
  diagnosticos: Diagnostico[]
  conexiones: Conexion[]
}

function rutaArticulo(a: Articulo): string {
  return `/soluciones/${a.categoriaId}/${a.id}`
}

// Construye todas las aristas del sistema a partir de los datos locales.
// Recorre los JSON de procedimiento y de nodos de diagnóstico con las
// mismas funciones puras de normalización que usa el resto de la app, así
// tolera datos de versiones anteriores. Se excluyen las filas eliminadas
// (un vínculo desde algo borrado no es una referencia viva); NO se filtra
// por estado del artículo a propósito: un borrador que referencia una
// credencial es una referencia real que se rompería al eliminarla, y para
// un equipo de 5 (todos mantenedores) verla es útil, no una fuga.
export function construirGrafo(datos: DatosGrafo): Arista[] {
  const aristas: Arista[] = []

  for (const articulo of datos.articulos) {
    if (articulo.eliminadoEn) continue
    const origen: NodoRef = {
      tipo: 'articulo',
      id: articulo.id,
      titulo: articulo.titulo,
      ruta: rutaArticulo(articulo),
    }

    const agregar = (destinoTipo: TipoEntidad, destinoId: string, relacion: TipoRelacion) => {
      aristas.push({ origen, destinoTipo, destinoId, relacion })
    }

    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    if (procedimiento) {
      for (const paso of procedimiento.pasos) {
        if (paso.subArticuloId) agregar('articulo', paso.subArticuloId, 'subprocedimiento')
        if (paso.solucionArticuloId) agregar('articulo', paso.solucionArticuloId, 'solucion')
        if (paso.credencialId) agregar('credencial', paso.credencialId, 'credencial_paso')
        for (const bloque of paso.bloques) {
          if (bloque.decisionArticuloId) agregar('articulo', bloque.decisionArticuloId, 'decision')
          if (bloque.credencialId) agregar('credencial', bloque.credencialId, 'credencial_tarea')
        }
      }
    }

    for (const relacionado of articulo.relacionados ?? []) {
      agregar('articulo', relacionado.id, 'relacionado')
    }
    for (const dispositivo of articulo.dispositivosAfectados ?? []) {
      agregar('dispositivo', dispositivo.id, 'dispositivo_afectado')
    }
  }

  for (const diagnostico of datos.diagnosticos) {
    if (diagnostico.eliminadoEn) continue
    const origen: NodoRef = {
      tipo: 'diagnostico',
      id: diagnostico.id,
      titulo: diagnostico.titulo,
      ruta: `/diagnostico/${diagnostico.id}`,
    }
    for (const nodo of diagnostico.nodos ?? []) {
      for (const opcion of nodo.opciones ?? []) {
        if (opcion.articuloId) {
          aristas.push({
            origen,
            destinoTipo: 'articulo',
            destinoId: opcion.articuloId,
            relacion: 'diagnostico_articulo',
          })
        }
      }
    }
  }

  for (const conexion of datos.conexiones) {
    if (conexion.eliminadoEn) continue
    // Una conexión es bidireccional para el impacto: cada extremo
    // "referencia" al otro. El origen del arista lleva el nombre vivo del
    // otro extremo cuando exista; si no, la copia de referencia.
    const nombrePorId = new Map(
      datos.dispositivos.filter((d) => !d.eliminadoEn).map((d) => [d.id, d.nombre]),
    )
    const arista = (deId: string, deNombre: string, aId: string): Arista => ({
      origen: {
        tipo: 'dispositivo',
        id: deId,
        titulo: nombrePorId.get(deId) || deNombre || '(dispositivo sin nombre)',
        ruta: `/dispositivos/${deId}`,
      },
      destinoTipo: 'dispositivo',
      destinoId: aId,
      relacion: 'conexion',
    })
    aristas.push(arista(conexion.origenId, conexion.origenNombre, conexion.destinoId))
    aristas.push(arista(conexion.destinoId, conexion.destinoNombre, conexion.origenId))
  }

  return aristas
}

// Aristas que APUNTAN a una entidad: quién la referencia. Es el inverso
// universal ("¿qué usa esto?") que alimenta tanto el bloque
// "Referenciado por" de las fichas como el aviso de impacto antes de
// eliminar. Se filtra opcionalmente por tipos de relación (una ficha
// puede querer solo algunas, por ejemplo el artículo excluye
// 'relacionado' porque ya tiene su propio bloque).
export function referenciasHacia(
  aristas: Arista[],
  tipo: TipoEntidad,
  id: string,
  relaciones?: TipoRelacion[],
): Arista[] {
  return aristas.filter(
    (a) =>
      a.destinoTipo === tipo &&
      a.destinoId === id &&
      // Una entidad no se cuenta como referencia de sí misma (un artículo
      // que por error se relacionara consigo mismo no debe listarse).
      !(a.origen.tipo === tipo && a.origen.id === id) &&
      (!relaciones || relaciones.includes(a.relacion)),
  )
}

// Orígenes distintos (por tipo+id) de un conjunto de aristas, ordenados
// por título. Distinto porque un mismo artículo puede referenciar a otro
// desde varios pasos: en la lista aparece una sola vez.
export function origenesDistintos(aristas: Arista[]): NodoRef[] {
  const porClave = new Map<string, NodoRef>()
  for (const arista of aristas) {
    porClave.set(`${arista.origen.tipo}:${arista.origen.id}`, arista.origen)
  }
  return [...porClave.values()].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, 'es', { numeric: true }),
  )
}

// Frase corta para el aviso antes de eliminar: "Se usa en 3
// procedimientos, 1 diagnóstico y 2 conexiones." Devuelve null si nada la
// referencia (no se muestra aviso). Cuenta orígenes distintos agrupados
// en categorías legibles según el tipo de relación, no aristas crudas.
export function resumenImpacto(aristas: Arista[], tipo: TipoEntidad, id: string): string | null {
  const entrantes = referenciasHacia(aristas, tipo, id)
  if (entrantes.length === 0) return null

  // Un mismo origen puede aparecer con varias relaciones (un artículo que
  // usa la credencial en dos pasos): se cuenta una vez por categoría.
  const grupos: { clave: string; singular: string; plural: string; ids: Set<string> }[] = [
    { clave: 'procedimiento', singular: 'procedimiento', plural: 'procedimientos', ids: new Set() },
    { clave: 'diagnostico', singular: 'diagnóstico', plural: 'diagnósticos', ids: new Set() },
    { clave: 'articulo', singular: 'artículo', plural: 'artículos', ids: new Set() },
    { clave: 'conexion', singular: 'conexión', plural: 'conexiones', ids: new Set() },
  ]
  const porClave = Object.fromEntries(grupos.map((g) => [g.clave, g]))

  for (const arista of entrantes) {
    const clave = categoriaImpacto(arista.relacion)
    porClave[clave]?.ids.add(`${arista.origen.tipo}:${arista.origen.id}`)
  }

  const partes = grupos
    .filter((g) => g.ids.size > 0)
    .map((g) => `${g.ids.size} ${g.ids.size === 1 ? g.singular : g.plural}`)

  if (partes.length === 0) return null
  return `Se usa en ${unirNatural(partes)}.`
}

// A qué categoría del aviso de impacto pertenece cada relación.
function categoriaImpacto(relacion: TipoRelacion): string {
  switch (relacion) {
    case 'diagnostico_articulo':
      return 'diagnostico'
    case 'conexion':
      return 'conexion'
    case 'subprocedimiento':
    case 'solucion':
    case 'decision':
    case 'credencial_paso':
    case 'credencial_tarea':
      return 'procedimiento'
    case 'relacionado':
    case 'dispositivo_afectado':
      return 'articulo'
  }
}

// Une una lista en español: "a", "a y b", "a, b y c".
function unirNatural(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}
