import { useSyncExternalStore } from 'react'
import { obtenerEstadoSync, sincronizar, suscribirSync } from '../lib/sync'

// Punto de estado en la cabecera: responde de un vistazo la pregunta
// "¿ya se subió lo que cambié?". Tocarlo fuerza una sincronización.

function suscribirRed(escucha: () => void): () => void {
  window.addEventListener('online', escucha)
  window.addEventListener('offline', escucha)
  return () => {
    window.removeEventListener('online', escucha)
    window.removeEventListener('offline', escucha)
  }
}

export function IndicadorSync() {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const enLinea = useSyncExternalStore(suscribirRed, () => navigator.onLine)

  let color = 'bg-emerald-400'
  let texto = estado.tiempoReal ? 'Sincronizado en tiempo real' : 'Sincronizado'
  if (!enLinea) {
    color = 'bg-slate-500'
    texto = estado.cambiosPendientes > 0
      ? `Sin conexión · ${estado.cambiosPendientes} cambio(s) por subir`
      : 'Sin conexión'
  } else if (estado.cambiosConError > 0) {
    color = 'bg-red-500'
    texto = `${estado.cambiosConError} cambio(s) con error de sincronización`
  } else if (estado.enCurso) {
    color = 'bg-amber-400'
    texto = 'Sincronizando...'
  } else if (estado.cambiosPendientes > 0) {
    color = 'bg-amber-400'
    texto = `${estado.cambiosPendientes} cambio(s) por subir`
  }

  return (
    <button
      type="button"
      onClick={() => void sincronizar()}
      title={`${texto}. Tocar para sincronizar ahora.`}
      aria-label={texto}
      className="flex items-center gap-1.5 rounded-lg px-1 py-1"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${color} ${estado.enCurso ? 'animate-pulse' : ''}`} />
      {estado.cambiosPendientes > 0 && (
        <span className="text-[10px] text-slate-400">{estado.cambiosPendientes}</span>
      )}
    </button>
  )
}
