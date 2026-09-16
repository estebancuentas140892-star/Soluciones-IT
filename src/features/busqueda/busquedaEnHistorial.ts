import { useCallback, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import {
  anotarBusqueda,
  leerBusquedaRestaurada,
  sinBusqueda,
  type BusquedaEnCurso,
} from '../../lib/origenNavegacion'

// LA BÚSQUEDA SOBREVIVE AL SALTO A UNA FICHA (encargo del 2026-09-16,
// sección 13). Las dos mitades del mecanismo, cada una en un hook:
//
//   - quien SALE desde un resultado anota la búsqueda en su propia
//     entrada del historial (`useAnotarBusqueda`), justo antes de saltar;
//   - quien LLEGA la lee (`useBusquedaRestaurada`), venga por el regreso
//     de la app (que la trae en su `state`, ver `estadoDeRegreso`) o por
//     el botón atrás del teléfono (que vuelve a la entrada anotada).
//
// Todo vive en `location.state`: sin URL, sin localStorage, y se pierde
// con la pestaña. Ver src/lib/origenNavegacion.ts.

/**
 * Devuelve la función que anota la búsqueda en la entrada ACTUAL del
 * historial. Se llama en el mismo gesto que el salto, antes de él.
 */
export function useAnotarBusqueda(): (busqueda: BusquedaEnCurso) => void {
  const location = useLocation()
  const navigate = useNavigate()
  return useCallback(
    (busqueda: BusquedaEnCurso) => {
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: anotarBusqueda(location.state, busqueda) },
      )
    },
    [location, navigate],
  )
}

export interface BusquedaRestaurada {
  /** La búsqueda que trae la llegada a esta entrada del historial, o null. */
  restaurada: BusquedaEnCurso | null
  /**
   * Identifica la LLEGADA que la trajo. Cambia en cada navegación que
   * lleva a una entrada (ir o volver), aunque la pantalla no se vuelva a
   * montar: de un equipo a otro equipo React reutiliza la misma pantalla,
   * y volver al primero tiene que reponer igual.
   */
  llegada: string
  /**
   * Borra la búsqueda de la entrada del historial cuando el técnico la da
   * por terminada (cierra la capa, vacía el campo): sin esto, volver más
   * tarde a esta entrada reabriría una búsqueda que ya se había cerrado a
   * propósito.
   */
  descartar: () => void
}

export function useBusquedaRestaurada(): BusquedaRestaurada {
  const location = useLocation()
  const tipo = useNavigationType()
  const navigate = useNavigate()
  const [lectura, setLectura] = useState(() => ({
    llegada: location.key,
    restaurada: leerBusquedaRestaurada(location.state),
  }))

  // Se relee al LLEGAR a una entrada (PUSH o POP), no al reescribir la
  // actual (REPLACE): anotar o descartar la búsqueda de esta misma
  // pantalla no es llegar a ningún sitio, y releerla reabriría lo que se
  // acaba de cerrar.
  if (lectura.llegada !== location.key && tipo !== 'REPLACE') {
    setLectura({ llegada: location.key, restaurada: leerBusquedaRestaurada(location.state) })
  }

  const descartar = useCallback(() => {
    if (!leerBusquedaRestaurada(location.state)) return
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: sinBusqueda(location.state) },
    )
  }, [location, navigate])

  return { restaurada: lectura.restaurada, llegada: lectura.llegada, descartar }
}
