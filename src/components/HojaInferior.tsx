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
//
// DESDE 768 PX, PANEL LATERAL (tarea 339, handoff de tableta y escritorio):
// la misma hoja, con la misma API, se abre al costado derecho (420 px, 440
// desde 1280 y 480 desde 1680) y deja la pantalla a la vista detrás del
// velo. Se cierra igual: la X, Esc o un clic fuera. La cabecera queda fija
// arriba con su línea y el cuerpo se desplaza solo. "Hoja para consultar,
// pantalla para trabajar" no cambia: lo que se trabaja sigue siendo
// pantalla.
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
    <Modal abierto={abierta} onCerrar={onCerrar} tituloId={idTitulo} variante="hoja">
      <div className="mb-2 flex items-start gap-2 md:mb-0 md:min-h-[68px] md:shrink-0 md:items-center md:gap-3 md:border-b md:border-noct-divider md:py-3 md:pl-[22px] md:pr-4">
        <div className="min-w-0 flex-1 pt-1.5 md:pt-0">
          {contexto && <p className="text-[12px] leading-snug text-noct-neutral-500 [overflow-wrap:anywhere]">{contexto}</p>}
          <h2 id={idTitulo} className="text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {titulo}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label={etiquetaCerrar}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text md:m-0 md:rounded-[10px] md:border md:border-noct-divider xl:h-9 xl:w-9"
        >
          <X size={19} aria-hidden />
        </button>
      </div>
      {/* El cuerpo: en el teléfono no añade nada (la hoja entera se
          desplaza); en el panel es lo único que se desplaza. */}
      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:px-[22px] md:py-[18px]">{children}</div>
    </Modal>
  )
}
