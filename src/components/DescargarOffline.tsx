import { useSyncExternalStore } from 'react'
import {
  descargarTodoOffline,
  obtenerProgresoDescarga,
  suscribirProgresoDescarga,
} from '../lib/adjuntosOffline'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

// Deja en el telefono el contenido real de todos los adjuntos (fotos,
// manuales) antes de salir a un mantenimiento sin señal. Sin esto,
// solo los datos y el texto quedan garantizados offline; los
// adjuntos dependen de haberse visto antes (ver adjuntosOffline.ts).
export function DescargarOffline() {
  const progreso = useSyncExternalStore(suscribirProgresoDescarga, obtenerProgresoDescarga)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Descargar todo para offline</p>
          <p className="text-xs text-slate-500">Fotos y manuales listos antes de salir sin señal</p>
        </div>
        <button
          type="button"
          onClick={() => void descargarTodoOffline()}
          disabled={progreso.enCurso}
          className="shrink-0 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-50"
        >
          {progreso.enCurso ? 'Descargando...' : 'Descargar'}
        </button>
      </div>

      {progreso.enCurso && (
        <p className="text-xs text-slate-400">
          {progreso.completados + progreso.fallidos} de {progreso.total}
        </p>
      )}
      {!progreso.enCurso && progreso.fallidos > 0 && (
        <p className="text-xs text-amber-400">
          {progreso.fallidos} adjunto{progreso.fallidos === 1 ? '' : 's'} no se pudo descargar. Intenta de
          nuevo con mejor señal.
        </p>
      )}
      {!progreso.enCurso && progreso.ultimaDescarga && progreso.fallidos === 0 && (
        <p className="text-xs text-slate-500">
          Última descarga: {formateadorFecha.format(new Date(progreso.ultimaDescarga))}
        </p>
      )}
    </div>
  )
}
