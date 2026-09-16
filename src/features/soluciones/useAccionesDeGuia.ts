import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Articulo, type ProgresoPasos } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { accionDeGuia, type AccionGuia } from './accionGuia'

// QUE OFRECE CADA GUIA, EN UN SOLO SITIO (tarea 241).
//
// El catalogo de Guias ya calculaba esto dentro de `SolucionesPage`
// para poder rotular su tarjeta ("Empezar" / "Continuar · paso N de M").
// Desde que los resultados del buscador global traen la misma accion
// directa, el calculo lo necesitan DOS pantallas, y duplicarlo seria
// exactamente la regla de progreso paralela que el encargo prohibe
// (seccion 3: "Reutiliza la logica existente de `accionDeGuia`. No
// dupliques reglas de progreso").
//
// La decision sigue siendo de `accionDeGuia`: esto solo la aplica sobre
// las filas de progreso guardadas en ESTE telefono.

/**
 * Accion de cada guia EJECUTABLE: "Empezar" cuando no hay ejecucion
 * abierta en este telefono, "Continuar · paso N de M" o "Repetir guia"
 * cuando la hay. Una guia sin pasos (un manual, un borrador vacio) NO
 * entra en el mapa: su ausencia es la señal de que no hay recorrido que
 * ofrecer, y quien la pinta cae a "Abrir".
 *
 * Funcion pura para poder probarla sin React ni base local, y para que
 * el catalogo la use con los articulos que ya tiene cargados en vez de
 * abrir otra consulta viva.
 */
export function accionesDeGuia(
  articulos: Articulo[],
  progresos: ProgresoPasos[],
): Map<string, AccionGuia> {
  const avancePorArticulo = new Map(progresos.map((progreso) => [progreso.articuloId, progreso]))
  const mapa = new Map<string, AccionGuia>()
  for (const articulo of articulos) {
    const procedimiento = normalizarProcedimiento(articulo.procedimiento)
    if (!procedimiento || procedimiento.pasos.length === 0) continue
    const avance = avancePorArticulo.get(articulo.id)
    // `hayEjecucionAbierta` es la EXISTENCIA de la fila de progreso, no
    // cuantos pasos tenga marcados (ver `accionDeGuia`).
    mapa.set(articulo.id, accionDeGuia(procedimiento, avance, avance !== undefined))
  }
  return mapa
}

/** La misma tabla, leida en vivo, para quien no tenga ya los articulos. */
export function useAccionesDeGuia(): Map<string, AccionGuia> {
  const articulos = useLiveQuery(() => db.articulos.filter((a) => !a.eliminadoEn).toArray(), [], [])
  const progresos = useLiveQuery(() => db.progresoPasos.toArray(), [], [])
  return useMemo(() => accionesDeGuia(articulos, progresos), [articulos, progresos])
}
