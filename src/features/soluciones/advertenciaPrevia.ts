import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'
import { presenciaDeAviso, tonoVigente, type TonoInfo } from './tonos'

// LA ADVERTENCIA PREVIA (tarea 311, regla 27 g, AD-072).
//
// Un riesgo real (Precaución o Importante) se lee ANTES de la acción que
// puede causarlo, en su propio momento, y no compartiendo pantalla con la
// instrucción, "Cómo hacerlo" y el resto de apoyos: ahí, aunque fuera en
// rojo, todavía podía pasarse por alto (hallazgo real del usuario). La
// tarea 307 lo había dejado bajo la instrucción para que estuviera a la
// vista; esta tarea le da su momento.
//
// NO ES UN MODELO NUEVO. El aviso sigue perteneciendo a su tarea (o al paso)
// en el JSON, como lo escribe el autor en el editor: la ejecución es la que
// lo presenta como un punto de control previo. Por eso no es una acción: no
// se marca, no cuenta en el progreso, no tiene número ni historial.
//
// Y NO ES LO DE SEPTIEMBRE. Entre el 10 y el 17 de septiembre cada aviso,
// fuera del tono que fuera (también los consejos), tenía su pantalla con
// "Entendido · continuar", y una guía real interrumpía cada pocas acciones:
// se acabó tocando sin leer (cabecera de tareasFoco.ts). Ahora solo los
// riesgos reales interrumpen, y varios de una misma acción van juntos en un
// único punto de control. El dato técnico sigue dentro de su acción.

/** ¿Este aviso es un riesgo real, de los que se leen antes de su acción? */
export function esRiesgoReal(bloque: BloquePaso): boolean {
  return bloque.tipo === 'aviso' && presenciaDeAviso(bloque.tono) === 'alerta'
}

/**
 * El tono de una advertencia previa con varios riesgos: manda el más fuerte.
 * Importante si alguno lo es; si no, Precaución.
 */
export function tonoDeLaAdvertencia(alertas: readonly BloquePaso[]): TonoInfo {
  const valor = alertas.some((alerta) => alerta.tono === 'importante') ? 'importante' : 'precaucion'
  return tonoVigente(valor) as TonoInfo
}

/** Las advertencias de un paso tal como se colocan en una vista de lista. */
export interface AdvertenciasDeLista {
  /** Los riesgos que se leen antes de cada tarea, por su id, en orden. */
  antesDe: Map<string, BloquePaso[]>
  /** Los avisos que ya no se dibujan donde están: van antes de su tarea. */
  reubicados: Set<string>
}

/**
 * DÓNDE VA CADA RIESGO EN UNA LISTA (el paso entero, la lectura, "Probar"):
 * antes de la tarea a la que pertenece, nunca debajo. Los del paso (y los
 * heredados sin asignar) son las condiciones de todo lo que sigue, así que
 * van antes de la PRIMERA tarea, como en la acción a la vez van con la
 * primera entrada; primero ellos y después los de esa tarea, cada uno en el
 * orden del autor. Un paso sin tareas no tiene acción a la que preceder: sus
 * riesgos se quedan donde están. Un riesgo de una tarea que ya no existe
 * tampoco se mueve.
 */
export function advertenciasDeLista(paso: PasoProcedimiento): AdvertenciasDeLista {
  const tareas = tareasDe(paso.bloques)
  const idsTareas = new Set(tareas.map((tarea) => tarea.id))
  const primera = tareas[0]?.id ?? null
  const antesDe = new Map<string, BloquePaso[]>()
  const reubicados = new Set<string>()

  function colocar(tareaId: string, alerta: BloquePaso) {
    antesDe.set(tareaId, [...(antesDe.get(tareaId) ?? []), alerta])
    reubicados.add(alerta.id)
  }

  const riesgos = paso.bloques.filter(esRiesgoReal)
  if (primera) {
    for (const alerta of riesgos) if (alerta.alcance !== 'tarea') colocar(primera, alerta)
  }
  for (const alerta of riesgos) {
    if (alerta.alcance === 'tarea' && alerta.tareaId && idsTareas.has(alerta.tareaId)) colocar(alerta.tareaId, alerta)
  }
  return { antesDe, reubicados }
}

/**
 * Las acciones de una lista cuya advertencia todavía ocupa su sitio: con
 * riesgo, pendientes y sin leer. Mientras tanto, tampoco se dibujan sus
 * apoyos (su dato técnico, su imagen, su credencial): son de la acción, y la
 * acción llega después.
 */
export function accionesEnEspera(
  advertencias: AdvertenciasDeLista,
  hechas: ReadonlySet<string>,
  leidas: ReadonlySet<string>,
): Set<string> {
  return new Set([...advertencias.antesDe.keys()].filter((id) => !hechas.has(id) && !leidas.has(id)))
}

/** ¿Este bloque es un apoyo de una acción que todavía espera tras su advertencia? */
export function esApoyoEnEspera(bloque: BloquePaso, enEspera: ReadonlySet<string>): boolean {
  return bloque.tipo !== 'tarea' && bloque.alcance === 'tarea' && bloque.tareaId !== null && enEspera.has(bloque.tareaId)
}
