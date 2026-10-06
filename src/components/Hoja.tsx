import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as EventoPuntero,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Boton } from './Boton'
import { X } from './iconos'
import { useEsEscritorio } from './useEsEscritorio'

// LA HOJA INFERIOR DE SOLUCIONES IT (tarea 291, auditoría UX de Claude
// Design, sección 7, F1, F2 y F9).
//
// Hasta la 291 había tres formas de hoja: el `Modal` general, que en el
// teléfono era una tarjeta flotante a 16 px de los bordes con un velo negro
// al 70 % y desenfoque; la hoja propia de la Bóveda, pegada abajo con otro
// velo y un aro claro; y los menús de las fichas, bandas dentro de la
// página. Para cerrar: una × de 44, una de unos 30, ninguna (solo
// "Cancelar") o "Quitar filtro".
//
// Aquí queda una sola:
//
// - **Teléfono:** pegada abajo, con asa, título de 17 px a la izquierda, ×
//   de 44 px a la derecha, el contenido con su propio desplazamiento y las
//   acciones al pie. Escape, tocar fuera y deslizarla hacia abajo cierran
//   (si la hoja es `cerrable`, que es lo normal). Con el teclado abierto
//   sube sobre él, con su acción a la vista (F7).
// - **Escritorio (desde 768 px):** un diálogo centrado de 440 px; la hoja
//   de elegir que se abre desde un control (`ancla`: un filtro, un menú)
//   aparece junto a ese control, sin oscurecer la pantalla.
// - **Un solo velo**, del tono del fondo al 70 %, sin desenfoque.
//
// Se mantiene lo que ya resolvía `Modal`: va SIEMPRE a `<body>` por portal
// (`position: fixed` no se resuelve contra la pantalla si un ancestro
// lleva `backdrop-filter`, bug del 2026-07-21) y bloquea el desplazamiento
// del fondo. Se añade lo que faltaba para el teclado y el lector de
// pantalla: el foco entra en la hoja, no sale de ella con Tab y vuelve al
// control que la abrió al cerrar.

// Las hojas abiertas, de la más antigua a la más reciente. Escape y el
// velo solo cierran la de arriba: un diálogo de confirmar sobre una hoja
// de acciones no cierra las dos de un golpe.
let pila: string[] = []
const suscriptoresPila = new Set<() => void>()

function cambiarPila(siguiente: string[]) {
  pila = siguiente
  for (const escucha of suscriptoresPila) escucha()
}

function suscribirPila(escucha: () => void) {
  suscriptoresPila.add(escucha)
  return () => suscriptoresPila.delete(escucha)
}

