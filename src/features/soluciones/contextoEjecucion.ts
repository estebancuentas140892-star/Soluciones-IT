import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useMemo } from 'react'
import { db } from '../../lib/db'
import {
  avanceDe,
  esVistaPrevia,
  raizDe,
  type AvanceProcedimiento,
  type ClaveProgreso,
} from '../../lib/progresoPasos'

// LA EJECUCION EN CURSO, PARA TODO LO QUE CUELGA DE ELLA (encargo del
// 2026-09-09, tarea 2).
//
// El problema que resuelve: una guia vinculada se ejecuta con los
// MISMOS componentes que la principal (ProcedimientoVista y
// AsistenteVista se anidan a si mismos), asi que el nivel anidado no
// tenia forma de saber a que ejecucion pertenecia su avance y lo
// guardaba en la fila del articulo vinculado, compartida con cualquier
// otra guia que lo reutilizara y con la ficha del propio vinculado.
//
// Va por contexto y no por prop porque entre el nivel 0 y el nivel
// anidado hay tres componentes intermedios que no tienen nada que ver
// con el progreso (la fila del vinculo, el bloque de la tarea, el
// render que decide como se ejecuta un vinculo en linea). Pasarles un
// dato que no usan seria acoplarlos a esto.
export interface Ejecucion {
  // Articulo cuya fila de `progresoPasos` guarda esta ejecucion. Es el
  // de la guia principal; en la vista previa del editor es el id
  // efimero, para que probar no toque el progreso real.
  raizId: string
}

export const ContextoEjecucion = createContext<Ejecucion | null>(null)

export function useEjecucion(): Ejecucion | null {
  return useContext(ContextoEjecucion)
}

/**
 * Donde guarda su avance un procedimiento que se esta ejecutando.
 *
 * Nivel 0 es la guia principal: su propia fila. Cualquier nivel
 * anidado es un VINCULO de esa ejecucion, y su avance vive dentro de
 * ella, no en la fila del articulo vinculado.
 *
 * Sin ejecucion alrededor (una guia abierta por su cuenta) manda su
 * propio id, que es el avance independiente que la tarea 2 pide
 * conservar.
 */
export function claveEn(
  ejecucion: Ejecucion | null,
  articuloId: string,
  nivel: number,
): ClaveProgreso {
  if (!ejecucion) return articuloId
  if (nivel <= 0) return ejecucion.raizId
  return { raizId: ejecucion.raizId, vinculoId: articuloId }
}

export function useClaveProgreso(articuloId: string, nivel: number): ClaveProgreso {
  const ejecucion = useEjecucion()
  return useMemo(() => claveEn(ejecucion, articuloId, nivel), [ejecucion, articuloId, nivel])
}

/**
 * La clave del avance de una guia VINCULADA desde la ejecucion en
 * curso, para las filas que muestran su anillo de avance y para
 * reiniciarla al terminarla.
 */
export function claveDeVinculo(claveActual: ClaveProgreso, guiaId: string): ClaveProgreso {
  return { raizId: raizDe(claveActual), vinculoId: guiaId }
}

export function useClaveVinculo(guiaId: string): ClaveProgreso {
  const ejecucion = useEjecucion()
  return useMemo(
    () => (ejecucion ? { raizId: ejecucion.raizId, vinculoId: guiaId } : guiaId),
    [ejecucion, guiaId],
  )
}

/**
 * El avance guardado para una clave, en vivo. Lee SIEMPRE la fila raiz
 * y se queda con la parte que le toca: un vinculo sin entrada devuelve
 * undefined, nunca lo que esa guia lleve hecho por su cuenta.
 */
export function useAvanceProgreso(clave: ClaveProgreso | null): AvanceProcedimiento | undefined {
  const raiz = clave === null ? null : raizDe(clave)
  const fila = useLiveQuery(
    async () => (raiz === null ? undefined : await db.progresoPasos.get(raiz)),
    [raiz],
  )
  return clave === null ? undefined : avanceDe(fila, clave)
}

/**
 * ¿Lo que se esta ejecutando es la PRUEBA del editor? Los vinculos que
 * salen de la pantalla no se ofrecen ahi: sacarian al autor de su
 * prueba y del editor, y lo que hiciera fuera no contaria para la
 * prueba (encargo del 2026-09-09).
 */
export function useEnVistaPrevia(): boolean {
  const ejecucion = useEjecucion()
  return ejecucion !== null && esVistaPrevia(ejecucion.raizId)
}
