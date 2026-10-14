import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { QrCode } from './iconos'
import { PEGADA_SOBRE_PESTANAS } from './nocturne'
import { useAltoDelTeclado } from './useAltoDelTeclado'

// EL DOCK DE BÚSQUEDA (rediseño móvil "1b Pulgar", tarea 330, AD-080).
// En las raíces Resolver, Equipos y Bóveda el buscador baja al pulgar:
// pegado sobre la barra de pestañas, el campo de 52 px y, al lado, el
// escáner de 52 px. Es el MISMO buscador de cada pantalla (su alcance, su
// etiqueta y su lógica no cambian); solo cambia dónde está. Sustituye al
// campo de arriba (regla M-R8: un buscador por pantalla).
//
// Con el teclado abierto el dock sube con él: `visualViewport` dice cuánto
// tapa el teclado (en iOS no encoge la página) y el dock se pega justo
// encima. Donde el navegador ya encoge la página (Android), el teclado no
// tapa nada y el dock sigue sobre las pestañas. Desplazar la lista con el
// dedo cierra el teclado: se está mirando lo encontrado, no escribiendo.
export function DockBusqueda({ children, conEscaner = true }: { children: ReactNode; conEscaner?: boolean }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const teclado = useAltoDelTeclado()

  useEffect(() => {
    function alArrastrar(evento: TouchEvent) {
      const activo = document.activeElement
      if (!(activo instanceof HTMLElement) || !contenedor.current?.contains(activo)) return
      // Arrastrar sobre el propio dock no cuenta: es el campo que se usa.
      if (evento.target instanceof Node && contenedor.current.contains(evento.target)) return
      activo.blur()
    }
    window.addEventListener('touchmove', alArrastrar, { passive: true })
    return () => window.removeEventListener('touchmove', alArrastrar)
  }, [])

  return (
    <div
      ref={contenedor}
      data-dock-busqueda
      // Con el teclado abierto el `bottom` sale de la medida, no del alto
      // de las pestañas (que quedan debajo del teclado).
      style={teclado > 0 ? { bottom: teclado } : undefined}
      className={`sticky ${PEGADA_SOBRE_PESTANAS} z-10 mt-auto flex items-center gap-2 bg-noct-bg/[.94] px-3 pb-2.5 pt-2 backdrop-blur-[12px]`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {conEscaner && (
        <Link
          to="/escaner"
          aria-label="Escanear QR"
          title="Escanear QR"
          className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-noct-text/25 bg-noct-surface text-noct-text hover:bg-noct-text/[.06]"
        >
          <QrCode size={22} className="shrink-0" aria-hidden />
        </Link>
      )}
    </div>
  )
}
