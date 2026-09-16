// LA REGLA DEL PUENTE A LA BOVEDA, APARTE DE SU PINTURA (tarea 241).
//
// Cuando se ofrece buscar dentro de la boveda bloqueada es una decision
// de SEGURIDAD, no de maquetacion: de ella depende que un usuario sin
// permiso no llegue a saber siquiera que existe una seccion protegida
// con contenido buscable. Por eso vive en su propio modulo, en una
// funcion pura y con pruebas, y no enterrada en un `&&` dentro del JSX.

export interface EstadoPuenteBoveda {
  /** El perfil tiene el permiso `puedeVerBoveda`. */
  puedeVerBoveda: boolean
  /** La sesion de la boveda esta abierta en este momento. */
  desbloqueada: boolean
  /** Lo que el tecnico escribio, tal cual. */
  consulta: string
}

/**
 * ¿Se ofrece "Buscar «X» en Bóveda"?
 *
 * Solo con permiso, solo con la boveda cerrada y solo con algo escrito.
 * Sin permiso no se dice nada (minima exposicion); desbloqueada no hace
 * falta, porque los accesos ya salen en los resultados normales con sus
 * acciones rapidas.
 */
export function debeOfrecerPuenteBoveda(estado: EstadoPuenteBoveda): boolean {
  if (!estado.puedeVerBoveda) return false
  if (estado.desbloqueada) return false
  return estado.consulta.trim().length > 0
}

/**
 * El rotulo del puente. Cita lo que se escribio y NO afirma nada sobre
 * lo que hay al otro lado: es la misma frase para una consulta que
 * existe en la boveda y para una que no, que es justo lo que impide que
 * la sugerencia delate la existencia de una credencial concreta
 * (seccion 19 del encargo).
 */
export function etiquetaPuenteBoveda(consulta: string): string {
  return `Buscar "${consulta.trim()}" en Bóveda`
}
