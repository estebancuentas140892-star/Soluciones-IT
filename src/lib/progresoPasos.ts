import { db, type ProgresoPasos } from './db'

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

// GUARDA MEZCLANDO, NUNCA REEMPLAZANDO (2026-09-09).
//
// Cada escritor de este modulo armaba el registro entero a mano, asi que
// cualquier campo que no listara desaparecia: `establecerPasoHecho` y
// `alternarInstruccionHecha` no nombraban `evidenciasPorPaso`, de modo
// que marcar un paso borraba el vinculo de TODA la evidencia fotografica
// del articulo (las entradas del historial seguian ahi, pero el paso
// dejaba de encontrarlas y la siguiente foto creaba otra intervencion).
// Con el campo nuevo `pasosSaltados` el mismo descuido habria vuelto a
// morder, asi que se centraliza: quien escribe dice SOLO lo que cambia.
async function guardarProgreso(
  articuloId: string,
  cambios: Partial<Omit<ProgresoPasos, 'articuloId' | 'actualizadoEn'>>,
): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  await db.progresoPasos.put({
    articuloId,
    pasosHechos: actual?.pasosHechos ?? [],
    instruccionesHechas: actual?.instruccionesHechas ?? [],
    verificacionHecha: actual?.verificacionHecha ?? [],
    evidenciasPorPaso: actual?.evidenciasPorPaso,
    pasosSaltados: actual?.pasosSaltados,
    ...cambios,
    actualizadoEn: new Date().toISOString(),
  })
}

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

  // Un paso que se completa deja de estar saltado: son estados
  // excluyentes, y el indice tiene que decir el ultimo que vale.
  const saltados = (actual?.pasosSaltados ?? []).filter((id) => id !== pasoId)

  await guardarProgreso(articuloId, {
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
    pasosSaltados: saltados,
  })
}

/**
 * Deja constancia de que el tecnico SALTO este paso a proposito
 * (hallazgo H07). Es un acto explicito, no una deduccion: hasta ahora
 * el indice llamaba "saltado" a cualquier paso sin hacer que quedara
 * por detras del actual, asi que mirar el paso siguiente con la flecha
 * bastaba para marcar el anterior como saltado. Navegar es consultar;
 * saltar es decidir seguir sin hacerlo.
 */
export async function marcarPasoSaltado(articuloId: string, pasoId: string): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  const saltados = new Set(actual?.pasosSaltados ?? [])
  saltados.add(pasoId)
  await guardarProgreso(articuloId, { pasosSaltados: [...saltados] })
}

/** Retira la marca de saltado (el tecnico vuelve y lo retoma). */
export async function quitarPasoSaltado(articuloId: string, pasoId: string): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  if (!actual?.pasosSaltados?.includes(pasoId)) return
  await guardarProgreso(articuloId, {
    pasosSaltados: actual.pasosSaltados.filter((id) => id !== pasoId),
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

  // Tocar una tarea de un paso saltado es retomarlo.
  const saltados = (actual?.pasosSaltados ?? []).filter((id) => id !== pasoId)

  await guardarProgreso(articuloId, {
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
    pasosSaltados: saltados,
  })
  return completo
}

export async function reiniciarProgreso(articuloId: string): Promise<void> {
  await db.progresoPasos.delete(articuloId)
}

// Recuerda con que entrada de historial quedo asociada la evidencia
// fotografica de un paso (tarea 79): la primera vez que el tecnico
// adjunta algo para ese paso, no en cada revisita (si no, cada vez que
// se reabre el paso se crearia una intervencion nueva y la evidencia
// quedaria repartida en varias entradas del historial).
export async function registrarEvidenciaPaso(
  articuloId: string,
  pasoId: string,
  entradaId: string,
): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  await guardarProgreso(articuloId, {
    evidenciasPorPaso: { ...actual?.evidenciasPorPaso, [pasoId]: entradaId },
  })
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
  await guardarProgreso(articuloId, { verificacionHecha: [...marcadas] })
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
