import { useSyncExternalStore } from 'react'
import {
  descargarTodoOffline,
  obtenerProgresoDescarga,
  suscribirProgresoDescarga,
} from '../lib/adjuntosOffline'
import { DownloadSimple } from './iconos'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

// Deja en el telefono el contenido real de todos los adjuntos (fotos,
// manuales) antes de salir a un mantenimiento sin señal. Sin esto,
// solo los datos y el texto quedan garantizados offline; los
// adjuntos dependen de haberse visto antes (ver adjuntosOffline.ts).
export function DescargarOffline() {
  const progreso = useSyncExternalStore(suscribirProgresoDescarga, obtenerProgresoDescarga)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <DownloadSimple size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
          <div>
            <p className="text-[13.5px] font-medium text-noct-text">Descargar todo para offline</p>
            <p className="text-[11.5px] text-noct-neutral-500">
              Fotos y manuales listos antes de salir sin señal
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void descargarTodoOffline()}
          disabled={progreso.enCurso}
          className="shrink-0 rounded-lg border border-noct-divider px-3 py-1.5 text-[12.5px] text-noct-neutral-300 disabled:opacity-50"
        >
          {progreso.enCurso ? 'Descargando...' : 'Descargar'}
        </button>
      </div>

      {progreso.enCurso && (
        <p className="text-[12px] text-noct-neutral-400">
          {progreso.completados + progreso.fallidos} de {progreso.total}
        </p>
      )}
      {!progreso.enCurso && progreso.fallidos > 0 && (
        <p className="text-[12px] text-noct-precaucion">
          {progreso.fallidos} adjunto{progreso.fallidos === 1 ? '' : 's'} no se pudo descargar. Intenta de
          nuevo con mejor señal.
        </p>
      )}
      {!progreso.enCurso && progreso.ultimaDescarga && progreso.fallidos === 0 && (
        <p className="text-[12px] text-noct-neutral-500">
          Última descarga: {formateadorFecha.format(new Date(progreso.ultimaDescarga))}
        </p>
      )}
    </div>
  )
}
