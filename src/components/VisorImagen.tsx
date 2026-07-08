import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

interface Props {
  url: string
  alt: string
  onCerrar: () => void
}

const ESCALA_MIN = 1
const ESCALA_MAX = 4
const ESCALA_DOBLE_TOQUE = 2.5
const VENTANA_DOBLE_TOQUE_MS = 300

// Visor de imagen a pantalla completa: pellizco para acercar (dos
// dedos), doble toque para alternar zoom, arrastre para desplazarse
// cuando esta ampliada. Se cierra con Escape, tocando fuera de la
// imagen o el boton de cerrar. Reutilizable desde cualquier galeria de
// adjuntos (pasos de un procedimiento, fichas de articulo y
// dispositivo): una sola imagen bien vista puede reemplazar varios
// parrafos de explicacion.
export function VisorImagen({ url, alt, onCerrar }: Props) {
  const [escala, setEscala] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const distanciaInicial = useRef(0)
  const escalaInicial = useRef(1)
  const arrastre = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const ultimoToque = useRef(0)

  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclado)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.body.style.overflow = overflowPrevio
    }
  }, [onCerrar])

  function distancia(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function alternarZoom() {
    if (escala > 1) {
      setEscala(1)
      setPos({ x: 0, y: 0 })
    } else {
      setEscala(ESCALA_DOBLE_TOQUE)
    }
  }

  function alPresionar(evento: ReactPointerEvent<HTMLImageElement>) {
    // Si el puntero ya no esta activo (gesto interrumpido, evento
    // repetido) setPointerCapture lanza una excepcion: no debe frenar
    // el resto del gesto (zoom o arrastre).
    try {
      evento.currentTarget.setPointerCapture(evento.pointerId)
    } catch {
      // Sin captura el arrastre puede perder el puntero si sale del
      // elemento, pero el gesto sigue funcionando en el caso comun.
    }
    punteros.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY })

    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()]
      distanciaInicial.current = distancia(a, b)
      escalaInicial.current = escala
      arrastre.current = null
      return
    }

    const ahora = Date.now()
    if (ahora - ultimoToque.current < VENTANA_DOBLE_TOQUE_MS) {
      alternarZoom()
      ultimoToque.current = 0
    } else {
      ultimoToque.current = ahora
    }
    if (escala > 1) {
      arrastre.current = { x: evento.clientX, y: evento.clientY, posX: pos.x, posY: pos.y }
    }
  }

  function alMover(evento: ReactPointerEvent<HTMLImageElement>) {
    if (!punteros.current.has(evento.pointerId)) return
    punteros.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY })

    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()]
      if (distanciaInicial.current > 0) {
        const factor = distancia(a, b) / distanciaInicial.current
        setEscala(Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, escalaInicial.current * factor)))
      }
      return
    }

    if (arrastre.current && escala > 1) {
      setPos({
        x: arrastre.current.posX + (evento.clientX - arrastre.current.x),
        y: arrastre.current.posY + (evento.clientY - arrastre.current.y),
      })
    }
  }

  function alSoltar(evento: ReactPointerEvent<HTMLImageElement>) {
    punteros.current.delete(evento.pointerId)
    arrastre.current = null
    if (escala <= ESCALA_MIN) {
      setEscala(1)
      setPos({ x: 0, y: 0 })
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex touch-none items-center justify-center bg-black/95"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar()
      }}
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar imagen"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/80 text-lg text-slate-200"
      >
        ✕
      </button>
      <img
        src={url}
        alt={alt}
        draggable={false}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${escala})`,
          transition: punteros.current.size > 0 ? 'none' : 'transform 0.15s ease-out',
          touchAction: 'none',
        }}
        className="max-h-full max-w-full select-none object-contain"
      />
    </div>
  )
}
