import { useId, type ReactNode } from 'react'
import { IconoVentana } from './IconoVentana'
import { RELIEVE_BORDE_FUERTE, RELLENO_ACCION } from './estilos'
import { disposicionDeRespuestas, type AccionPie } from '../../features/soluciones/ventana'
import { MensajeNoDisponible } from './MensajeNoDisponible'

// EL PIE DE LA VENTANA (tarea 348): lo único fijo de la pantalla de una
// ejecución en el teléfono, y SIEMPRE fuera del área que se desplaza, así que
// nunca tapa una instrucción. Tiene tres formas, según lo que toque:
//
//   - `PieVentana` con `BotonesDelPie`: volver y "Listo" (lo normal).
//   - `PieVentana` con `RespuestasDelPie`: la ventana termina en una pregunta
//     y sus respuestas son el avance (responder es avanzar, en un solo toque).
//   - Con `indicador` encima: una franja «Más abajo» cuando hay contenido sin ver.
//
// Es `sticky`, no `fixed`: reserva su propio hueco y no tapa el final.
//
// CON EL PIE DEL PROTOTIPO DE CLAUDE DESIGN (tarea 350): sobre la superficie,
// con su sombra hacia arriba; volver de 58 x 58 y «Listo» de 58 de alto, los
// dos con su relieve, que baja con el dedo.

interface PieVentanaProps {
  /** Franja «Más abajo» (solo visual), si hay contenido fuera de vista. */
  indicador?: ReactNode
  children: ReactNode
}

export function PieVentana({ indicador, children }: PieVentanaProps) {
  return (
    <div
      data-pie-ventana
      className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-surface shadow-[var(--shadow-noct-pie)]"
    >
      {indicador}
      <div className="px-3 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">{children}</div>
    </div>
  )
}

interface BotonVolverProps {
  disponible: boolean
  /** El nombre accesible: dice a dónde lleva y, si no se puede, por qué. */
  etiqueta: string
  onIr: () => void
  tamano: 'grande' | 'compacto'
}

function BotonVolver({ disponible, etiqueta, onIr, tamano }: BotonVolverProps) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      aria-disabled={!disponible}
      title={etiqueta}
      onClick={() => {
        if (disponible) onIr()
      }}
      className={`flex shrink-0 cursor-pointer items-center justify-center border-2 border-noct-divider bg-noct-surface text-noct-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent ${
        tamano === 'grande' ? 'h-[58px] w-[58px] rounded-2xl shadow-[0_4px_0_var(--color-noct-divider)]' : 'h-11 w-11 rounded-xl'
      } ${disponible ? 'active:bg-noct-presionado' : 'cursor-default opacity-40'}`}
    >
      <IconoVentana nombre="atras" tam={tamano === 'grande' ? 22 : 20} grosor={2.6} />
    </button>
  )
}

interface BotonesDelPieProps {
  /** Dice a dónde lleva "volver". En la primera ventana, que no hay anterior. */
  etiquetaVolver: string
  puedeVolver: boolean
  onVolver: () => void
  accion: AccionPie
  etiqueta: string
  etiquetaCompleta: string
  /** Por qué no se puede, cuando `accion` es 'no-disponible'. */
  motivo: string | null
  onPrincipal: () => void
  /** Tocar el botón apagado lleva a lo que falta (la advertencia, la pregunta). */
  onNoDisponible?: () => void
}

export function BotonesDelPie({
  etiquetaVolver,
  puedeVolver,
  onVolver,
  accion,
  etiqueta,
  etiquetaCompleta,
  motivo,
  onPrincipal,
  onNoDisponible,
}: BotonesDelPieProps) {
  const idMotivo = useId()
  const noDisponible = accion === 'no-disponible'
  return (
    <div className="flex flex-col gap-2.5">
      {noDisponible && motivo && (
        <div id={idMotivo}>
          <MensajeNoDisponible texto={motivo} />
        </div>
      )}
      <div className="flex gap-2.5">
        <BotonVolver disponible={puedeVolver} etiqueta={etiquetaVolver} onIr={onVolver} tamano="grande" />
        <button
          type="button"
          // `aria-disabled` y no `disabled`: el botón apagado sigue pudiéndose
          // enfocar y leer, y tocarlo lleva a lo que falta.
          aria-disabled={noDisponible}
          aria-describedby={noDisponible && motivo ? idMotivo : undefined}
          aria-label={etiquetaCompleta !== etiqueta ? etiquetaCompleta : undefined}
          data-accion-pie={accion}
          onClick={() => {
            if (noDisponible) onNoDisponible?.()
            else onPrincipal()
          }}
          className={`inline-flex min-h-[58px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 leading-tight outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-text ${
            noDisponible
              ? 'cursor-default bg-noct-neutral-900 text-[15.5px] font-extrabold text-noct-neutral-300 shadow-[0_4px_0_var(--color-noct-divider)]'
              : `${RELLENO_ACCION} text-[17px]`
          }`}
        >
          <span className="line-clamp-2 min-w-0 text-center">{etiqueta}</span>
          {(accion === 'listo' || accion === 'seguir') && (
            <IconoVentana nombre="flecha" tam={20} grosor={2.8} className="shrink-0" />
          )}
        </button>
      </div>
    </div>
  )
}

