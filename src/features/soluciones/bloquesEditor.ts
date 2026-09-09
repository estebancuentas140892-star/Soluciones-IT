import type { AlcanceApoyo, BloquePaso, TipoTarea } from '../../lib/db'

// OPERACIONES DEL EDITOR SOBRE LOS BLOQUES DE UN PASO.
//
// Viven fuera del componente porque son las reglas que hay que poder
// probar sin navegador: donde cae un apoyo nuevo, que pasa al reordenar
// y que se conserva al cambiar el tipo de una linea. Las tres salen del
// encargo del 2026-09-08 (seccion 4, "Editor", puntos 4, 6 y 7).

/** Destino de un apoyo, tal como lo elige el autor. */
export type DestinoApoyo = { alcance: Exclude<AlcanceApoyo, 'sin-asignar'>; tareaId: string | null }

export const DESTINO_PASO: DestinoApoyo = { alcance: 'paso', tareaId: null }

export function destinoTarea(tareaId: string): DestinoApoyo {
  return { alcance: 'tarea', tareaId }
}

/**
 * Inserta un apoyo JUNTO A SU TAREA, no al final del paso.
 *
 * Importa porque la lectura completa muestra los bloques en el orden
 * del array: una precaucion que pertenece a la primera tarea pero vive
 * al final del paso se lee despues de la accion que deberia advertir.
 * El apoyo se coloca detras de su tarea y de los apoyos que ya tenia,
 * asi que el orden de escritura es el orden de lectura.
 *
 * Un apoyo del paso completo va al final: no acompaña a ninguna tarea.
 */
export function insertarApoyo(
  bloques: BloquePaso[],
  apoyo: BloquePaso,
  destino: DestinoApoyo,
): BloquePaso[] {
  const conDestino: BloquePaso = { ...apoyo, alcance: destino.alcance, tareaId: destino.tareaId }
  if (destino.alcance !== 'tarea' || !destino.tareaId) return [...bloques, conDestino]

  const posTarea = bloques.findIndex((b) => b.id === destino.tareaId)
  if (posTarea < 0) return [...bloques, conDestino]

  // Detras de la tarea, saltando los apoyos que ya cuelgan de ella.
  let pos = posTarea + 1
  while (pos < bloques.length && bloques[pos].tipo !== 'tarea' && bloques[pos].tareaId === destino.tareaId) {
    pos++
  }
  const copia = [...bloques]
  copia.splice(pos, 0, conDestino)
  return copia
}

/**
 * Mueve un bloque una posicion arriba o abajo.
 *
 * Los apoyos NO se reasignan al moverse: `tareaId` es un id estable, no
 * una posicion, asi que una imagen sigue perteneciendo a su tarea
 * aunque las dos cambien de sitio (requisito 6 del editor, criterio
 * A06). Esta funcion existe sobre todo para poder demostrarlo: antes
 * del 2026-09-09 no habia forma de reordenar dentro de un paso.
 */
export function moverBloque(bloques: BloquePaso[], bloqueId: string, direccion: -1 | 1): BloquePaso[] {
  const desde = bloques.findIndex((b) => b.id === bloqueId)
  const hasta = desde + direccion
  if (desde < 0 || hasta < 0 || hasta >= bloques.length) return bloques
  const copia = [...bloques]
  const [movido] = copia.splice(desde, 1)
  copia.splice(hasta, 0, movido)
  return copia
}

/**
 * Mueve una TAREA con todos sus apoyos pegados, que es lo que el autor
 * espera al reordenar: llevar "escribir la direccion" detras de
 * "confirmar" tiene que llevarse tambien su captura y su precaucion.
 * Mover la tarea sola las dejaria colgando de una linea que ya no esta
 * al lado, y en la lectura completa el aviso quedaria fuera de sitio.
 */
