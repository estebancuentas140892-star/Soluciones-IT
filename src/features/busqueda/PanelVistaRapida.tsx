import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight, X } from '../../components/iconos'
import { ZONA_ANIDADA } from '../soluciones/vinculoAnidado'
import { ACCION_SECUNDARIA } from './clasesAcciones'
import { useRanuraVistaRapida } from './ranuraVistaRapida'

// EL MARCO DE UNA VISTA RÁPIDA (encargo del 2026-09-16, secciones 2, 7 y
// 9). Se despliega DEBAJO de su resultado, dentro de la lista: no es otra
// capa encima, así que cerrarla no cierra el buscador ni borra la
// consulta, y la lista sigue en el mismo sitio.
//
// La profundidad se dibuja con la sangría de las zonas anidadas de las
// guías (línea neutra de 2 px), no con otro color ni con otra tarjeta: es
// "algo que cuelga de este resultado", el mismo signo que ya se lee así
// dentro de un paso.

export function PanelVistaRapida({
  idPanel,
  titulo,
  onCerrar,
  fichaCompleta,
  children,
}: {
  /** Id del panel, al que apunta el `aria-controls` de quien lo abre. */
  idPanel: string
  /** Nombre de lo que se consulta, para el lector de pantalla. */
  titulo: string
  onCerrar: () => void
  /** Enlace a la ficha en su pantalla. Nunca en modo consulta. */
  fichaCompleta?: { to: string; state?: unknown; onClick?: () => void }
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  // En la columna de la paleta (desde 1280, tarea 339, T6) ya no cuelga de su
  // fila: sin la sangría de lo anidado, ocupa su columna.
  const enColumna = useRanuraVistaRapida() !== null

  // Quien toca "Ver" pierde el botón (la fila recoge sus acciones mientras
  // la vista está abierta): el foco pasa al panel para no quedar suelto,
  // y el panel se asoma entero si nació al borde de la pantalla.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    panel.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  return (
    <div
      ref={panel}
      id={idPanel}
      role="region"
      tabIndex={-1}
      aria-label={`Vista rápida: ${titulo}`}
      className={`flex min-w-0 flex-col outline-none ${enColumna ? 'gap-4' : `mb-2 ml-2 mr-1 mt-0.5 gap-2.5 ${ZONA_ANIDADA}`}`}
    >
      {children}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCerrar}
          aria-label={`Cerrar la vista rápida de "${titulo}"`}
          className={ACCION_SECUNDARIA}
        >
          <X size={16} className="shrink-0" aria-hidden />
          Cerrar
        </button>
        {fichaCompleta && (
          <Link
            to={fichaCompleta.to}
            state={fichaCompleta.state}
            onClick={fichaCompleta.onClick}
            className={ACCION_SECUNDARIA}
          >
            Abrir ficha
            <CaretRight size={14} className="shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  )
}
