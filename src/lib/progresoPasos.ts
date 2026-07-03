import { db } from './db'

// Avance local de un tecnico dentro de un procedimiento: que pasos
// ya marco como hechos. Vive solo en el dispositivo (como los
// recientes): cada tecnico lleva su propio avance y puede retomarlo
// si lo interrumpen a mitad de un mantenimiento.

export async function alternarPasoHecho(articuloId: string, pasoId: string): Promise<void> {
  const actual = await db.progresoPasos.get(articuloId)
  const hechos = new Set(actual?.pasosHechos ?? [])
  if (hechos.has(pasoId)) {
    hechos.delete(pasoId)
  } else {
    hechos.add(pasoId)
  }
  await db.progresoPasos.put({
    articuloId,
    pasosHechos: [...hechos],
    actualizadoEn: new Date().toISOString(),
  })
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
