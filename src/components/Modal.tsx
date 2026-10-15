import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cierraAlSoltar, empiezaArrastre } from './gestoHoja'
import { ANCHO_TABLETA, coincide } from './useEsAncho'

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

// LA HOJA DEL TELÉFONO (tarea 341, remate del handoff móvil "1b Pulgar"):
// por debajo de 768 px el diálogo y la hoja son la misma hoja del handoff,
// pegada al borde de abajo y de lado a lado, con radio 22 arriba, el velo
// del sistema sin desenfoque y la sombra que la separa de la pantalla. Antes
// era una tarjeta flotante a 16 px de los bordes, y desde 640 px se
// centraba. Todo va con `max-md:`, así que desde 768 nada cambia: el diálogo
// sigue centrado y la hoja sigue siendo el panel lateral.
const VELO_TELEFONO = 'max-md:bg-noct-velo max-md:p-0 max-md:backdrop-blur-none'
const HOJA_TELEFONO =
  'max-md:max-h-[88dvh] max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-[22px] max-md:border-0 max-md:px-[18px] max-md:pt-0 max-md:pb-[calc(1.125rem+env(safe-area-inset-bottom))] max-md:shadow-[0_-12px_40px_rgb(0_0_0/0.35)] max-md:overscroll-contain'

// Lo que el tabulador puede alcanzar dentro del diálogo.
const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

// Donde un dedo que baja escribe o elige, no cierra la hoja.
const SIN_ARRASTRE = 'input, textarea, select, [contenteditable="true"]'

function movimientoReducido(): boolean {
  return coincide('(prefers-reduced-motion: reduce)')
}

/**
 * ¿Se anima la salida? Solo en el teléfono, sin "reducir movimiento" y si
 * la hoja tiene caja de verdad: sin maquetación (las pruebas) no hay nada
 * que animar, y el cierre es inmediato como siempre.
 */
function animaLaSalida(caja: HTMLElement | null): boolean {
  return caja !== null && !coincide(ANCHO_TABLETA) && !movimientoReducido() && caja.getBoundingClientRect().height > 0
}

