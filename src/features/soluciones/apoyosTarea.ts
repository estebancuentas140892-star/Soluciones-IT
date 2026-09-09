import type { BloquePaso, PasoAdjunto, PasoProcedimiento, VinculoProtegido } from '../../lib/db'

// QUE APOYOS LE TOCAN A CADA TAREA.
//
// El defecto que cierra (H03 y H04 del informe del 2026-09-08, criterios
// A04 y A05): el modo de una tarea a la vez tomaba TODOS los avisos,
// TODAS las imagenes y TODA la galeria de archivos del paso y los
// pintaba en TODAS sus tareas. En el paso de tres tareas del informe,
// la misma precaucion y el mismo boton "Archivo" salian al escribir la
// direccion, al confirmar y al comprobar el resultado. La causa no era
// de presentacion: el dato no tenia con que decir a que tarea
// pertenecia un apoyo, asi que la vista no podia elegir.
//
// Con `alcance`/`tareaId` en el bloque (ver src/lib/db.ts) la decision
// es una particion limpia y comprobable, y vive aqui, fuera de los
// componentes, porque es la regla del producto:
//
//   - apoyo de la TAREA X: se ve solo con la tarea X;
//   - apoyo del PASO: se ve UNA vez, al entrar al paso, y queda
//     consultable desde cualquier tarea; nunca se repite;
//   - apoyo SIN ASIGNAR (viene de una guia anterior al campo): se
//     comporta como el del paso y ademas se señala en el editor. No se
//     reparte ni se oculta: se conserva y se pide que lo asignen.

export interface Apoyos {
  avisos: BloquePaso[]
  imagenes: BloquePaso[]
  archivos: BloquePaso[]
  guias: BloquePaso[]
  /** Adjuntos de la galeria del paso completo (solo en los del paso). */
  adjuntosPaso: PasoAdjunto[]
  vinculoProtegido: VinculoProtegido | null
}

const VACIOS: Apoyos = {
  avisos: [],
  imagenes: [],
  archivos: [],
  guias: [],
  adjuntosPaso: [],
  vinculoProtegido: null,
}

function repartir(bloques: BloquePaso[]): Omit<Apoyos, 'adjuntosPaso' | 'vinculoProtegido'> {
  return {
    avisos: bloques.filter((b) => b.tipo === 'aviso'),
    // Una imagen sin adjunto no se puede mostrar; no llega a guardarse
    // asi, pero el editor si tiene ese estado intermedio.
    imagenes: bloques.filter((b) => b.tipo === 'imagen' && b.adjunto !== null),
    archivos: bloques.filter((b) => b.tipo === 'archivo' && b.adjunto !== null),
    guias: bloques.filter((b) => b.tipo === 'guia' && b.guiaArticuloId !== null),
  }
}

/** Los apoyos anclados a UNA tarea concreta, en el orden del autor. */
export function apoyosDeTarea(paso: PasoProcedimiento, tareaId: string): Apoyos {
  const propios = paso.bloques.filter((b) => b.tipo !== 'tarea' && b.alcance === 'tarea' && b.tareaId === tareaId)
  const tarea = paso.bloques.find((b) => b.id === tareaId)
  return {
    ...VACIOS,
    ...repartir(propios),
    // El dato protegido de una tarea ya vivia en el propio bloque
    // (tarea 40): se respeta tal cual, no se duplica como apoyo.
    vinculoProtegido: tarea?.vinculoProtegido ?? null,
  }
}

/**
 * Los apoyos del PASO completo: los que el autor marco como del paso y
 * los heredados que no dicen a que tarea pertenecen. Incluye la
 * galeria de archivos del paso y su dato protegido.
 */
export function apoyosDelPaso(paso: PasoProcedimiento): Apoyos {
  const delPaso = paso.bloques.filter(
    (b) => b.tipo !== 'tarea' && (b.alcance === 'paso' || b.alcance === 'sin-asignar'),
  )
  return {
    ...VACIOS,
    ...repartir(delPaso),
    adjuntosPaso: paso.adjuntos,
    vinculoProtegido: paso.vinculoProtegido,
  }
}

/** ¿Hay algo que mostrar? Sirve para no dibujar controles vacios. */
export function hayApoyos(apoyos: Apoyos): boolean {
  return (
    apoyos.avisos.length > 0 ||
    apoyos.imagenes.length > 0 ||
    apoyos.archivos.length > 0 ||
    apoyos.guias.length > 0 ||
    apoyos.adjuntosPaso.length > 0 ||
    apoyos.vinculoProtegido !== null
  )
}

/** Cuantas piezas de apoyo hay, para el contador de un control plegado. */
export function cuentaApoyos(apoyos: Apoyos): number {
  return (
    apoyos.avisos.length +
    apoyos.imagenes.length +
    apoyos.archivos.length +
    apoyos.guias.length +
    apoyos.adjuntosPaso.length +
    (apoyos.vinculoProtegido ? 1 : 0)
  )
}

/**
 * Apoyos heredados que hay que revisar a mano: los que se guardaron
 * antes de que el bloque dijera a que tarea pertenece. La ficha del
 * editor los marca uno a uno y el informe de migracion los cuenta.
 *
 * Un paso SIN tareas no tiene ambiguedad que resolver: no habia entre
 * que repartir, asi que su apoyo es del paso y punto.
 */
export function apoyosSinAsignar(paso: PasoProcedimiento): BloquePaso[] {
  const hayTareas = paso.bloques.some((b) => b.tipo === 'tarea')
  if (!hayTareas) return []
  return paso.bloques.filter((b) => b.tipo !== 'tarea' && b.alcance === 'sin-asignar')
}
