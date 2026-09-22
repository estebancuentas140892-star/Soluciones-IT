import type { Articulo, Categoria, Reciente } from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import type { Agenda, EstadoAgenda } from './agenda'
import type { ItemPendiente } from './pendientes'

// RESOLVER: LO QUE ACOMPAÑA AL BUSCADOR (encargo del 2026-09-22, sección 2).
//
// Resolver responde "¿qué necesitas resolver?" y no es un tablero: cada
// bloque de debajo del buscador aparece SOLO si ayuda a resolver algo, y
// ninguno inventa datos (no hay tabla nueva ni contadores nuevos: todo
// sale de la agenda, del registro local de recientes y de las guías).
//
//   Atención         lo que tiene fecha y hay que atender: vencidos, de
//                    hoy y próximos. Tres como mucho; el resto está en la
//                    agenda completa. Los borradores y las sugerencias del
//                    equipo no tienen plazo, así que no salen aquí.
//   Recientes        las guías que ESTE técnico usó hace poco, con el paso
//                    donde se quedó si están a medias. Una guía de hace dos
//                    meses no es "reciente": sería ruido.
//   Accesos rápidos  las categorías que tienen guías para ejecutar, las más
//                    usadas primero. Con una sola categoría el bloque no
//                    aporta nada (sería lo mismo que "Todas las guías"), así
//                    que no se dibuja.
//
// Lógica pura, sin React ni base de datos, para poder probarla aislada.

/** Cuántos asuntos de la agenda asoman en Resolver. */
export const ATENCION_VISIBLES = 3
/** Hasta cuántos días atrás una guía usada cuenta como reciente. */
export const DIAS_RECIENTES = 14
/** Cuántas guías recientes se ven. */
export const RECIENTES_VISIBLES = 3
/** Ventana del uso que ordena los accesos rápidos. */
export const DIAS_USO_ACCESOS = 30
/** Tope de accesos rápidos. */
export const ACCESOS_MAXIMOS = 6
/** Con menos categorías que esto, el bloque no se dibuja. */
export const ACCESOS_MINIMOS = 2

const MS_DIA = 24 * 60 * 60 * 1000

export type EstadoAtencion = Extract<EstadoAgenda, 'vencido' | 'hoy' | 'proximo'>

export interface AsuntoAtencion {
  item: ItemPendiente
  estado: EstadoAtencion
}

/**
 * Los asuntos con fecha, en el orden de la agenda (lo más vencido
 * primero, luego lo de hoy y luego lo más cercano), recortados a
 * `limite`. `total` dice cuántos hay de verdad, para el enlace a la agenda
 * completa.
 */
export function asuntosDeAtencion(
  agenda: Agenda,
  limite: number = ATENCION_VISIBLES,
): { visibles: AsuntoAtencion[]; total: number } {
  const todos: AsuntoAtencion[] = [
    ...agenda.vencidos.map((item) => ({ item, estado: 'vencido' as const })),
    ...agenda.hoy.map((item) => ({ item, estado: 'hoy' as const })),
    ...agenda.proximos.map((item) => ({ item, estado: 'proximo' as const })),
  ]
  return { visibles: todos.slice(0, limite), total: todos.length }
}

/**
 * ¿Es una guía que se puede ejecutar y que el equipo da por buena? Viva,
 * publicada (lo que no trae estado es anterior al campo y era oficial) y
 * con pasos. Es el criterio de los accesos rápidos: una categoría que
 * solo tiene borradores o manuales no es una puerta a un procedimiento.
 */
export function esGuiaPublicadaEjecutable(articulo: Articulo): boolean {
  if (articulo.eliminadoEn) return false
  if ((articulo.estado ?? 'publicado') !== 'publicado') return false
  return procedimientoEjecutable(normalizarProcedimiento(articulo.procedimiento))
}

function haceMenosDe(fechaIso: string, dias: number, hoy: Date): boolean {
  const cuando = Date.parse(fechaIso)
  if (Number.isNaN(cuando)) return false
  return hoy.getTime() - cuando <= dias * MS_DIA
}

export interface GuiaReciente {
  id: string
  titulo: string
  categoriaNombre: string
  ruta: string
  visitadoEn: string
  /** Un borrador se puede usar, pero se dice (encargo del 2026-09-20). */
  borrador: boolean
  /** El avance a medias en este teléfono, o null si no hay nada empezado. */
  avance: { hechos: number; total: number } | null
}