// Ventana modal con el fondo oscurecido. Se cierra con la tecla Escape o
// tocando fuera. En el teléfono es la hoja inferior del handoff (arriba);
// desde 768 px, el diálogo queda centrado y la hoja es el panel lateral.
// Reutilizable para confirmaciones y otros dialogos.
//
// EL FOCO VIVE DENTRO MIENTRAS ESTÁ ABIERTO (tarea 340, hallazgo de la 339;
// el handoff de tableta y escritorio da el panel por "foco atrapado"). Al
// abrir, el foco entra al diálogo (si un campo con `autoFocus` ya lo tomó,
// se respeta); Tab y Mayús+Tab dan la vuelta dentro sin salir a la pantalla
// de detrás del velo; al cerrar vuelve a lo que lo abrió, si sigue en la
// página. Con dos diálogos abiertos, solo el de encima atrapa.
//
// EN EL TELÉFONO SE DESLIZA (tarea 341): la hoja sube al abrirse, baja al
// cerrarse y se cierra también arrastrándola hacia abajo desde cualquier
// parte que no sea un campo, con su contenido arriba del todo. El gesto es
// un atajo: la X, el velo y Esc siguen cerrándola igual, así que nada que
// dependa del teclado o de un lector de pantalla cambia. El asa es solo la
// pista visual del gesto (oculta para el lector).
export function Modal({ abierto, onCerrar, tituloId, variante = 'dialogo', children }: Props) {
  const dialogo = useRef<HTMLDivElement>(null)
  const velo = useRef<HTMLDivElement>(null)
  const alCerrar = useRef(onCerrar)
  useEffect(() => {
    alCerrar.current = onCerrar
  })

  // LA SALIDA (tarea 341). Al cerrarse, la hoja del teléfono sigue montada
  // 200 ms mientras baja; lo decide el mismo render que la cierra, porque
  // en el siguiente ya no estaría en la página. Mientras sale no recibe
  // toques ni existe para el lector de pantalla.
  const [saliendo, setSaliendo] = useState(false)
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto)
    setSaliendo(!abierto && animaLaSalida(dialogo.current))
  }

  useLayoutEffect(() => {
    if (!saliendo) return
    const caja = dialogo.current
    const fondo = velo.current
    if (!caja || !fondo) {
      setSaliendo(false)
      return
    }
    // Parte de donde esté: si el dedo la bajó, desde ahí.
    const desde = caja.style.transform || 'translateY(0)'
    const hoja = caja.animate([{ transform: desde }, { transform: 'translateY(100%)' }], {
      duration: 200,
      easing: 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    })
    const sombra = fondo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' })
    let vigente = true
    void Promise.allSettled([hoja.finished, sombra.finished]).then(() => {
      if (vigente) setSaliendo(false)
    })
    return () => {
      vigente = false
      hoja.cancel()
      sombra.cancel()
    }
  }, [saliendo])

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

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const nodo = dialogo.current
    if (nodo && !nodo.contains(document.activeElement)) nodo.focus({ preventScroll: true })

    function alTabular(evento: KeyboardEvent) {
      if (evento.key !== 'Tab' || !nodo) return
      // Solo el diálogo de encima (el último colgado de <body>) atrapa.
      const abiertos = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (abiertos[abiertos.length - 1] !== nodo) return
      const enfocables = Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
        (elemento) => !elemento.closest('[inert], [hidden]'),
      )
      if (enfocables.length === 0) {
        evento.preventDefault()
        nodo.focus({ preventScroll: true })
        return
      }
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      const activo = document.activeElement
      if (evento.shiftKey && (activo === primero || activo === nodo || !nodo.contains(activo))) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && (activo === ultimo || activo === nodo || !nodo.contains(activo))) {
        evento.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTabular)
    return () => {
      document.removeEventListener('keydown', alTabular)
      // En un teléfono, devolver el foco a un campo de texto abriría el
      // teclado sin que nadie lo pidiera: ahí no se devuelve.
      const campo = previo instanceof HTMLInputElement || previo instanceof HTMLTextAreaElement
      const tactil = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
      if (previo && previo.isConnected && !(campo && tactil)) previo.focus({ preventScroll: true })
    }
  }, [abierto])

  // DESLIZAR PARA CERRAR (tarea 341), solo en el teléfono. Escuchas nativas
  // y no las de React: para que el dedo arrastre la hoja en vez de tirar de
  // la página hay que poder cancelar `touchmove`, y React las registra
  // pasivas.
  useEffect(() => {
    const caja = dialogo.current
    if (!abierto || !caja) return
    let inicio: { x: number; y: number; t: number } | null = null
    let arrastrando = false
    let desplazamiento = 0

    function alTocar(evento: TouchEvent) {
      inicio = null
      if (evento.touches.length !== 1 || coincide(ANCHO_TABLETA) || !caja) return
      if (evento.target instanceof Element && evento.target.closest(SIN_ARRASTRE)) return
      const toque = evento.touches[0]
      inicio = { x: toque.clientX, y: toque.clientY, t: performance.now() }
      arrastrando = false
      desplazamiento = 0
    }
    function alMover(evento: TouchEvent) {
      if (!inicio || !caja) return
      const toque = evento.touches[0]
      const dy = toque.clientY - inicio.y
      const dx = toque.clientX - inicio.x
      if (!arrastrando) {
        if (!empiezaArrastre(dx, dy, caja.scrollTop)) {
          // Hacia arriba, de lado o con contenido por encima: es desplazar.
          if (dy < 0 || Math.abs(dx) > 8 || caja.scrollTop > 0) inicio = null
          return
        }
        arrastrando = true
      }
      evento.preventDefault()
      desplazamiento = Math.max(0, dy)
      caja.style.transition = 'none'
      caja.style.transform = `translateY(${desplazamiento}px)`
    }
    function alSoltar() {
      if (!inicio || !caja) return
      const duracion = performance.now() - inicio.t
      inicio = null
      if (!arrastrando) return
      arrastrando = false
      if (cierraAlSoltar(desplazamiento, duracion, caja.offsetHeight)) {
        // Un toque que acabó en un arrastre no es un toque: que no active
        // lo que hubiera debajo del dedo.
        caja.addEventListener('click', anularClic, { capture: true, once: true })
        alCerrar.current()
        return
      }
      caja.style.transition = movimientoReducido() ? 'none' : 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)'
      caja.style.transform = ''
    }

    caja.addEventListener('touchstart', alTocar, { passive: true })
    caja.addEventListener('touchmove', alMover, { passive: false })
    caja.addEventListener('touchend', alSoltar)
    caja.addEventListener('touchcancel', alSoltar)
    return () => {
      caja.removeEventListener('touchstart', alTocar)
      caja.removeEventListener('touchmove', alMover)
      caja.removeEventListener('touchend', alSoltar)
      caja.removeEventListener('touchcancel', alSoltar)
    }
  }, [abierto])

  // Al volver a abrirse, la hoja empieza en su sitio aunque la última vez
  // la cerrara el dedo.
  useLayoutEffect(() => {
    const caja = dialogo.current
    if (!abierto || !caja) return
    caja.style.transform = ''
    caja.style.transition = ''
  }, [abierto])

  if (!abierto && !saliendo) return null

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
      ref={velo}
      data-velo-movil
      aria-hidden={saliendo || undefined}
      className={`nocturne fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 font-inter backdrop-blur-sm ${VELO_TELEFONO} ${variante === 'hoja' ? VELO_PANEL : 'md:items-center'} ${saliendo ? 'pointer-events-none' : ''}`}
      onClick={onCerrar}
    >
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        // Recibe el foco solo para que el diálogo se anuncie y Tab empiece
        // dentro: no es un control, así que sin anillo (la regla de
        // `[data-foco-lectura]` en index.css). Lo de dentro sí lo dibuja.
        data-foco-lectura
        data-hoja-movil
        onClick={(evento) => evento.stopPropagation()}
        className={`max-h-[calc(100dvh-2rem)] w-full outline-none max-w-sm overflow-y-auto rounded-2xl border border-noct-divider bg-noct-surface p-5 text-noct-text shadow-2xl ${HOJA_TELEFONO} ${variante === 'hoja' ? PANEL : ''}`}
      >
        {/* El asa: la pista del gesto de deslizar, solo en el teléfono. */}
        <div aria-hidden className="flex justify-center pb-2 pt-2 md:hidden">
          <span className="h-[5px] w-[38px] rounded-[3px] bg-noct-divider-fuerte" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function anularClic(evento: MouseEvent) {
  evento.preventDefault()
  evento.stopPropagation()
}