// Lo que el teclado del teléfono tapa por abajo. Chrome en Android y
// Safari en iOS no reducen igual la pantalla al abrirlo (la auditoría lo
// deja "a comprobar en iPhone y Android reales"), así que no se supone
// nada: se mide con `visualViewport`, que en los dos dice cuánto queda
// visible. Sin teclado, 0.
function useTecladoTapa(activo: boolean): { tapa: number; altoVisible: number | null } {
  const [medida, setMedida] = useState<{ tapa: number; altoVisible: number | null }>({ tapa: 0, altoVisible: null })
  useEffect(() => {
    const vista = window.visualViewport
    if (!activo || !vista) return
    const medir = () =>
      setMedida({
        tapa: Math.max(0, Math.round(window.innerHeight - vista.height - vista.offsetTop)),
        altoVisible: Math.round(vista.height),
      })
    medir()
    vista.addEventListener('resize', medir)
    vista.addEventListener('scroll', medir)
    return () => {
      vista.removeEventListener('resize', medir)
      vista.removeEventListener('scroll', medir)
    }
  }, [activo])
  return medida
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Cuánto hay que arrastrar el asa hacia abajo para cerrar la hoja.
const UMBRAL_DESLIZAR = 80

export interface PropsHoja {
  abierta: boolean
  onCerrar: () => void
  titulo: ReactNode
  // Una frase bajo el título: qué pasará o de qué se trata.
  descripcion?: ReactNode
  // Lo que va encima del título, ya con su estilo: el tipo de la ficha
  // ("Comando", "Término del glosario") o el regreso a la anterior.
  rotulo?: ReactNode
  children?: ReactNode
  // Las acciones, al pie y fuera del desplazamiento.
  pie?: ReactNode
  // Las hojas con buscador se abren casi a pantalla completa, con el campo
  // arriba y la lista hasta el teclado (F7).
  alta?: boolean
  // Escritorio: la hoja de elegir aparece junto al control que la abrió.
  ancla?: RefObject<HTMLElement | null>
  // Falso solo cuando cerrar sin decidir perdería algo: sin ×, sin cerrar
  // por el velo ni por deslizar (F1: "cuando la acción lo permite").
  cerrable?: boolean
  // Nombre accesible de la × ("Cerrar" si no se dice otro).
  textoCerrar?: string
  // Clases extra del cuerpo desplazable (separación entre filas, etc.).
  claseCuerpo?: string
}

export function Hoja({
  abierta,
  onCerrar,
  titulo,
  descripcion,
  rotulo,
  children,
  pie,
  alta = false,
  ancla,
  cerrable = true,
  textoCerrar = 'Cerrar',
  claseCuerpo = '',
}: PropsHoja) {
  if (!abierta) return null
  return (
    <CapaHoja
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={descripcion}
      rotulo={rotulo}
      pie={pie}
      alta={alta}
      ancla={ancla}
      cerrable={cerrable}
      textoCerrar={textoCerrar}
      claseCuerpo={claseCuerpo}
    >
      {children}
    </CapaHoja>
  )
}

type PropsCapa = Omit<PropsHoja, 'abierta'> & { alta: boolean; cerrable: boolean; textoCerrar: string; claseCuerpo: string }

function CapaHoja({
  onCerrar,
  titulo,
  descripcion,
  rotulo,
  children,
  pie,
  alta,
  ancla,
  cerrable,
  textoCerrar,
  claseCuerpo,
}: PropsCapa) {
  const id = useId()
  const idTitulo = `${id}-titulo`
  const idDescripcion = `${id}-descripcion`
  const panel = useRef<HTMLDivElement>(null)
  const escritorio = useEsEscritorio()
  const { tapa: tapaTeclado, altoVisible } = useTecladoTapa(!escritorio)
  // El control que tenía el foco antes de abrir, leído al montar y antes
  // de que un `autoFocus` de dentro se lo lleve: ahí vuelve al cerrar.
  const [previo] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))
  const [arrastre, setArrastre] = useState(0)
  const inicioArrastre = useRef<number | null>(null)
  const anclada = escritorio && Boolean(ancla?.current)
  const [posicion, setPosicion] = useState<CSSProperties | null>(null)

  // Una referencia estable a `onCerrar`: quien la pasa suele escribirla
  // como flecha en el JSX, y el efecto de Escape no debe rehacerse en cada
  // render de la pantalla de debajo.
  const cerrarRef = useRef(onCerrar)
  useLayoutEffect(() => {
    cerrarRef.current = onCerrar
  })
  const cerrar = useCallback(() => cerrarRef.current(), [])

  const deArriba = useSyncExternalStore(
    suscribirPila,
    () => pila.at(-1) === id,
    () => true,
  )

  useEffect(() => {
    cambiarPila([...pila, id])
    return () => cambiarPila(pila.filter((otra) => otra !== id))
  }, [id])

  // Bloqueo del fondo y foco: al abrir, el foco entra en la hoja (al
  // primer campo con `autoFocus` si lo hay, si no al panel), y al cerrar
  // vuelve al control que la abrió.
  useEffect(() => {
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const elemento = panel.current
    if (elemento && !elemento.contains(document.activeElement)) elemento.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflowPrevio
      if (previo && document.contains(previo)) previo.focus({ preventScroll: true })
    }
  }, [previo])

  useEffect(() => {
    if (!deArriba) return
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && cerrable) {
        evento.stopPropagation()
        cerrar()
        return
      }
      if (evento.key !== 'Tab' || !panel.current) return
      const enfocables = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (enfocables.length === 0) {
        evento.preventDefault()
        return
      }
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      const activo = document.activeElement
      if (evento.shiftKey && (activo === primero || activo === panel.current)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [deArriba, cerrable, cerrar])

  // Junto a su control, en escritorio: debajo si cabe, si no encima, y
  // siempre dentro de la ventana.
  useLayoutEffect(() => {
    if (!anclada) {
      setPosicion(null)
      return
    }
    function colocar() {
      const control = ancla?.current
      if (!control) return
      const caja = control.getBoundingClientRect()
      const ancho = Math.min(360, window.innerWidth - 32)
      const izquierda = Math.min(Math.max(16, caja.left), window.innerWidth - ancho - 16)
      const abajo = window.innerHeight - caja.bottom - 16
      const arriba = caja.top - 16
      if (abajo >= 240 || abajo >= arriba) {
        setPosicion({ left: izquierda, top: caja.bottom + 6, width: ancho, maxHeight: abajo - 6 })
      } else {
        setPosicion({ left: izquierda, bottom: window.innerHeight - caja.top + 6, width: ancho, maxHeight: arriba - 6 })
      }
    }
    colocar()
    window.addEventListener('resize', colocar)
    window.addEventListener('scroll', colocar, true)
    return () => {
      window.removeEventListener('resize', colocar)
      window.removeEventListener('scroll', colocar, true)
    }
  }, [anclada, ancla])

  // Deslizar hacia abajo desde el asa o la cabecera (no desde la ×).
  function alEmpezarArrastre(evento: EventoPuntero<HTMLDivElement>) {
    if (!cerrable || escritorio) return
    if ((evento.target as HTMLElement).closest('button')) return
    inicioArrastre.current = evento.clientY
    evento.currentTarget.setPointerCapture(evento.pointerId)
  }
  function alArrastrar(evento: EventoPuntero<HTMLDivElement>) {
    if (inicioArrastre.current === null) return
    setArrastre(Math.max(0, evento.clientY - inicioArrastre.current))
  }
  function alSoltar() {
    if (inicioArrastre.current === null) return
    inicioArrastre.current = null
    if (arrastre > UMBRAL_DESLIZAR) cerrar()
    else setArrastre(0)
  }

  const estiloPanel: CSSProperties = escritorio
    ? (posicion ?? {})
    : {
        bottom: tapaTeclado,
        // Con el teclado abierto la hoja nunca pasa del borde de arriba de
        // lo visible; `alta` llega casi arriba (60 px) aunque no haya teclado.
        ...(alta
          ? { top: 60 }
          : { maxHeight: altoVisible !== null ? altoVisible - 24 : 'calc(100dvh - 24px)' }),
        transform: arrastre ? `translateY(${arrastre}px)` : undefined,
        transition: arrastre && inicioArrastre.current !== null ? 'none' : undefined,
      }

  return createPortal(
    <div className="nocturne fixed inset-0 z-[60] font-inter text-noct-text">
      <div
        aria-hidden
        onClick={cerrable ? cerrar : undefined}
        className={`absolute inset-0 ${anclada ? '' : 'bg-noct-bg/70'}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descripcion ? idDescripcion : undefined}
        tabIndex={-1}
        // El panel recibe el foco solo para que el lector anuncie la hoja:
        // no es un control y no lleva anillo (regla de `index.css`).
        data-foco-lectura
        style={estiloPanel}
        className={`absolute flex flex-col overflow-hidden bg-noct-surface shadow-2xl outline-none transition-transform duration-200 ease-out motion-reduce:transition-none ${
          escritorio
            ? anclada
              ? 'rounded-xl border border-noct-divider'
              : 'top-1/2 left-1/2 max-h-[calc(100dvh-4rem)] w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-noct-divider'
            : 'inset-x-0 rounded-t-[18px] border-t border-noct-divider'
        }`}
      >
        <div
          onPointerDown={alEmpezarArrastre}
          onPointerMove={alArrastrar}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          className={`shrink-0 ${escritorio ? 'px-5 pt-4' : 'touch-none px-4 pt-2'}`}
        >
          {!escritorio && <div aria-hidden className="mx-auto mb-2.5 h-1 w-9 rounded-sm bg-noct-neutral-600" />}
          <div className="flex items-start justify-between gap-2.5 pb-2.5 pl-1">
            <div className="flex min-w-0 flex-col gap-0.5 pt-2">
              {rotulo}
              <h2 id={idTitulo} className="text-pretty text-[17px] font-medium leading-[1.3] text-noct-text">
                {titulo}
              </h2>
              {descripcion && (
                <p id={idDescripcion} className="text-pretty text-[13px] leading-[1.45] text-noct-neutral-400">
                  {descripcion}
                </p>
              )}
            </div>
            {cerrable &&
              (escritorio ? (
                <Boton
                  papel="texto"
                  soloIcono
                  aria-label={textoCerrar}
                  title={textoCerrar}
                  onClick={cerrar}
                  icono={<X size={18} aria-hidden />}
                  className="-mr-2"
                />
              ) : (
                // En el teléfono la × lleva un fondo tenue (F1): es la
                // salida de la hoja y tiene que encontrarse sin buscarla.
                // Es la única variante de cierre con fondo, por eso no es
                // un `Boton` de la escala.
                <button
                  type="button"
                  aria-label={textoCerrar}
                  onClick={cerrar}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-noct-text/[.08] text-noct-text transition-colors active:bg-noct-text/[.16]"
                >
                  <X size={20} aria-hidden />
                </button>
              ))}
          </div>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${escritorio ? 'px-5' : 'px-4'} ${
            pie ? '' : escritorio ? 'pb-5' : 'pb-[max(14px,env(safe-area-inset-bottom))]'
          } ${claseCuerpo}`}
        >
          {children}
        </div>
        {pie && (
          <div
            className={`shrink-0 ${
              escritorio ? 'px-5 pt-3.5 pb-5' : 'px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]'
            }`}
          >
            {pie}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
