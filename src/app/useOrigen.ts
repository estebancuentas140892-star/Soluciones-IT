import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { leerOrigen, type Origen } from '../lib/origenNavegacion'

// De dónde vino el técnico a la pantalla actual, si no vino de su lista
// padre (regla M-R2). Ver el porqué del mecanismo en
// src/lib/origenNavegacion.ts.
//
// El origen se recuerda **por pathname**, no por montaje ni por render,
// y ese matiz es lo único delicado del hook. Los dos casos que hay que
// distinguir:
//
//   (a) Navegar dentro de la MISMA pantalla sin cambiar de ruta: un
//       ancla `#conexiones` de la ficha de equipo, o agregarle una query
//       (`?nuevoCampoProtegido=`). React Router trata un cambio de hash
//       como una navegación nueva **con `state: null`**, así que leer
//       `location.state` en cada render borraría el origen en cuanto el
//       técnico tocara uno de los enlaces internos de la propia ficha.
//       Es el mismo defecto que ya se corrigió en su día con el bloque
//       "¿Qué sigue?" de `DispositivoPage`. Aquí el origen se conserva.
//
//   (b) Pasar de una ficha a otra del MISMO tipo (de un equipo a otro
//       por "Reemplaza a"): React reutiliza la instancia del componente,
//       así que no hay montaje nuevo. Capturar solo al montar dejaría el
//       origen del primer equipo pegado al segundo. Aquí el origen SÍ se
//       relee.
//
// Guardar en una ref y ajustarla en el render es idempotente para la
// misma ruta, así que es seguro con el render doble de StrictMode.
export function useOrigen(): Origen | null {
  const { pathname, state } = useLocation()
  const recordado = useRef<{ pathname: string; origen: Origen | null }>({
    pathname,
    origen: leerOrigen(state),
  })

  if (recordado.current.pathname !== pathname) {
    recordado.current = { pathname, origen: leerOrigen(state) }
  }

  return recordado.current.origen
}
