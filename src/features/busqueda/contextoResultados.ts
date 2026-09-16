import { createContext, useContext } from 'react'
import type { EstadoConOrigen } from '../../lib/origenNavegacion'
import type { AccionGuia } from '../soluciones/accionGuia'
import { registrarResolucion, type EventoResolucion } from './medicion'
import type { ModoBuscador } from './modoConsulta'

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
  /**
   * Normal, o consulta encima de una tarea (encargo del 2026-09-16,
   * seccion 8): en consulta nada navega. Ver `modoConsulta.ts`.
   */
  modo: ModoBuscador
  /** Id del resultado con la vista rapida desplegada, o null. */
  vistaAbierta: string | null
  /** Despliega o recoge la vista rapida de un resultado (una a la vez). */
  alternarVista: (id: string) => void
  /**
   * El `state` de un salto desde un resultado: el origen, con la busqueda
   * para reponerla al volver (seccion 13).
   */
  estadoDeSalto: EstadoConOrigen
  /**
   * Se llama en el mismo gesto que cualquier salto desde un resultado,
   * antes de el: anota la busqueda en la entrada actual del historial,
   * para que tambien el boton atras del telefono la encuentre.
   */
  alSaltar: () => void
}

const VALOR_POR_DEFECTO: ValorContextoResultados = {
  accionesGuia: new Map(),
  consulta: '',
  onResolver: registrarResolucion,
  huboDesbloqueo: false,
  modo: 'normal',
  vistaAbierta: null,
  alternarVista: () => undefined,
  estadoDeSalto: {},
  alSaltar: () => undefined,
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
