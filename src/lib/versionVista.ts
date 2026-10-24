// «SOLUCIONES IT SE ACTUALIZÓ A LA VERSIÓN X» (pedido del usuario del
// 2026-10-23, tarea 353).
//
// El aviso «Versión nueva disponible» solo sale mientras la versión nueva
// espera. Si se cierra la app del todo y se vuelve a abrir, el navegador
// activa el worker nuevo por su cuenta y la app arranca ya actualizada: no
// hay botón que enseñar, y desde el teléfono no se sabía si los cambios
// habían llegado. Por eso cada teléfono recuerda la última versión que
// abrió y, la primera vez que abre otra, lo dice, venga la actualización
// del botón «Actualizar» o se haya aplicado sola.
//
// Vive en `localStorage` de este teléfono: no se sincroniza ni toca
// IndexedDB, la sesión o el avance de las guías. En desarrollo (sin commit
// horneado) no se dice nada.

import { db } from './db'
import { VERSION_DESARROLLO, versionApp } from './versionApp'

export const CLAVE_VERSION_VISTA = 'sit-version-vista'

/**
 * ¿Toca decir que la app se actualizó? Pura.
 *
 * Sin versión guardada hay dos casos que no se distinguen por la clave:
 * una instalación nueva (no hay nada que anunciar) y el primer arranque de
 * quien ya usaba la app antes de que existiera este aviso (sí se anuncia).
 * Los separa `hayUsoPrevio`: si el teléfono ya tenía datos de la app.
 */
export function versionEstrenada(guardada: string | null, actual: string, hayUsoPrevio: boolean): boolean {
  if (actual === VERSION_DESARROLLO) return false
  if (guardada === null) return hayUsoPrevio
  return guardada !== actual
}

/** Si este teléfono ya tenía la app en uso: guías o categorías en la base local. */
export async function hayDatosPrevios(): Promise<boolean> {
  try {
    return (await db.categorias.count()) > 0 || (await db.articulos.count()) > 0
  } catch {
    return false
  }
}

/**
 * Anota la versión que se está abriendo y devuelve cuál anunciar, o null.
 * Nunca lanza: sin `localStorage` (bloqueado, modo privado) no se dice nada.
 */
export async function estrenoDeVersion(
  actual: string = versionApp(),
  usoPrevio: () => Promise<boolean> = hayDatosPrevios,
): Promise<string | null> {
  if (actual === VERSION_DESARROLLO) return null
  let guardada: string | null
  try {
    guardada = localStorage.getItem(CLAVE_VERSION_VISTA)
  } catch {
    return null
  }
  const anunciar = versionEstrenada(guardada, actual, guardada === null ? await usoPrevio() : false)
  try {
    localStorage.setItem(CLAVE_VERSION_VISTA, actual)
  } catch {
    // Sin poder guardarla se diría en cada arranque: mejor no decirlo.
    return null
  }
  return anunciar ? actual : null
}

/** El texto del aviso. */
export function textoVersionEstrenada(version: string): string {
  return `Soluciones IT se actualizó a la versión ${version}`
}