/**
 * Las guías que este técnico usó en los últimos `dias`, la más reciente
 * primero. Solo guías con pasos (procedimientos) y que no estén
 * eliminadas ni obsoletas; un borrador entra, marcado, porque fue el
 * propio técnico quien lo abrió.
 */
export function guiasRecientes(
  visitas: Reciente[],
  articulos: Articulo[],
  categorias: Categoria[],
  avances: ReadonlyMap<string, { hechos: number; total: number }>,
  hoy: Date = new Date(),
  opciones: { dias?: number; limite?: number } = {},
): GuiaReciente[] {
  const dias = opciones.dias ?? DIAS_RECIENTES
  const limite = opciones.limite ?? RECIENTES_VISIBLES
  const porId = new Map(articulos.map((a) => [a.id, a]))
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]))

  return [...visitas]
    .filter((v) => v.tipo === 'articulo' && haceMenosDe(v.visitadoEn, dias, hoy))
    .sort((a, b) => b.visitadoEn.localeCompare(a.visitadoEn))
    .flatMap((visita): GuiaReciente[] => {
      const articulo = porId.get(visita.entidadId)
      if (!articulo || articulo.eliminadoEn) return []
      const estado = articulo.estado ?? 'publicado'
      if (estado === 'obsoleto') return []
      if (!procedimientoEjecutable(normalizarProcedimiento(articulo.procedimiento))) return []
      return [
        {
          id: articulo.id,
          titulo: articulo.titulo,
          categoriaNombre: nombreCategoria.get(articulo.categoriaId) ?? '',
          ruta: `/soluciones/${articulo.categoriaId}/${articulo.id}`,
          visitadoEn: visita.visitadoEn,
          borrador: estado === 'borrador',
          avance: avances.get(articulo.id) ?? null,
        },
      ]
    })
    .slice(0, limite)
}

export interface AccesoRapido {
  categoriaId: string
  nombre: string
  /** Guías publicadas y ejecutables de la categoría. */
  guias: number
  /** Guías distintas de la categoría usadas en la ventana de uso. */
  usos: number
}

/**
 * Las categorías que llevan a un procedimiento, las más usadas primero y
 * luego en el orden que el equipo les dio. Devuelve una lista vacía
 * cuando no llegan a `minimo`: un acceso rápido que es la única puerta
 * no acelera nada.
 *
 * El uso sale del registro local de recientes (una fila por guía, con su
 * última visita), así que cuenta guías distintas usadas, no aperturas:
 * es la señal honesta que hay, y no se inventa otra.
 */
export function accesosRapidos(
  categorias: Categoria[],
  articulos: Articulo[],
  visitas: Reciente[],
  hoy: Date = new Date(),
  opciones: { limite?: number; minimo?: number; diasUso?: number } = {},
): AccesoRapido[] {
  const limite = opciones.limite ?? ACCESOS_MAXIMOS
  const minimo = opciones.minimo ?? ACCESOS_MINIMOS
  const diasUso = opciones.diasUso ?? DIAS_USO_ACCESOS

  const guiasPorCategoria = new Map<string, number>()
  const categoriaDeGuia = new Map<string, string>()
  for (const articulo of articulos) {
    if (!esGuiaPublicadaEjecutable(articulo)) continue
    guiasPorCategoria.set(articulo.categoriaId, (guiasPorCategoria.get(articulo.categoriaId) ?? 0) + 1)
    categoriaDeGuia.set(articulo.id, articulo.categoriaId)
  }

  const usosPorCategoria = new Map<string, number>()
  for (const visita of visitas) {
    if (visita.tipo !== 'articulo' || !haceMenosDe(visita.visitadoEn, diasUso, hoy)) continue
    const categoriaId = categoriaDeGuia.get(visita.entidadId)
    if (!categoriaId) continue
    usosPorCategoria.set(categoriaId, (usosPorCategoria.get(categoriaId) ?? 0) + 1)
  }

  const accesos = categorias
    .filter((c) => !c.eliminadoEn && (guiasPorCategoria.get(c.id) ?? 0) > 0)
    .map((c) => ({
      categoriaId: c.id,
      nombre: c.nombre,
      guias: guiasPorCategoria.get(c.id) ?? 0,
      usos: usosPorCategoria.get(c.id) ?? 0,
      orden: c.orden,
    }))
    .sort(
      (a, b) =>
        b.usos - a.usos || a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }),
    )
    .slice(0, limite)
    .map(({ categoriaId, nombre, guias, usos }) => ({ categoriaId, nombre, guias, usos }))

  return accesos.length >= minimo ? accesos : []
}
