import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import { obtenerEstadoSync, sincronizar, suscribirSync } from '../lib/sync'
import { CloudArrowUp, CloudCheck, CloudSlash } from './iconos'

const PanelSync = lazy(() => import('./PanelSync').then((m) => ({ default: m.PanelSync })))

// Estado del dato, la ranura del medio de la barra superior (tarea 181,
// mockup 3d). Vivia dentro de InicioPage, asi que en las otras cuatro
// pestañas no habia forma de saber si lo que se acababa de escribir ya
// habia subido. Ahora acompaña a las cinco (regla R7 aplicada al chasis).
//
// Forma del mockup: pastilla sin borde, alto de toque de 44 px, rotulo
// de 12 px en neutral-300 y el icono llevando el color del estado. Solo
// cuando hay algo que atender el color pasa tambien al texto.
//
// Pendiente en la tarea 187: contraerse a solo icono cuando todo esta al
// dia o cuando el titulo de la seccion es largo.

function suscribirRed(escucha: () => void): () => void {
  window.addEventListener('online', escucha)
  window.addEventListener('offline', escucha)
  return () => {
    window.removeEventListener('online', escucha)
    window.removeEventListener('offline', escucha)
  }
}

export function PastillaSync() {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const enLinea = useSyncExternalStore(suscribirRed, () => navigator.onLine)
  const [panelAbierto, setPanelAbierto] = useState(false)

  let Icono = CloudCheck
  let etiqueta = 'Al día'
  let titulo = 'Sincronizado y disponible sin conexión'
  let claseTexto = 'text-noct-neutral-300'
  let claseIcono = 'text-noct-exito'
  if (!enLinea) {
    Icono = CloudSlash
    etiqueta = 'Sin conexión'
    titulo =
      estado.cambiosPendientes > 0
        ? `Trabajando con la copia local. ${estado.cambiosPendientes} cambio(s) por subir.`
        : 'Trabajando con la copia local'
    claseTexto = 'text-noct-precaucion'
    claseIcono = 'text-noct-precaucion'
  } else if (estado.cambiosConError > 0) {
    Icono = CloudSlash
    etiqueta = 'Con error'
    titulo = `${estado.cambiosConError} cambio(s) con error de sincronización`
    claseTexto = 'text-noct-error'
    claseIcono = 'text-noct-error'
  } else if (estado.enCurso || estado.cambiosPendientes > 0) {
    Icono = CloudArrowUp
    etiqueta = 'Sincronizando'
    titulo = estado.enCurso ? 'Subiendo los cambios' : 'Hay cambios pendientes de subir'
    claseTexto = 'text-noct-precaucion'
    claseIcono = 'text-noct-precaucion'
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void sincronizar()
          setPanelAbierto(true)
        }}
        title={`${titulo}. Tocar para ver el detalle y sincronizar ahora.`}
        aria-label={titulo}
        className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium hover:bg-noct-text/[.05] ${claseTexto}`}
      >
        <Icono size={14} className={`${claseIcono} ${estado.enCurso ? 'animate-pulse' : ''}`} aria-hidden />
        {etiqueta}
      </button>
      {panelAbierto && (
        <Suspense fallback={null}>
          <PanelSync abierto={panelAbierto} onCerrar={() => setPanelAbierto(false)} />
        </Suspense>
      )}
    </>
  )
}