export interface RespuestaDelPie {
  id: string
  titulo: string
  descripcion: string
}

interface RespuestasDelPieProps {
  pregunta: string
  respuestas: RespuestaDelPie[]
  /** La respuesta ya dada (ventana revisada), o null. */
  elegida: string | null
  /** Mientras haya algo que confirmar antes: las respuestas se apagan y esto dice qué. */
  motivoBloqueo: string | null
  onElegir: (id: string) => void
  etiquetaVolver: string
  puedeVolver: boolean
  onVolver: () => void
}

/**
 * LA PREGUNTA Y SUS RESPUESTAS, FIJAS AL PIE (ajuste 2 del 2026-10-21).
 *
 *   - Cada respuesta lleva dentro EL CRITERIO para elegirla ("Sale la hoja de
 *     prueba completa"): quien contesta no abre nada para saber qué marcar.
 *   - Todas pesan igual y van en el mismo color neutro del sistema: ninguna es
 *     "la buena", así que ni verde ni rojo.
 *   - Bloqueadas (una advertencia crítica sin confirmar), se apagan con el
 *     borde y la etiqueta, NO con opacidad: el criterio sigue legible, y una
 *     frase con candado dice qué falta.
 */
export function RespuestasDelPie({
  pregunta,
  respuestas,
  elegida,
  motivoBloqueo,
  onElegir,
  etiquetaVolver,
  puedeVolver,
  onVolver,
}: RespuestasDelPieProps) {
  const idPregunta = useId()
  const bloqueada = motivoBloqueo !== null
  const disposicion = disposicionDeRespuestas(respuestas.map((r) => ({ ...r, destino: { tipo: 'continuar' as const } })))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <BotonVolver disponible={puedeVolver} etiqueta={etiquetaVolver} onIr={onVolver} tamano="compacto" />
        <p id={idPregunta} className="min-w-0 flex-1 pt-0.5 text-[17px] font-extrabold leading-snug text-pretty">
          {pregunta}
        </p>
      </div>
      {bloqueada && <MensajeNoDisponible texto={motivoBloqueo} />}
      {/* DOS RESPUESTAS, LADO A LADO (tarea 350, prototipo de Claude Design):
          cada una en su tarjeta con relieve, de 60 de alto como mínimo, con el
          criterio debajo. Las dos pesan igual y en el mismo color (regla 31
          c): el prototipo pintaba el Sí en verde y el No en rojo, y aquí no,
          porque ninguna respuesta es «la correcta». Con tres o más, una
          debajo de otra. */}
      <div
        role="group"
        aria-labelledby={idPregunta}
        className={respuestas.length === 2 ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2'}
      >
        {respuestas.map((respuesta) => {
          const esLaElegida = respuesta.id === elegida
          const enRejilla = respuestas.length === 2
          return (
            <button
              key={respuesta.id}
              type="button"
              aria-disabled={bloqueada}
              aria-pressed={elegida !== null ? esLaElegida : undefined}
              data-respuesta-ventana
              onClick={() => {
                if (!bloqueada) onElegir(respuesta.id)
              }}
              className={`flex w-full cursor-pointer gap-x-3 rounded-2xl border-2 px-3 py-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent ${
                enRejilla ? 'min-h-[60px] min-w-0 flex-col items-start gap-y-1' : disposicion === 'fila' ? 'min-h-[52px] flex-row items-center' : 'min-h-[52px] flex-col items-start gap-y-0.5'
              } ${
                bloqueada
                  ? 'cursor-default border-noct-divider bg-noct-surface'
                  : esLaElegida
                    ? 'border-noct-accent bg-noct-accent-900'
                    : `border-noct-divider-fuerte bg-noct-surface ${RELIEVE_BORDE_FUERTE}`
              }`}
            >
              <span
                className={`flex shrink-0 items-center gap-1.5 text-[18px] font-extrabold leading-6 ${
                  !enRejilla && disposicion === 'fila' ? 'min-w-[34px]' : ''
                } ${bloqueada ? 'text-noct-neutral-300' : 'text-noct-text'}`}
              >
                {respuesta.id === 'si' && <IconoVentana nombre="hecho" tam={20} grosor={3} />}
                {respuesta.id === 'no' && <IconoVentana nombre="cerrar" tam={20} grosor={3} />}
                {respuesta.titulo}
              </span>
              {respuesta.descripcion.trim() !== '' && (
                <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-[18px] text-noct-neutral-300 text-pretty [overflow-wrap:anywhere]">
                  {respuesta.descripcion}
                </span>
              )}
              {esLaElegida && (
                <span className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-[.06em] text-noct-accent-300">
                  <IconoVentana nombre="hecho" tam={13} grosor={3} className="shrink-0" />
                  Tu respuesta
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
