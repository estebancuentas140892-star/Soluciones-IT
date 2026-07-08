import { db } from './db'

// Avance local de un tecnico dentro de un procedimiento: que pasos
// marco como hechos y que instrucciones marco dentro de cada paso.
// Vive solo en el dispositivo (como los recientes): cada tecnico
// lleva su propio avance y puede retomarlo si lo interrumpen a mitad
// de un mantenimiento.
//
// Consistencia entre niveles: completar todas las instrucciones deja
// el paso LISTO para completarse, pero quien decide marcarlo hecho es
// la vista (ProcedimientoVista), que tambien exige el subprocedimiento
// vinculado y la solucion de error del paso; desmarcar una instruccion
// vuelve el paso pendiente; marcar o desmarcar el paso entero arrastra
// todas sus instrucciones.

// Marca o desmarca un paso completo, arrastrando sus tareas (los
// bloques con casilla). `tareaIds` son los ids de esos bloques.
export async function establecerPasoHecho(
  articuloId: string,
  pasoId: string,
  hecho: boolean,
  tareaIds: string[] = [],
): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  const pasos = new Set(actual?.pasosHechos ?? [])
  const instrucciones = new Set(actual?.instruccionesHechas ?? [])

  if (hecho) {
    pasos.add(pasoId)
    for (const tareaId of tareaIds) instrucciones.add(tareaId)
  } else {
    pasos.delete(pasoId)
    for (const tareaId of tareaIds) instrucciones.delete(tareaId)
  }

  await db.progresoPasos.put({
    articuloId,
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
    verificacionHecha: actual?.verificacionHecha ?? [],
    actualizadoEn: new Date().toISOString(),
  })
}

// Alterna una tarea (bloque con casilla) por su id. Devuelve true si
// con este cambio TODAS las tareas del paso quedaron marcadas: es la
// señal para que la vista intente completar el paso (que ademas
// revisara el subprocedimiento y la solucion antes de avanzar). Aqui NO
// se marca el paso como hecho al completar las tareas, para no saltarse
// el resto del contenido del paso; pero si al desmarcar una tarea el
// paso deja de estar completo, se retira de los hechos (desmarcar
// vuelve el paso pendiente). `tareaIds` son todos los ids de tareas del
// paso, para saber si quedaron todas marcadas.
export async function alternarInstruccionHecha(
  articuloId: string,
  pasoId: string,
  tareaId: string,
  tareaIds: string[],
): Promise<boolean> {
  const actual = await db.progresoPasos.get(articuloId)
  const pasos = new Set(actual?.pasosHechos ?? [])
  const instrucciones = new Set(actual?.instruccionesHechas ?? [])

  if (instrucciones.has(tareaId)) {
    instrucciones.delete(tareaId)
  } else {
    instrucciones.add(tareaId)
  }

  const completo = tareaIds.length > 0 && tareaIds.every((id) => instrucciones.has(id))
  if (!completo) {
    pasos.delete(pasoId)
  }

  await db.progresoPasos.put({
    articuloId,
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
    verificacionHecha: actual?.verificacionHecha ?? [],
    actualizadoEn: new Date().toISOString(),
  })
  return completo
}

export async function reiniciarProgreso(articuloId: string): Promise<void> {
  await db.progresoPasos.delete(articuloId)
}

// Cuantos de los pasos actuales estan hechos. Se cruza contra los
// ids vigentes porque el procedimiento pudo editarse despues de
// marcar avance (los pasos eliminados no deben contar).
export function contarHechos(pasosHechos: string[], idsVigentes: string[]): number {
  const hechos = new Set(pasosHechos)
  return idsVigentes.filter((id) => hechos.has(id)).length
}

// Cuantas de las tareas dadas (por id) estan marcadas.
export function contarInstruccionesHechas(
  instruccionesHechas: string[] | undefined,
  tareaIds: string[],
): number {
  const hechas = new Set(instruccionesHechas ?? [])
  return tareaIds.filter((id) => hechas.has(id)).length
}

// Alterna una casilla de "Verificacion final" (por indice, igual que
// las instrucciones de un paso: no tienen id propio).
export async function alternarVerificacionFinal(
  articuloId: string,
  indice: number,
): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  const marcadas = new Set(actual?.verificacionHecha ?? [])
  if (marcadas.has(indice)) {
    marcadas.delete(indice)
  } else {
    marcadas.add(indice)
  }
  await db.progresoPasos.put({
    articuloId,
    pasosHechos: actual?.pasosHechos ?? [],
    instruccionesHechas: actual?.instruccionesHechas ?? [],
    verificacionHecha: [...marcadas],
    actualizadoEn: new Date().toISOString(),
  })
}

// La verificacion final cuenta como completa cuando no hay items (no
// se definio) o cuando todos estan marcados.
export function verificacionFinalCompleta(
  verificacionHecha: number[] | undefined,
  total: number,
): boolean {
  if (total === 0) return true
  const marcadas = new Set(verificacionHecha ?? [])
  return Array.from({ length: total }, (_, i) => i).every((i) => marcadas.has(i))
}
