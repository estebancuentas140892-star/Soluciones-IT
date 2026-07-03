import { db } from './db'

// Avance local de un tecnico dentro de un procedimiento: que pasos
// marco como hechos y que instrucciones marco dentro de cada paso.
// Vive solo en el dispositivo (como los recientes): cada tecnico
// lleva su propio avance y puede retomarlo si lo interrumpen a mitad
// de un mantenimiento.
//
// Consistencia entre niveles: marcar la ultima instruccion completa
// el paso; desmarcar una instruccion lo vuelve pendiente; marcar o
// desmarcar el paso entero arrastra todas sus instrucciones.

// Clave de una instruccion dentro del avance. Usa el indice porque
// las instrucciones no tienen id propio (se editan como lineas de
// texto); si el procedimiento se edita a mitad de ejecucion, el
// avance de ese paso puede quedar desfasado, algo aceptable para un
// dato local y efimero.
export function claveInstruccion(pasoId: string, indice: number): string {
  return `${pasoId}:${indice}`
}

export function clavesDeInstrucciones(pasoId: string, total: number): string[] {
  return Array.from({ length: total }, (_, i) => claveInstruccion(pasoId, i))
}

// Marca o desmarca un paso completo, arrastrando sus instrucciones.
export async function establecerPasoHecho(
  articuloId: string,
  pasoId: string,
  hecho: boolean,
  clavesInstrucciones: string[] = [],
): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  const pasos = new Set(actual?.pasosHechos ?? [])
  const instrucciones = new Set(actual?.instruccionesHechas ?? [])

  if (hecho) {
    pasos.add(pasoId)
    for (const clave of clavesInstrucciones) instrucciones.add(clave)
  } else {
    pasos.delete(pasoId)
    for (const clave of clavesInstrucciones) instrucciones.delete(clave)
  }

  await db.progresoPasos.put({
    articuloId,
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
    actualizadoEn: new Date().toISOString(),
  })
}

// Alterna una instruccion y mantiene el estado del paso en sintonia.
// Devuelve true si con este cambio el paso quedo completo (todas sus
// instrucciones marcadas): la señal para el avance automatico.
export async function alternarInstruccionHecha(
  articuloId: string,
  pasoId: string,
  indice: number,
  totalInstrucciones: number,
): Promise<boolean> {
  const actual = await db.progresoPasos.get(articuloId)
  const pasos = new Set(actual?.pasosHechos ?? [])
  const instrucciones = new Set(actual?.instruccionesHechas ?? [])

  const clave = claveInstruccion(pasoId, indice)
  if (instrucciones.has(clave)) {
    instrucciones.delete(clave)
  } else {
    instrucciones.add(clave)
  }

  const completo =
    totalInstrucciones > 0 &&
    clavesDeInstrucciones(pasoId, totalInstrucciones).every((c) => instrucciones.has(c))
  if (completo) {
    pasos.add(pasoId)
  } else {
    pasos.delete(pasoId)
  }

  await db.progresoPasos.put({
    articuloId,
    pasosHechos: [...pasos],
    instruccionesHechas: [...instrucciones],
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

// Cuantas instrucciones de un paso estan marcadas.
export function contarInstruccionesHechas(
  instruccionesHechas: string[] | undefined,
  pasoId: string,
  total: number,
): number {
  const hechas = new Set(instruccionesHechas ?? [])
  return clavesDeInstrucciones(pasoId, total).filter((clave) => hechas.has(clave)).length
}
