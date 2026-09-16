import { createContext, useContext } from 'react'
import type { AccionGuia } from '../soluciones/accionGuia'
import { registrarResolucion, type EventoResolucion } from './medicion'

// Lo que toda fila de resultados necesita saber y NINGUNA deberia
// recalcular por su cuenta (tarea 241): que ofrece cada guia, que se
// tecleo, y a quien avisar cuando el tecnico resuelve algo.
//
// Va en contexto y no en props encadenadas porque el mapa de acciones de
// guia sale de dos consultas vivas: pasarlo fila por fila obligaria a
// cada nivel intermedio (grupo, seccion de mejores) a reenviar datos que
// no le importan, y montarlo dentro de cada fila abriria una consulta
// por resultado.

export interface ValorContextoResultados {
  /** Accion de cada guia ejecutable, resuelta por `accionDeGuia`. */
  accionesGuia: Map<string, AccionGuia>
  /** Lo que el tecnico escribio, sin normalizar. Solo para la medicion. */
  consulta: string
  /** Cerrar la capa del buscador al navegar (Inicio no pasa nada). */
  onNavegar?: () => void
  /** Se llamo con exito una accion que resuelve (seccion 17). */
  onResolver: (evento: EventoResolucion) => void
  /** Hubo que desbloquear la boveda en este mismo recorrido. */
  huboDesbloqueo: boolean
}

const VALOR_POR_DEFECTO: ValorContextoResultados = {
  accionesGuia: new Map(),
  consulta: '',
  onResolver: registrarResolucion,
  huboDesbloqueo: false,
}

export const ContextoResultados = createContext<ValorContextoResultados>(VALOR_POR_DEFECTO)

export function useContextoResultados(): ValorContextoResultados {
  return useContext(ContextoResultados)
}

/**
 * El id real de la entidad dentro del id del documento del indice
 * (`articulo:abc` -> `abc`). El indice prefija el tipo para que dos
 * tablas no compartan espacio de ids.
 */
export function idDeEntidad(idDocumento: string): string {
  const corte = idDocumento.indexOf(':')
  return corte < 0 ? idDocumento : idDocumento.slice(corte + 1)
}
