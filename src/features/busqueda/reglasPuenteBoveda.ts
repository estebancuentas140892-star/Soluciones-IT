import { normalizarTexto } from '../soluciones/iconosSoluciones'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

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

/**
 * Cuánto pesa el puente en pantalla (encargo del 2026-09-16, sección 14).
 *
 *   - 'destacado': la fila de siempre, con su botón de ancho completo.
 *   - 'secundario': una línea compacta con un botón pequeño, para que no
 *     compita con lo que ya se encontró.
 */
export type ProminenciaPuente = 'destacado' | 'secundario'

/**
 * El puente cede protagonismo cuando lo PÚBLICO ya responde con fuerza:
 * buscar "Zabbix" y tener la herramienta Zabbix arriba no pide una puerta
 * cerrada del mismo tamaño que la respuesta. Sin resultados públicos, o
 * sin ninguno que coincida de verdad, el puente se queda como estaba.
 *
 * Mira SOLO los resultados públicos que ya están en pantalla (con la
 * bóveda cerrada no hay otros en el índice): no intenta, ni puede,
 * adivinar si existe una credencial con ese nombre (sección 19 de la
 * tarea 241).
 */
export function prominenciaPuenteBoveda(resultados: ResultadoBusqueda[], consulta: string): ProminenciaPuente {
  return hayCoincidenciaFuerte(resultados, consulta) ? 'secundario' : 'destacado'
}

/**
 * ¿Algún resultado coincide de verdad con lo escrito? Cuenta el título
 * exacto y el título que EMPIEZA por la consulta entera como palabra
 * ("zabbix" con "Zabbix (ZBX)"), nunca un sinónimo: lo que solo trajo un
 * sinónimo no es lo que el técnico escribió.
 */
export function hayCoincidenciaFuerte(resultados: ResultadoBusqueda[], consulta: string): boolean {
  const texto = normalizarTexto(consulta.trim())
  if (!texto) return false
  return resultados.some((resultado) => {
    if (resultado.soloSinonimo) return false
    const titulo = normalizarTexto(resultado.titulo.trim())
    return titulo === texto || titulo.startsWith(`${texto} `)
  })
}