export function moverTareaConApoyos(
  bloques: BloquePaso[],
  tareaId: string,
  direccion: -1 | 1,
): BloquePaso[] {
  const grupos = agruparPorTarea(bloques)
  const indice = grupos.findIndex((g) => g.tareaId === tareaId)
  const destino = indice + direccion
  if (indice < 0 || destino < 0 || destino >= grupos.length) return bloques
  const copia = [...grupos]
  const [movido] = copia.splice(indice, 1)
  copia.splice(destino, 0, movido)
  return copia.flatMap((g) => g.bloques)
}

// Los bloques agrupados en unidades movibles: cada tarea con los apoyos
// que la siguen, y los apoyos sueltos del principio como su propio
// grupo (no cuelgan de ninguna tarea).
function agruparPorTarea(bloques: BloquePaso[]): { tareaId: string | null; bloques: BloquePaso[] }[] {
  const grupos: { tareaId: string | null; bloques: BloquePaso[] }[] = []
  for (const bloque of bloques) {
    if (bloque.tipo === 'tarea' || grupos.length === 0) {
      grupos.push({ tareaId: bloque.tipo === 'tarea' ? bloque.id : null, bloques: [bloque] })
    } else {
      grupos[grupos.length - 1].bloques.push(bloque)
    }
  }
  return grupos
}

/** Reasigna un apoyo a otra tarea o al paso completo. */
export function reasignarApoyo(
  bloques: BloquePaso[],
  bloqueId: string,
  destino: DestinoApoyo,
): BloquePaso[] {
  return bloques.map((b) =>
    b.id === bloqueId ? { ...b, alcance: destino.alcance, tareaId: destino.tareaId } : b,
  )
}

/**
 * CAMBIAR EL TIPO DE UNA TAREA SIN BORRADOS SILENCIOSOS (requisito 7).
 *
 * Antes, salir de "decision" soltaba el vinculo del "No" sin decir
 * nada: el autor cambiaba de tipo para probar, volvia, y su vinculo ya
 * no estaba. Ahora la funcion devuelve TAMBIEN que quedaria fuera, para
 * que la interfaz lo pregunte antes en vez de descubrirlo despues.
 *
 * El texto nunca se pierde: es compatible con los tres tipos.
 */
export interface CambioDeTipo {
  bloque: BloquePaso
  /** Descripcion de lo incompatible que se soltaria, para avisar. */
  perdido: string[]
}

export function cambiarTipoTarea(bloque: BloquePaso, tipoTarea: TipoTarea): CambioDeTipo {
  if (tipoTarea === 'decision') {
    return { bloque: { ...bloque, tipoTarea }, perdido: [] }
  }
  // Fuera de "decision" el vinculo del "No" no tiene donde vivir.
  const perdido = bloque.decisionArticuloId
    ? [`el vínculo «${bloque.decisionArticuloTitulo || 'guía vinculada'}» de la respuesta No`]
    : []
  return {
    bloque: { ...bloque, tipoTarea, decisionArticuloId: null, decisionArticuloTitulo: '' },
    perdido,
  }
}

/**
 * Como se nombra el destino de un apoyo en la pastilla del editor. La
 * tarea se nombra por su NUMERO dentro del paso, no por su texto: el
 * texto puede estar vacio mientras se escribe y ademas no cabe.
 */
export function etiquetaDestino(bloques: BloquePaso[], bloque: BloquePaso): string {
  if (bloque.alcance === 'paso') return 'Todo el paso'
  if (bloque.alcance === 'sin-asignar' || !bloque.tareaId) return 'Sin asignar'
  const numero = bloques.filter((b) => b.tipo === 'tarea').findIndex((b) => b.id === bloque.tareaId)
  return numero >= 0 ? `Tarea ${numero + 1}` : 'Sin asignar'
}

/** Las tareas del paso con su numero, para el selector de destino. */
export function opcionesDestino(bloques: BloquePaso[]): { id: string; numero: number; texto: string }[] {
  return bloques
    .filter((b) => b.tipo === 'tarea')
    .map((b, i) => ({ id: b.id, numero: i + 1, texto: b.texto }))
}
