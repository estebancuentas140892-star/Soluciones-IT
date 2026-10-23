import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { SubtituloTarea } from '../../app/bandaTarea'
import { CaretLeft } from '../../components/iconos'
import { huecoAvisoActualizacion } from '../../components/ranuraAvisoActualizacion'
import { useEsAncho } from '../../components/useEsAncho'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import { GlifoVentana } from '../../components/ventana/MarcaVentana'
import { BotonVolver } from '../../components/ventana/PieVentana'
import { RELLENO_ACCION, TARJETA } from '../../components/ventana/estilos'
import { BOTON_ANTERIOR, BotonPrincipal } from './ModoFoco'
import type { LargoDeRuta } from '../../lib/rutaProcedimiento'
import { cantidadDePasos } from './estadoPasos'
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

// "7 pasos · unos 15 min": cuánto cuesta, en una línea y en voz baja. Con
// caminos que no miden lo mismo (tarea 302), "Entre 4 y 6 pasos".
function resumen(largo: LargoDeRuta, tiempoMin: number | null): string {
  const pasos = cantidadDePasos(largo)
  return tiempoMin ? `${pasos} · unos ${tiempoMin} min` : pasos
}

// En la ejecución por ventanas del teléfono, lo que se recorre se llama
// «ventana» (AD-093, decisión 5): "3 ventanas · unos 6 min".
function resumenEnVentanas(largo: LargoDeRuta, tiempoMin: number | null): string {
  const { minimo, maximo } = largo
  const ventanas =
    minimo !== maximo ? `Entre ${minimo} y ${maximo} ventanas` : minimo === 1 ? '1 ventana' : `${minimo} ventanas`
  return tiempoMin ? `${ventanas} · unos ${tiempoMin} min` : ventanas
}

interface Props {
  pantalla: PantallaPreparacion
  /** El nombre de la guía que se abrió: es "qué vas a hacer". */
  titulo: string
  orientacion: Orientacion | null
  requisitos: string[]
  /** Los pasos que recorre la guía: con decisiones con opciones, los del camino más corto y los del más largo. */
  largo: LargoDeRuta
  tiempoMin: number | null
  /** Desde la orientación, ¿lo siguiente son los requisitos o ya la primera acción? */
  siguienteEsRequisitos: boolean
  onSeguir: () => void
  /** Sin él no hay a dónde volver (la primera pantalla de la preparación). */
  onAnterior?: () => void
  /** La guía se ejecutará por ventanas (el teléfono, por defecto): cuenta ventanas, no pasos. */
  enVentana?: boolean
}

export function PantallaPreparacion(props: Props) {
  const ancho = useEsAncho()
  // Cada pantalla empieza arriba y con el foco en su encabezado: el lector
  // de pantalla anuncia lo que toca y el teclado sigue desde ahí.
  const encabezado = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    subirElContenedor(encabezado.current)
    encabezado.current?.focus({ preventScroll: true })
  }, [props.pantalla])
  if (!ancho) return <PreparacionEnTelefono {...props} encabezado={encabezado} />
  return <PreparacionAmplia {...props} encabezado={encabezado} />
}

function etiquetaDeSeguir(pantalla: PantallaPreparacion, siguienteEsRequisitos: boolean): string {
  return pantalla === 'requisitos' ? 'Todo listo, empezar' : siguienteEsRequisitos ? 'Ver lo que necesitas' : 'Empezar'
}

type PropsConEncabezado = Props & { encabezado: RefObject<HTMLHeadingElement | null> }

