import { useId, type ReactNode } from 'react'
import { X } from './iconos'
import { Modal } from './Modal'

// HOJA INFERIOR PARA CONSULTAR (rediseño móvil "1b Pulgar", tareas 328 y
// 329, AD-078 y AD-079). "Hoja para consultar, pantalla para trabajar": lo
// que se mira sin dejar la pantalla (los datos de un equipo, sus conexiones,
// sus adjuntos, la credencial de una acción) se abre aquí, encima, y al
// cerrarla todo sigue donde estaba. Se apoya en `Modal`, que en el teléfono
// ya se ancla abajo, y le añade la cabecera de siempre: de qué es (12 px),
// el título y una X de 44 px. Una sola hoja a la vez: quien la usa guarda
// cuál está abierta.
export function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  contexto,
  etiquetaCerrar = 'Cerrar',
  children,
}: {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  /** De qué es la hoja ("POSPN01"), en una línea pequeña sobre el título. */
  contexto?: string
  /** El nombre accesible de la X ("Cerrar y volver a la guía"). */
  etiquetaCerrar?: string
  children: ReactNode
}) {
  const idTitulo = useId()
  return (
    <Modal abierto={abierta} onCerrar={onCerrar} tituloId={idTitulo}>
      <div className="mb-2 flex items-start gap-2">
        {/* Desde 768 px (tarea 338) la letra de los diálogos de antes del
            rediseño móvil: título a 16 px, contexto a 11 px. */}
        <div className="min-w-0 flex-1 pt-1.5">
          {contexto && <p className="text-[12px] leading-snug text-noct-neutral-500 [overflow-wrap:anywhere] md:text-[11px]">{contexto}</p>}
          <h2 id={idTitulo} className="text-[17px] font-semibold leading-snug [overflow-wrap:anywhere] md:text-base">
            {titulo}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label={etiquetaCerrar}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
        >
          <X size={19} aria-hidden />
        </button>
      </div>
      {children}
    </Modal>
  )
}
