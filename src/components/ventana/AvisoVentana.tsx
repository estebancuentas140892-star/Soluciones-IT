import { IconoVentana } from './IconoVentana'

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
//
// CON EL DIBUJO DEL PROTOTIPO DE CLAUDE DESIGN (tarea 350): el tinte y la
// línea propios de cada nivel, el texto a 16/22 (en negrita la crítica) y la
// confirmación como una casilla de 24 dentro de su botón de 48, que al
// confirmarse pasa al verde de lo comprobado: «Advertencia confirmada».

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
    caja: 'border-[1.5px] border-noct-precaucion-linea bg-noct-precaucion-tinte',
    color: 'text-noct-precaucion',
    colorPalabra: 'text-noct-precaucion',
    peso: 'font-semibold',
    palabra: 'Precaución',
    icono: 'precaucion' as const,
  },
  critica: {
    caja: 'border-2 border-noct-error-linea bg-noct-error-tinte',
    color: 'text-noct-error',
    colorPalabra: 'text-noct-error',
    peso: 'font-bold',
    palabra: 'Advertencia crítica',
    icono: 'critica' as const,
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
      className={`flex flex-col gap-2.5 rounded-[14px] p-3 ${estilo.caja}`}
    >
      <div className="flex items-start gap-2.5">
        <IconoVentana
          nombre={estilo.icono}
          tam={nivel === 'critica' ? 24 : 22}
          grosor={nivel === 'critica' ? 2.3 : 2.2}
          className={`shrink-0 ${nivel === 'critica' ? '' : 'mt-px'} ${estilo.color}`}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={`text-[13px] font-extrabold uppercase leading-snug tracking-[.04em] ${estilo.colorPalabra}`}>
            {estilo.palabra}
          </p>
          <p className={`text-[16px] leading-[22px] text-noct-text text-pretty [overflow-wrap:anywhere] ${estilo.peso}`}>{texto}</p>
        </div>
      </div>
      {pideConfirmar && (
        <button
          type="button"
          aria-pressed={confirmada}
          onClick={onConfirmar}
          className={`flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-[15px] font-extrabold leading-tight outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent ${
            confirmada
              ? 'border-noct-exito-linea bg-noct-exito-tinte text-noct-exito'
              : 'border-noct-error-linea bg-noct-surface text-noct-error active:bg-noct-error-tinte'
          }`}
        >
          <span
            aria-hidden
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2 ${
              confirmada ? 'border-noct-exito bg-noct-exito text-noct-exito-tinte' : 'border-noct-error bg-transparent'
            }`}
          >
            {confirmada && <IconoVentana nombre="hecho" tam={14} grosor={3.6} />}
          </span>
          {confirmada ? 'Advertencia confirmada' : 'Confirmo que la leí'}
        </button>
      )}
    </div>
  )
}
