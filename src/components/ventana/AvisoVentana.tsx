import { Check, Warning, WarningOctagon } from '../iconos'

// UNA ADVERTENCIA DE LA VENTANA (tarea 348, rediseño móvil por ventanas).
//
// Va dentro de la ventana, en su sitio (antes de la acción a la que
// pertenece), y no en una pantalla aparte: leerla y hacer la acción ocurren
// en el mismo vistazo. Hay dos niveles y se distinguen por TRES señales,
// nunca solo por el color (regla R16): el icono, la palabra y la intensidad
// del borde.
//
//   - 'precaucion': un riesgo que pide atención y no detiene. Triángulo,
//     ámbar, borde fino. No pide ningún toque.
//   - 'critica': pérdida de datos, un cambio irreversible o un impacto
//     grande. Octágono, rojo, borde de 2 px. Es la ÚNICA que pide "Confirmo
//     que la leí" (ajuste 1 del 2026-10-21), y mientras no se confirme la
//     ventana no se cierra: lo dice el pie, con palabras.
//
// La confirmación se puede deshacer tocándola otra vez: confirmar por
// error no encierra a nadie.

export type NivelAviso = 'precaucion' | 'critica'

interface Props {
  nivel: NivelAviso
  texto: string
  /** Solo en la crítica: ya se confirmó. */
  confirmada?: boolean
  /** Solo en la crítica: confirmar o deshacer. Sin él, la crítica se lee y no pide nada. */
  onConfirmar?: () => void
}

const ESTILOS = {
  precaucion: {
    caja: 'border border-noct-precaucion/55 bg-noct-precaucion/[.12]',
    color: 'text-noct-precaucion',
    palabra: 'Precaución',
    Icono: Warning,
  },
  critica: {
    caja: 'border-2 border-noct-error bg-noct-error/[.12]',
    color: 'text-noct-error',
    palabra: 'Advertencia crítica',
    Icono: WarningOctagon,
  },
} as const

export function AvisoVentana({ nivel, texto, confirmada = false, onConfirmar }: Props) {
  const estilo = ESTILOS[nivel]
  const pideConfirmar = nivel === 'critica' && onConfirmar !== undefined
  return (
    <div
      role="group"
      aria-label={estilo.palabra}
      data-aviso-ventana={nivel}
      data-confirmada={nivel === 'critica' ? String(confirmada) : undefined}
      className={`flex flex-col gap-2.5 rounded-2xl px-3.5 py-3 ${estilo.caja}`}
    >
      <div className="flex items-start gap-2.5">
        <estilo.Icono size={nivel === 'critica' ? 22 : 20} className={`mt-px shrink-0 ${estilo.color}`} aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={`text-[13px] font-extrabold uppercase leading-snug tracking-[.05em] ${estilo.color}`}>
            {estilo.palabra}
          </p>
          <p className="text-[16px] font-medium leading-[1.4] text-noct-text text-pretty [overflow-wrap:anywhere]">
            {texto}
          </p>
        </div>
      </div>
      {pideConfirmar && (
        <button
          type="button"
          aria-pressed={confirmada}
          onClick={onConfirmar}
          className={`flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-[15px] font-bold leading-tight outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent ${
            confirmada
              ? 'border-noct-error bg-noct-error/[.2] text-noct-text'
              : 'border-noct-error/70 bg-transparent text-noct-text active:bg-noct-error/[.12]'
          }`}
        >
          {confirmada ? (
            <>
              <Check size={18} className="shrink-0 text-noct-error" aria-hidden />
              Leída
            </>
          ) : (
            'Confirmo que la leí'
          )}
        </button>
      )}
    </div>
  )
}
