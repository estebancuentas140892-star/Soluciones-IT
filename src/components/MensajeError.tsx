import type { ComponentType, ReactNode } from 'react'
import { Info, WarningCircle, type IconoProps } from './iconos'

// EL MENSAJE DE ERROR (tarea 291, auditoría UX de Claude Design, sección
// 11, S2).
//
// Varios errores decían qué falló pero no qué pasaba con lo hecho: "No se
// pudo subir: foto-1.jpg, foto-2.jpg" no aclaraba si las fotos se habían
// perdido. El modelo es el que ya funcionaba bien en Adjuntos ("el archivo
// quedó guardado en este dispositivo y se subirá solo"), y desde aquí vale
// para todos, en tres partes:
//
// 1. **Qué pasó**, con las palabras del técnico: "No se subieron 2 fotos".
// 2. **Qué se conserva**: "Siguen guardadas en este teléfono…".
// 3. **Qué hacer**, solo si el técnico puede hacer algo ahora: una acción
//    ("Reintentar ahora", "Descargar los 3").
//
// Nunca códigos, nombres de servicios, tablas ni mensajes del servidor, ni
// la palabra "Error". El tono dice cuánto preocupa:
//
// - `atencion` (ámbar): el trabajo está a salvo y se resolverá solo.
// - `bloqueo` (rojo): bloquea o se perdería algo; siempre dice qué hacer.
// - `parcial` (neutro): cuánto salió bien y qué no, con la acción solo
//   sobre lo que falló.
export type TonoMensaje = 'atencion' | 'bloqueo' | 'parcial'

const ESTILO: Record<TonoMensaje, { caja: string; icono: string; Icono: ComponentType<IconoProps> }> = {
  atencion: {
    caja: 'border-noct-precaucion/40 bg-noct-precaucion/[.07]',
    icono: 'text-noct-precaucion',
    Icono: WarningCircle,
  },
  bloqueo: {
    caja: 'border-noct-error/40 bg-noct-error/[.07]',
    icono: 'text-noct-error',
    Icono: WarningCircle,
  },
  parcial: {
    caja: 'border-noct-divider bg-noct-surface',
    icono: 'text-noct-neutral-300',
    Icono: Info,
  },
}

export function MensajeError({
  tono,
  titulo,
  conserva,
  accion,
  Icono,
  className = '',
}: {
  tono: TonoMensaje
  // Qué pasó.
  titulo: ReactNode
  // Qué se conserva (y, si hace falta, qué hacer cuando no hay botón).
  conserva?: ReactNode
  // La acción, a la derecha: un `Boton` de 44.
  accion?: ReactNode
  // Un dibujo que diga la causa mejor que el genérico (sin señal, una
  // descarga).
  Icono?: ComponentType<IconoProps>
  className?: string
}) {
  const estilo = ESTILO[tono]
  const Dibujo = Icono ?? estilo.Icono
  return (
    <div
      role={tono === 'bloqueo' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-[10px] border py-3 pr-3 pl-3.5 ${estilo.caja} ${className}`}
    >
      <Dibujo size={18} className={`mt-0.5 shrink-0 ${estilo.icono}`} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-pretty text-[14.5px] font-medium leading-[1.35] text-noct-text">{titulo}</span>
        {conserva && <span className="text-pretty text-[13px] leading-[1.45] text-noct-neutral-300">{conserva}</span>}
      </span>
      {accion && <span className="shrink-0 self-center">{accion}</span>}
    </div>
  )
}
