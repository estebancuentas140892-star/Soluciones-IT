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
// Adaptativa desde la tarea 187 (mockup 4e): "al dia" no gasta palabras
// en la buena noticia (solo el icono, mismo hueco de 44x44 que el resto
// de botones de la fila) y el resto de estados dicen el numero real
// ("3 sin subir") en vez de un generico "Sincronizando". La franja de
// ancho completo que dibuja el mockup para sin-conexion-con-cambios
// queda deliberadamente fuera de esta tarea: exigiria reestructurar la
// fila de tres ranuras de BarraSuperior para todas las pantallas de
// seccion, un cambio de mayor alcance que el color y el texto.

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

  // Al día no tiene nada que decir: solo el icono, mismo hueco de 44x44
  // que el resto de botones de la fila (regla R23, un aviso solo si hay
  // un dato detrás). El resto de estados dicen el numero real.
  let Icono = CloudCheck
  let etiqueta: string | null = null
  let titulo = 'Sincronizado y disponible sin conexión'
  let claseTexto = 'text-noct-neutral-300'
  let claseIcono = 'text-noct-exito'
  if (!enLinea) {
    Icono = CloudSlash
    etiqueta = estado.cambiosPendientes > 0 ? `Sin conexión · ${estado.cambiosPendientes} sin subir` : 'Sin conexión'
    titulo =
      estado.cambiosPendientes > 0
        ? `Trabajando con la copia local. ${estado.cambiosPendientes} cambio(s) por subir.`
        : 'Trabajando con la copia local'
    claseTexto = 'text-noct-precaucion'
    claseIcono = 'text-noct-precaucion'
  } else if (estado.cambiosConError > 0) {
    Icono = CloudSlash
    etiqueta = `${estado.cambiosConError} con error`
    titulo = `${estado.cambiosConError} cambio(s) con error de sincronización`
    claseTexto = 'text-noct-error'
    claseIcono = 'text-noct-error'
  } else if (estado.enCurso || estado.cambiosPendientes > 0) {
    Icono = CloudArrowUp
    etiqueta = estado.enCurso ? 'Subiendo' : `${estado.cambiosPendientes} sin subir`
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
        className={
          etiqueta === null
            ? `flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-noct-text/[.05] ${claseTexto}`
            : `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium hover:bg-noct-text/[.05] ${claseTexto}`
        }
      >
        <Icono size={etiqueta === null ? 18 : 14} className={`${claseIcono} ${estado.enCurso ? 'animate-pulse' : ''}`} aria-hidden />
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
