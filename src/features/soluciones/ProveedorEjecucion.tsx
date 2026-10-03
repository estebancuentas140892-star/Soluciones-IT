import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../../lib/db'
import { fijarEquipoDeEjecucion } from '../../lib/progresoPasos'
import { esIdDeEquipo } from '../boveda/credencialDelEquipo'
import { ContextoEjecucion } from './contextoEjecucion'

// Abre una ejecucion para todo lo que quede dentro (encargo del
// 2026-09-09, tarea 2): la guia principal y, con ella, el avance de
// todas sus guias vinculadas, que vive en la fila de `raizId` y no en
// la de cada vinculado.
//
// Vive en su propio archivo por la regla de fast refresh: el resto del
// modulo son hooks y funciones puras, y mezclarlos con un componente
// rompe la recarga en caliente del editor.
//
// EL EQUIPO CON EL QUE SE TRABAJA (tarea 290). La ejecucion conserva un
// equipo para que una accion pueda pedir "su credencial". Llega de tres
// sitios, y el ultimo que habla manda:
//
//   1. `equipoInicial`: la direccion con la que se entro (`?equipo=`
//      desde la ficha del equipo o desde Resolver). Es una intencion
//      explicita, asi que pisa al que guardaba la fila.
//   2. La fila de avance (`progresoPasos.equipoId`): retomar sigue con el
//      mismo equipo.
//   3. `fijarEquipo`: el tecnico lo elige o lo cambia en la propia accion.
//
// Elegir un equipo no es avanzar: no crea la fila. Mientras no existe,
// el equipo vive aqui (y en la direccion, `onEquipoElegido`); en cuanto
// la fila aparece, se escribe en ella. Empezar de nuevo estrena fila sin
// equipo, pero el tecnico sigue delante del mismo equipo: se conserva.
export function ProveedorEjecucion({
  raizId,
  equipoInicial = null,
  onEquipoElegido,
  children,
}: {
  raizId: string
  equipoInicial?: string | null
  onEquipoElegido?: (equipoId: string) => void
  children: ReactNode
}) {
  const inicial = esIdDeEquipo(equipoInicial) ? equipoInicial : null
  const fila = useLiveQuery(async () => (await db.progresoPasos.get(raizId)) ?? null, [raizId])
  const guardado = fila?.equipoId ?? null

  // El equipo en memoria, atado a la ejecucion: otra guia en la misma
  // pantalla (otra raiz) empieza con lo suyo.
  const [memoria, setMemoria] = useState<{ raizId: string; equipoId: string | null }>({ raizId, equipoId: inicial })
  if (memoria.raizId !== raizId) setMemoria({ raizId, equipoId: inicial })
  else if (memoria.equipoId === null && guardado !== null) setMemoria({ raizId, equipoId: guardado })
  const equipoId = memoria.raizId === raizId ? (memoria.equipoId ?? guardado) : inicial

  // Lo elegido entra en la fila cuando la fila existe (y solo si cambia).
  useEffect(() => {
    if (equipoId === null || !fila || (fila.equipoId ?? null) === equipoId) return
    void fijarEquipoDeEjecucion(raizId, equipoId)
  }, [equipoId, fila, raizId])

  const fijarEquipo = useCallback(
    (nuevo: string) => {
      if (!esIdDeEquipo(nuevo)) return
      setMemoria({ raizId, equipoId: nuevo })
      onEquipoElegido?.(nuevo)
    },
    [raizId, onEquipoElegido],
  )

  const valor = useMemo(() => ({ raizId, equipoId, fijarEquipo }), [raizId, equipoId, fijarEquipo])
  return <ContextoEjecucion.Provider value={valor}>{children}</ContextoEjecucion.Provider>
}
