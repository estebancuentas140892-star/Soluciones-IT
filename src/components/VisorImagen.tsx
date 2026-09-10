import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ArrowLeft, ArrowsClockwise, MagnifyingGlassMinus, MagnifyingGlassPlus } from './iconos'

interface Props {
  url: string
  alt: string
  /** Pie de imagen, si lo escribió el autor. Se conserva en el visor. */
  pie?: string | null
  onCerrar: () => void
}

const ESCALA_MIN = 1
const ESCALA_MAX = 4
const ESCALA_DOBLE_TOQUE = 2.5
const PASO_ESCALA = 0.5
const VENTANA_DOBLE_TOQUE_MS = 300

// Visor de imagen a pantalla completa: pellizco para acercar (dos
// dedos), doble toque para alternar zoom, arrastre para desplazarse
// cuando esta ampliada, y CONTROLES VISIBLES para acercar, alejar,
// restablecer y volver. Se cierra con el boton de regreso, con Escape o
// tocando fuera de la imagen.
//
// LOS GESTOS NO SE VEN (encargo del 2026-09-10, tarea 3). Antes solo
// habia una "x" en la esquina: acercar exigia saber de antemano que
// habia pellizco y doble toque, que en un raton no existen, y no habia
// forma de volver al tamaño original salvo adivinar el gesto inverso.
// Ahora cada gesto tiene su boton, y el porcentaje dice donde esta.
//
// EL FOCO VUELVE DE DONDE VINO. Al abrir se recuerda que elemento tenia
// el foco y se le devuelve al cerrar, con la pagina en la misma
// posicion: quien amplia una foto a mitad de un paso vuelve a ese paso,
// no al principio del documento.
//
// Reutilizable desde cualquier imagen de la app (portada de una guia,
// imagenes de un paso o de una tarea, adjuntos heredados, la prueba del
// editor): una sola imagen bien vista puede reemplazar varios parrafos
// de explicacion.
export function VisorImagen({ url, alt, pie = null, onCerrar }: Props) {
  const [escala, setEscala] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const distanciaInicial = useRef(0)
  const escalaInicial = useRef(1)
  const arrastre = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const ultimoToque = useRef(0)
  const contenedor = useRef<HTMLDivElement>(null)

  // ESCAPE CIERRA SOLO EL VISOR. Va en fase de captura y detiene la
  // propagacion: la vista previa del editor tambien escucha Escape en
  // `document`, asi que sin esto una sola pulsacion cerraba el visor Y
  // la prueba entera, que es justo lo que el encargo pide evitar ("sin
  // sacar al usuario de la guia").
  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      evento.stopPropagation()
      onCerrar()
    }
    document.addEventListener('keydown', alTeclado, true)
    return () => document.removeEventListener('keydown', alTeclado, true)
  }, [onCerrar])

  // El foco y la posicion de la pagina, guardados al abrir y devueltos
  // al cerrar. `document.body.style.overflow` evita que el fondo se
  // desplace detras del visor; restaurarlo puede mover el scroll en
  // algunos navegadores, asi que tambien se repone.
  useEffect(() => {
    const origen = document.activeElement
    const scrollPrevio = window.scrollY
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    contenedor.current?.focus()
    return () => {
      document.body.style.overflow = overflowPrevio
      window.scrollTo({ top: scrollPrevio })
      if (origen instanceof HTMLElement) origen.focus({ preventScroll: true })
    }
  }, [])

  function distancia(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function fijarEscala(nueva: number) {
    const limitada = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, nueva))
    setEscala(limitada)
    // Al tamaño original la imagen vuelve al centro: dejarla desplazada
    // la sacaria de la pantalla sin nada que arrastrar.
    if (limitada <= ESCALA_MIN) setPos({ x: 0, y: 0 })
  }

  function restablecer() {
    setEscala(1)
    setPos({ x: 0, y: 0 })
  }

  function alternarZoom() {
    if (escala > 1) restablecer()
    else setEscala(ESCALA_DOBLE_TOQUE)
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
    if (escala <= ESCALA_MIN) restablecer()
  }

  const porcentaje = Math.round(escala * 100)

  return (
    <div
      ref={contenedor}
      role="dialog"
      aria-modal="true"
      aria-label={`Imagen ampliada: ${alt}`}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex touch-none flex-col bg-black/95 outline-none"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar()
      }}
    >
      {/* Volver, y el tamaño actual. El regreso va donde va siempre el
          regreso, arriba a la izquierda, y con su palabra: una "x"
          suelta no dice a dónde lleva. */}
      <div className="flex flex-none items-center justify-between gap-2 px-3 pt-[calc(10px+env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onCerrar}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-[14px] font-medium text-white hover:bg-white/10"
        >
          <ArrowLeft size={18} className="shrink-0" aria-hidden />
          Volver
        </button>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium tabular-nums text-white">
          {porcentaje}%
        </span>
      </div>

      {/* La imagen COMPLETA, sin recorte: la ficha puede recortar la
          portada para que quepa, pero el visor está justamente para
          verla entera. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
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
          className={`max-h-full max-w-full select-none object-contain ${
            escala > 1 ? 'cursor-grab' : 'cursor-zoom-in'
          }`}
        />
      </div>

      <div className="flex flex-none flex-col gap-2 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2">
        {/* El pie de imagen viaja con ella: es lo que explica qué se
            está mirando. */}
        {pie && <p className="text-center text-[13px] leading-snug text-white/80 text-pretty">{pie}</p>}
        <div className="flex items-center justify-center gap-2">
          <BotonVisor
            etiqueta="Alejar la imagen"
            deshabilitado={escala <= ESCALA_MIN}
            onClick={() => fijarEscala(escala - PASO_ESCALA)}
          >
            <MagnifyingGlassMinus size={20} aria-hidden />
          </BotonVisor>
          <BotonVisor
            etiqueta="Restablecer el tamaño original"
            deshabilitado={escala === ESCALA_MIN && pos.x === 0 && pos.y === 0}
            onClick={restablecer}
          >
            <ArrowsClockwise size={19} aria-hidden />
          </BotonVisor>
          <BotonVisor
            etiqueta="Acercar la imagen"
            deshabilitado={escala >= ESCALA_MAX}
            onClick={() => fijarEscala(escala + PASO_ESCALA)}
          >
            <MagnifyingGlassPlus size={20} aria-hidden />
          </BotonVisor>
        </div>
      </div>
    </div>
  )
}

