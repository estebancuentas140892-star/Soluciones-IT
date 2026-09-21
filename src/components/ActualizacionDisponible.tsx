import { useEffect, useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  activarYRecargar,
  anotarRegistro,
  anotarVersionNueva,
  estadoActualizacion,
  suscribirActualizacion,
} from '../lib/actualizacionApp'
import { AvisoActualizacion } from './AvisoActualizacion'

// Enchufe entre la librería del service worker y el resto de la app.
// Aquí solo queda el cableado: cuándo se comprueba vive en
// `actualizacionApp.ts`, y el aviso con su botón en `AvisoActualizacion`
// (separados para poder probarlos sin el módulo virtual del plugin PWA).
//
// Se monta siempre; no dibuja nada mientras no haya novedad.
export function ActualizacionDisponible() {
  const {
    needRefresh: [necesitaActualizar],
    updateServiceWorker,
  } = useRegisterSW({
    // COMPROBAR YA, NO DENTRO DE UNA HORA (encargo del 2026-09-20). El
    // intervalo de respaldo, los dos disparadores nuevos (volver a la
    // app y recuperar la conexión) y el freno entre comprobaciones viven
    // en `actualizacionApp.ts`, que ademas los instala UNA sola vez
    // aunque este componente se vuelva a montar.
    onRegisteredSW(_url, registro) {
      anotarRegistro(registro ?? null)
    },
  })

  // Que haya version esperando lo sabe la libreria; se comparte para que
  // "Buscar actualizacion" de Mas pueda decir si hay algo o no.
  useEffect(() => {
    anotarVersionNueva(necesitaActualizar)
  }, [necesitaActualizar])

  // El aviso sale también cuando lo descubre una comprobación nuestra
  // (fase 'disponible'): `needRefresh` solo se enciende si el evento de
  // la librería llega, y con la PWA instalada el worker puede quedar en
  // espera sin que ese evento se vea en esta ventana.
  const estado = useSyncExternalStore(suscribirActualizacion, estadoActualizacion, estadoActualizacion)
  const visible = necesitaActualizar || estado.fase === 'disponible'

  return (
    <AvisoActualizacion visible={visible} onActualizar={() => activarYRecargar(updateServiceWorker)} />
  )
}
