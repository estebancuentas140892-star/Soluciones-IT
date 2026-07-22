import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  abierto: boolean
  onCerrar: () => void
  // id del titulo dentro del contenido, para accesibilidad.
  tituloId?: string
  children: ReactNode
}

// Ventana modal centrada con el fondo oscurecido. Se cierra con la
// tecla Escape o tocando fuera de la tarjeta. En movil aparece como
// hoja inferior; en pantallas grandes queda centrada. Reutilizable
// para confirmaciones y otros dialogos.
export function Modal({ abierto, onCerrar, tituloId, children }: Props) {
  useEffect(() => {
    if (!abierto) return
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclado)
    // Evita que el fondo se desplace mientras el modal esta abierto.
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  // Va SIEMPRE colgado de <body> mediante un portal, nunca donde lo
  // escribio quien lo usa. Motivo (bug reportado por el usuario el
  // 2026-07-21): `position: fixed` no se resuelve contra el viewport si
  // algun ancestro crea un bloque contenedor, y `backdrop-filter` lo
  // crea igual que `transform` o `filter`. El panel de sincronizacion se
  // abre desde la pastilla de la cabecera, que lleva
  // `backdrop-blur-[12px]`, asi que `inset-0` se resolvia contra esa
  // cabecera de 166px en vez de contra la pantalla: la tarjeta quedaba
  // anclada abajo de esa franja y crecia hacia ARRIBA, dejando 480px
  // fuera de la pantalla y solo un trozo inferior visible.
  //
  // El `max-h` de mas abajo (tarea 118) no bastaba: limitaba el alto,
  // pero el problema era el origen de coordenadas, no el tamaño. El
  // portal lo corrige de raiz y para todos los usos del componente
  // (tambien DialogoEliminar), incluidos los que aparezcan despues
  // dentro de cualquier cabecera con desenfoque.
  return createPortal(
    <div
      className="nocturne fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 font-inter backdrop-blur-sm sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(evento) => evento.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-noct-divider bg-noct-surface p-5 text-noct-text shadow-2xl"
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