// Control de 52 px del visor: sobre una imagen cualquiera hace falta
// contraste propio, así que va en blanco sobre un fondo translúcido y
// no hereda los colores de la app.
function BotonVisor({
  etiqueta,
  onClick,
  deshabilitado,
  children,
}: {
  etiqueta: string
  onClick: () => void
  deshabilitado?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white hover:bg-white/20 disabled:opacity-35"
    >
      {children}
    </button>
  )
}

/**
 * Una imagen que se puede AMPLIAR, con la invitación a la vista.
 *
 * Es la pieza que el encargo del 2026-09-10 (tarea 3) pide reutilizar
 * en todas las imágenes de una guía: la portada, las de un paso, las de
 * una tarea, los adjuntos heredados y la prueba del editor. Antes cada
 * sitio decidía por su cuenta, así que unas se ampliaban y otras no, y
 * ninguna lo decía.
 *
 * La miniatura puede ir recortada (`className` manda); el visor abre
 * SIEMPRE la misma URL, que es el archivo original de Storage, no una
 * miniatura estirada.
 */
export function ImagenAmpliable({
  url,
  alt,
  pie = null,
  className = '',
  claseBoton = '',
  etiqueta = 'Toca para ampliar',
}: {
  url: string
  alt: string
  pie?: string | null
  /** Clases de la miniatura (el recorte y el alto los decide quien la usa). */
  className?: string
  /** Clases del contenedor tocable. */
  claseBoton?: string
  etiqueta?: string
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-label={`Ampliar la imagen: ${alt}`}
        className={`relative block w-full cursor-zoom-in overflow-hidden rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent ${claseBoton}`}
      >
        <img src={url} alt={alt} className={className} />
        {/* LA INVITACIÓN, VISIBLE (encargo del 2026-09-10, tarea 3).
            Sin ella, poder ampliar equivale a no poder: nadie toca una
            imagen que no promete nada. */}
        <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white">
          <MagnifyingGlassPlus size={13} aria-hidden />
          {etiqueta}
        </span>
      </button>
      {abierto && <VisorImagen url={url} alt={alt} pie={pie} onCerrar={() => setAbierto(false)} />}
    </>
  )
}
