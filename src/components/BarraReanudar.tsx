import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Articulo } from '../lib/db'
import { colorIconoDeTipo, iconoDeTipo } from '../features/soluciones/iconosSoluciones'
import { IndicadorAvance } from './IndicadorAvance'
import { Play, X } from './iconos'

interface Props {
  articulo: Articulo
  hechos: number
  total: number
  minutosRestantes: number | null
  onDescartar: () => void
}

// Distancia de arrastre horizontal que cuenta como descarte (tarea 186,
// mockup 4e). Por debajo del umbral la barra vuelve a su sitio: un roce
// al pasar el dedo hacia otra pestaña no debe descartarla por accidente.
const UMBRAL_DESCARTE_PX = 90

// Movimiento minimo antes de considerar que hay un arrastre real (y
// recien ahi capturar el puntero). Por debajo de esto es un toque: al
// boton "X" o al enlace "Seguir" les debe llegar su click normal, y
// `setPointerCapture` desde el primer pixel se lo habria comido (el
// puntero soltado quedaba retargeteado al contenedor en vez de al
// elemento que el dedo realmente toco).
const UMBRAL_INICIO_ARRASTRE_PX = 6

// Barra flotante que seria el procedimiento a medias mas reciente por
// toda la app (montada desde Chasis, solo en modo seccion/documento: ver
// R19, la tarea ya tiene su propia BarraTarea y no necesita esta ademas).
// Caso real que la motiva: estar en el paso 3 de un mantenimiento y salir
// a la Boveda a buscar una clave, sin perder el hilo de vuelta.
//
// Se descarta deslizando (arrastre horizontal, con el boton "X" como
// alternativa sin gesto) y el propio Chasis, via useReanudar, deja el
// punto en la pestaña Guias mientras el descarte siga vigente para este
// articulo.
export function BarraReanudar({ articulo, hechos, total, minutosRestantes, onDescartar }: Props) {
  const [dx, setDx] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const inicioX = useRef(0)
  const capturado = useRef(false)

  function alBajarPuntero(evento: ReactPointerEvent<HTMLDivElement>) {
    inicioX.current = evento.clientX
    capturado.current = false
  }

  function alMoverPuntero(evento: ReactPointerEvent<HTMLDivElement>) {
    if (evento.buttons === 0) return
    const delta = evento.clientX - inicioX.current
    if (!capturado.current) {
      if (Math.abs(delta) < UMBRAL_INICIO_ARRASTRE_PX) return
      capturado.current = true
      setArrastrando(true)
      // Algunos navegadores (y cualquier puntero sintetico, como el de
      // las pruebas) pueden rechazar la captura; sin ella el arrastre
      // sigue funcionando igual mientras el dedo no salga del elemento.
      try {
        evento.currentTarget.setPointerCapture(evento.pointerId)
      } catch {
        // sin capturar: el gesto sigue, solo se pierde si el dedo sale del area.
      }
    }
    setDx(delta)
  }

  function alSoltarPuntero() {
    if (!capturado.current) return
    capturado.current = false
    setArrastrando(false)
    if (Math.abs(dx) > UMBRAL_DESCARTE_PX) {
      onDescartar()
    } else {
      setDx(0)
    }
  }

  const Icono = iconoDeTipo(articulo.tipo)
  const opacidad = Math.max(0, 1 - Math.abs(dx) / 220)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom)+8px)] z-30 flex justify-center px-3 font-inter lg:bottom-4 lg:px-0">
      <div
        onPointerDown={alBajarPuntero}
        onPointerMove={alMoverPuntero}
        onPointerUp={alSoltarPuntero}
        onPointerCancel={alSoltarPuntero}
        style={{
          transform: `translateX(${dx}px)`,
          opacity: opacidad,
          transition: arrastrando ? 'none' : 'transform 150ms ease, opacity 150ms ease',
        }}
        className="pointer-events-auto flex w-full max-w-md touch-pan-y items-center gap-1.5 rounded-xl border border-noct-accent/40 bg-noct-surface/95 py-2 pl-2.5 pr-2 shadow-lg backdrop-blur-[12px] sm:max-w-xl md:max-w-3xl lg:max-w-[380px]"
      >
        <Link
          to={`/soluciones/${articulo.categoriaId}/${articulo.id}/ejecutar`}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-noct-text"
        >
          <IndicadorAvance hechos={hechos} total={total} size={30} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-[1.25]">{articulo.titulo}</span>
            <span className="mt-0.5 block truncate text-[11.5px] text-noct-neutral-400">
              <Icono size={11} className={`mr-1 inline-block align-[-1px] ${colorIconoDeTipo(articulo.tipo)}`} aria-hidden />
              Paso {hechos + 1} de {total}
              {minutosRestantes != null && ` · ~${minutosRestantes} min`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-md border border-noct-accent px-2 py-1 text-[11.5px] font-medium text-noct-accent">
            <Play size={11} aria-hidden />
            Seguir
          </span>
        </Link>
        <button
          type="button"
          onClick={onDescartar}
          aria-label={`Descartar el aviso para continuar "${articulo.titulo}"`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-noct-neutral-500 hover:bg-noct-text/[.08] hover:text-noct-text"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
