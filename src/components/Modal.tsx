import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  abierto: boolean
  onCerrar: () => void
  // id del titulo dentro del contenido, para accesibilidad.
  tituloId?: string
  /**
   * `hoja` (tarea 339): la de `HojaInferior`. En el teléfono es la misma
   * hoja de abajo de siempre; desde 768 px, un panel lateral derecho de
   * alto completo (420, 440 desde 1280 y 480 desde 1680) sobre un velo,
   * sin relleno propio: la cabecera y el cuerpo los pone la hoja.
   */
  variante?: 'dialogo' | 'hoja'
  children: ReactNode
}

// El panel lateral desde 768 px (tarea 339, handoff de tableta y escritorio):
// la consulta se abre al costado y la pantalla sigue a la vista detrás. El
// velo es más tenue que el del diálogo y sin desenfoque (en el claro, la
// tinta al 30 %), y la sombra del panel es la del sistema en cada tema.
const VELO_PANEL =
  'md:items-stretch md:justify-end md:bg-black/[.58] md:p-0 md:backdrop-blur-none md:[:root[data-tema=claro]_&]:bg-noct-text/30'
const PANEL =
  'md:flex md:h-full md:max-h-none md:w-[420px] md:max-w-none md:flex-col md:overflow-hidden md:rounded-none md:border-y-0 md:border-r-0 md:p-0 md:shadow-[var(--shadow-noct-panel)] xl:w-[440px] 3xl:w-[480px]'

// Ventana modal centrada con el fondo oscurecido. Se cierra con la
// tecla Escape o tocando fuera de la tarjeta. En movil aparece como
// hoja inferior; en pantallas grandes queda centrada. Reutilizable
// para confirmaciones y otros dialogos.
export function Modal({ abierto, onCerrar, tituloId, variante = 'dialogo', children }: Props) {
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
      className={`nocturne fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 font-inter backdrop-blur-sm sm:items-center ${variante === 'hoja' ? VELO_PANEL : ''}`}
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(evento) => evento.stopPropagation()}
        className={`max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-noct-divider bg-noct-surface p-5 text-noct-text shadow-2xl ${variante === 'hoja' ? PANEL : ''}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
