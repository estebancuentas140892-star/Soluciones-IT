import { useEffect, useRef, type ReactNode } from 'react'
import { CaretLeft } from '../../components/iconos'
import { huecoAvisoActualizacion } from '../../components/ranuraAvisoActualizacion'
import { BOTON_ANTERIOR, BotonPrincipal } from './ModoFoco'
import type { Orientacion, PantallaPreparacion } from './preparacionGuia'
import { subirElContenedor } from './subirElContenedor'

// LA PREPARACIÓN DE UNA GUÍA (tarea 289, fase 2): lo que se lee ANTES de la
// primera acción, una pantalla por propósito.
//
//   - ORIENTAR: qué vas a hacer, cuándo usarla y el objetivo. Nada que
//     hacer todavía, nada que marcar.
//   - PREPARAR: los requisitos reales, juntos, y una sola acción para
//     empezar. Ya no van en la misma pantalla que la primera acción.
//
// Las reglas (qué pantallas hay y con qué texto) viven en
// `preparacionGuia.ts`; aquí solo la forma. El pie es el mismo de la
// ejecución (`BotonPrincipal`, 64 px), para que empezar se sienta como el
// primer gesto del procedimiento y no como un formulario aparte.

const ROTULO = 'text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400'

function Seccion({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className={ROTULO}>{rotulo}</h3>
      {children}
    </section>
  )
}

// "7 pasos · unos 15 min": cuánto cuesta, en una línea y en voz baja.
function resumen(totalPasos: number, tiempoMin: number | null): string {
  const pasos = totalPasos === 1 ? '1 paso' : `${totalPasos} pasos`
  return tiempoMin ? `${pasos} · unos ${tiempoMin} min` : pasos
}

export function PantallaPreparacion({
  pantalla,
  titulo,
  orientacion,
  requisitos,
  totalPasos,
  tiempoMin,
  siguienteEsRequisitos,
  onSeguir,
  onAnterior,
}: {
  pantalla: PantallaPreparacion
  /** El nombre de la guía que se abrió: es "qué vas a hacer". */
  titulo: string
  orientacion: Orientacion | null
  requisitos: string[]
  totalPasos: number
  tiempoMin: number | null
  /** Desde la orientación, ¿lo siguiente son los requisitos o ya la primera acción? */
  siguienteEsRequisitos: boolean
  onSeguir: () => void
  /** Sin él no hay a dónde volver (la primera pantalla de la preparación). */
  onAnterior?: () => void
}) {
  // Cada pantalla empieza arriba y con el foco en su encabezado: el lector
  // de pantalla anuncia lo que toca y el teclado sigue desde ahí.
  const encabezado = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    subirElContenedor(encabezado.current)
    encabezado.current?.focus({ preventScroll: true })
  }, [pantalla])

  const etiqueta =
    pantalla === 'requisitos' ? 'Todo listo, empezar' : siguienteEsRequisitos ? 'Ver lo que necesitas' : 'Empezar'

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 pb-6 pt-5">
        {pantalla === 'orientacion' ? (
          <>
            <div className="flex flex-col gap-2">
              <p className={ROTULO}>Qué vas a hacer</p>
              <h2
                ref={encabezado}
                tabIndex={-1}
                data-foco-lectura
                className="text-[24px] font-medium leading-[1.25] tracking-[-.01em] text-pretty text-noct-text outline-none [overflow-wrap:anywhere]"
              >
                {titulo}
              </h2>
              {totalPasos > 0 && <p className="text-[13.5px] text-noct-neutral-400">{resumen(totalPasos, tiempoMin)}</p>}
            </div>
            {orientacion?.cuandoUsar && (
              <Seccion rotulo="Cuándo usarla">
                <p className="whitespace-pre-line text-[16px] leading-[1.5] text-pretty text-noct-text">
                  {orientacion.cuandoUsar}
                </p>
              </Seccion>
            )}
            {orientacion?.objetivo && (
              <Seccion rotulo="Objetivo">
                <p className="text-[16px] leading-[1.5] text-pretty text-noct-neutral-200">{orientacion.objetivo}</p>
              </Seccion>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <h2
                ref={encabezado}
                tabIndex={-1}
                data-foco-lectura
                className="text-[24px] font-medium leading-[1.25] tracking-[-.01em] text-noct-text outline-none"
              >
                Antes de empezar
              </h2>
              <p className="text-[15px] leading-snug text-noct-neutral-300">Ten esto listo antes de la primera acción.</p>
            </div>
            <ul className="flex flex-col gap-3 rounded-xl border border-noct-divider bg-noct-surface px-4 py-3.5">
              {requisitos.map((requisito, i) => (
                <li key={i} className="flex items-start gap-3 text-[16px] leading-snug text-noct-text">
                  <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-noct-neutral-400" />
                  <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">{requisito}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-none flex-col gap-1.5 border-t border-noct-divider bg-noct-bg px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        {/* El aviso de versión nueva, encima de los botones (tarea 273). */}
        <div ref={huecoAvisoActualizacion} className="mx-auto w-full max-w-xl empty:hidden" />
        <div className="mx-auto flex w-full max-w-xl gap-2.5">
          {onAnterior && (
            <button
              type="button"
              onClick={onAnterior}
              aria-label="Anterior"
              title="Anterior"
              className={BOTON_ANTERIOR}
            >
              <CaretLeft size={22} aria-hidden />
            </button>
          )}
          <BotonPrincipal etiqueta={etiqueta} icono="flecha" onClick={onSeguir} />
        </div>
      </div>
    </div>
  )
}