// LA PREPARACIÓN EN EL TELÉFONO, CON LAS PIEZAS DE «VENTANA» (tarea 351). Las
// mismas dos pantallas y el mismo recorrido (regla 25 b: orientar y preparar
// no se mezclan con ejecutar), dibujadas como el resto de la guía del
// prototipo: la cabecera dice «Antes de empezar» bajo el título; la
// orientación abre con el icono de la ventana, «Qué vas a hacer» y el nombre
// a 26, cuántas ventanas y cuánto toma, y cuándo usarla y el objetivo en su
// tarjeta; los requisitos van en el azul de preparar, el mismo de la tarjeta
// «Antes de empezar» de la ventana; y el pie es el de la ventana, sobre la
// superficie, con volver de 58 y la acción rellena con su relieve.
function PreparacionEnTelefono({
  pantalla,
  titulo,
  orientacion,
  requisitos,
  largo,
  tiempoMin,
  siguienteEsRequisitos,
  onSeguir,
  onAnterior,
  enVentana = true,
  encabezado,
}: PropsConEncabezado) {
  const resumenGuia = enVentana ? resumenEnVentanas(largo, tiempoMin) : resumen(largo, tiempoMin)
  return (
    <div className="flex flex-1 flex-col">
      <SubtituloTarea>
        <p data-paso-en-cabecera className="truncate text-[13px] font-semibold leading-[18px] text-noct-neutral-300">
          Antes de empezar
        </p>
      </SubtituloTarea>
      <div className="flex flex-1 flex-col gap-4 pb-6 pt-6">
        {pantalla === 'orientacion' ? (
          <>
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-noct-accent-900 text-noct-accent-300"
              >
                <GlifoVentana tam={30} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-[13px] font-extrabold uppercase tracking-[.05em] text-noct-neutral-300">Qué vas a hacer</p>
                {largo.maximo > 0 && (
                  <p className="text-[15px] font-semibold leading-snug text-noct-neutral-300">{resumenGuia}</p>
                )}
              </div>
            </div>
            <h2
              ref={encabezado}
              tabIndex={-1}
              data-foco-lectura
              className="text-[26px] font-extrabold leading-8 tracking-[-.02em] text-pretty text-noct-text outline-none [overflow-wrap:anywhere]"
            >
              {titulo}
            </h2>
            {(orientacion?.cuandoUsar || orientacion?.objetivo) && (
              <section className={`${TARJETA} flex flex-col gap-3.5 rounded-[20px] p-4`}>
                {orientacion?.cuandoUsar && (
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[15px] font-extrabold leading-snug">Cuándo usarla</h3>
                    <p className="whitespace-pre-line text-[16px] font-medium leading-[22px] text-pretty text-noct-text">
                      {orientacion.cuandoUsar}
                    </p>
                  </div>
                )}
                {orientacion?.cuandoUsar && orientacion?.objetivo && <hr className="border-noct-divider" />}
                {orientacion?.objetivo && (
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[15px] font-extrabold leading-snug">Objetivo</h3>
                    <p className="text-[16px] font-medium leading-[22px] text-pretty text-noct-neutral-200">
                      {orientacion.objetivo}
                    </p>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-noct-antes-tinte text-noct-antes"
              >
                <IconoVentana nombre="requisitos" tam={30} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2
                  ref={encabezado}
                  tabIndex={-1}
                  data-foco-lectura
                  className="text-[26px] font-extrabold leading-8 tracking-[-.02em] text-noct-text outline-none"
                >
                  Antes de empezar
                </h2>
                <p className="text-[15px] font-semibold leading-snug text-noct-neutral-300">
                  Ten esto listo antes de la primera {enVentana ? 'ventana' : 'acción'}.
                </p>
              </div>
            </div>
            <ul data-antes-de-empezar className="flex flex-col gap-3 rounded-[20px] bg-noct-antes-tinte px-4 py-3.5">
              {requisitos.map((requisito, i) => (
                <li key={i} className="flex items-start gap-3 text-[16px] font-medium leading-[22px] text-noct-text">
                  <IconoVentana nombre="hecho" tam={18} grosor={3} className="mt-0.5 shrink-0 text-noct-antes" />
                  <span className="min-w-0 text-pretty [overflow-wrap:anywhere]">{requisito}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-none flex-col gap-2.5 border-t border-noct-divider bg-noct-surface px-3 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-noct-pie)]">
        {/* El aviso de versión nueva, encima de los botones (tarea 273). */}
        <div ref={huecoAvisoActualizacion} className="empty:hidden" />
        <div className="flex gap-2.5">
          {onAnterior && <BotonVolver disponible etiqueta="Anterior" onIr={onAnterior} tamano="grande" />}
          <button
            type="button"
            onClick={onSeguir}
            className={`${RELLENO_ACCION} inline-flex min-h-[58px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-[17px] leading-tight outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-text`}
          >
            <span className="line-clamp-2 min-w-0 text-center">{etiquetaDeSeguir(pantalla, siguienteEsRequisitos)}</span>
            <IconoVentana nombre="flecha" tam={20} grosor={2.8} className="shrink-0" />
          </button>
        </div>
      </div>
    </div>
  )
}

function PreparacionAmplia({
  pantalla,
  titulo,
  orientacion,
  requisitos,
  largo,
  tiempoMin,
  siguienteEsRequisitos,
  onSeguir,
  onAnterior,
  encabezado,
}: PropsConEncabezado) {
  const etiqueta = etiquetaDeSeguir(pantalla, siguienteEsRequisitos)

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
              {largo.maximo > 0 && <p className="text-[13.5px] text-noct-neutral-400">{resumen(largo, tiempoMin)}</p>}
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
