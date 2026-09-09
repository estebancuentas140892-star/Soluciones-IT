import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'

// LAS GUIAS QUE UNA TAREA EXIGE ANTES DE DARSE POR HECHA.
//
// El defecto que cierra (encargo del 2026-09-09, tarea 1): un bloque
// 'guia' con intencion 'necesario' colgado de una tarea se mostraba,
// pero no condicionaba nada. "Marcar hecha" funcionaba igual con la
// guia sin empezar, asi que la palabra "necesario" del editor no
// significaba nada en la ejecucion. Y cuando una tarea tenia DOS guias
// necesarias, el recorrido tomaba solo la primera (`.find`), asi que la
// segunda no se veia ni se exigia.
//
// Vive fuera de los componentes porque es la regla del producto y la
// aplican las DOS vistas de ejecucion: el modo de una tarea a la vez y
// la vista de paso entero. Con la regla en un solo sitio no hay forma
// de que una vista valide y la otra no.

/**
 * Todas las guias con intencion 'necesario' de una tarea, EN EL ORDEN
 * DEL EDITOR (el de `paso.bloques`).
 *
 * Las de intencion 'consulta' y 'contingencia' quedan fuera a
 * proposito: son apoyo, no prerrequisito, y no bloquean nada.
 */
export function guiasObligatoriasDeTarea(paso: PasoProcedimiento, tareaId: string): BloquePaso[] {
  return paso.bloques.filter(
    (b) =>
      b.tipo === 'guia' &&
      b.guiaArticuloId !== null &&
      b.intencionGuia === 'necesario' &&
      b.alcance === 'tarea' &&
      b.tareaId === tareaId,
  )
}

/**
 * Ids de artículo de TODAS las guias obligatorias de un paso, sin
 * repetir. Sirve para consultarlas en vivo de una sola vez, en vez de
 * una consulta por tarea.
 */
export function idsGuiasObligatoriasDelPaso(paso: PasoProcedimiento): string[] {
  const ids = tareasDe(paso.bloques).flatMap((t) =>
    guiasObligatoriasDeTarea(paso, t.id).flatMap((g) => (g.guiaArticuloId ? [g.guiaArticuloId] : [])),
  )
  return [...new Set(ids)]
}

/**
 * Cuales de esas guias siguen pendientes, en el mismo orden.
 *
 * `estaCumplida` responde por id de articulo. Un vinculo ROTO (la guia
 * no esta en este dispositivo) se resuelve como cumplido por quien
 * implementa el predicado: bloquear por algo que el tecnico no puede
 * abrir dejaria la tarea sin salida, que es el criterio A12.
 */
export function guiasObligatoriasPendientes(
  guias: BloquePaso[],
  estaCumplida: (guiaId: string) => boolean,
): BloquePaso[] {
  return guias.filter((g) => g.guiaArticuloId !== null && !estaCumplida(g.guiaArticuloId))
}

/**
 * Que falta, escrito para leerlo debajo del boton que no se puede
 * pulsar. Nombra la PRIMERA pendiente, que es la que toca hacer, y dice
 * cuantas quedan detras. `null` cuando no falta ninguna.
 */
export function motivoGuiasPendientes(pendientes: BloquePaso[]): string | null {
  if (pendientes.length === 0) return null
  const primera = pendientes[0].guiaArticuloTitulo || 'la guía vinculada'
  if (pendientes.length === 1) return `Completa «${primera}» para marcar esta tarea`
  const restantes = pendientes.length - 1
  return `Completa «${primera}» y ${restantes} ${restantes === 1 ? 'guía más' : 'guías más'} para marcar esta tarea`
}
