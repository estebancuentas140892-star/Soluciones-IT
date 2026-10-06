import type { OpcionDecision } from '../../lib/db'
import { CaretRight, Check } from '../../components/iconos'

// LAS RESPUESTAS DE UNA DECISIÓN CON OPCIONES, PARA QUIEN EJECUTA (tarea
// 302).
//
// La pregunta es la acción de la pantalla y cada respuesta es un botón
// amplio con su nombre y, debajo, la ayuda corta para reconocerla ("Veo la
// pestaña Archivo"). Tocar una ES responder: no hay un "Continuar" aparte,
// y la ejecución lleva en el acto por el camino de esa respuesta.
//
//   - En la ejecución de una acción a la vez (`foco`), tarjetas de 64 px
//     como mínimo, apiladas en el teléfono y de dos en dos en escritorio.
//   - En la vista del paso entero y en la lectura del procedimiento
//     (`paso`), la misma lista, compacta, dentro de la tarjeta de la
//     pregunta.
//
// La respuesta elegida se distingue por tres señales y nunca solo por el
// color (regla R16): el borde y el fondo de acento, la marca y las
// palabras "Tu respuesta", que además forman parte del nombre accesible.
// Volver a la pregunta y tocar otra respuesta la cambia.

interface Props {
  opciones: OpcionDecision[]
  /** La respuesta que ya se dio (o la que se acaba de tocar y se está guardando), o null. */
  elegida: string | null
  /** Ninguna se puede tocar: el paso se está consultando o hay una respuesta guardándose. */
  inactivas?: boolean
  onElegir: (opcionId: string) => void
  /** Id del encabezado con la pregunta: da nombre al grupo para el lector de pantalla. */
  idPregunta?: string
  variante: 'foco' | 'paso'
}

const CLASES = {
  foco: {
    grupo: 'grid gap-3 md:grid-cols-2',
    boton: 'min-h-16 gap-3 rounded-2xl border-[1.5px] px-4 py-3.5',
    titulo: 'text-[17px] font-semibold leading-snug',
    ayuda: 'text-[14px] leading-snug',
    flecha: 20,
  },
  paso: {
    grupo: 'flex flex-col gap-2',
    boton: 'min-h-12 gap-2.5 rounded-lg border px-3 py-2.5',
    titulo: 'text-[14.5px] font-medium leading-snug',
    ayuda: 'text-[13px] leading-snug',
    flecha: 16,
  },
} as const

export function RespuestasDecision({ opciones, elegida, inactivas = false, onElegir, idPregunta, variante }: Props) {
  const clases = CLASES[variante]
  return (
    <div role="group" aria-labelledby={idPregunta} className={clases.grupo}>
      {opciones.map((opcion) => {
        const esLaElegida = opcion.id === elegida
        return (
          <button
            key={opcion.id}
            type="button"
            onClick={() => onElegir(opcion.id)}
            disabled={inactivas}
            className={`flex w-full items-center text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent disabled:cursor-default ${clases.boton} ${
              esLaElegida
                ? 'border-noct-accent bg-noct-accent/[.14] text-noct-text'
                : 'border-noct-divider bg-noct-surface text-noct-text enabled:hover:border-noct-accent-500 enabled:hover:bg-noct-accent/[.08] enabled:active:bg-noct-accent/[.16] disabled:opacity-60'
            }`}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={`${clases.titulo} text-pretty [overflow-wrap:anywhere]`}>{opcion.titulo}</span>
              {opcion.descripcion.trim() !== '' && (
                <span className={`${clases.ayuda} text-pretty text-noct-neutral-300 [overflow-wrap:anywhere]`}>
                  {opcion.descripcion}
                </span>
              )}
              {esLaElegida && (
                <span className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-accent-300">
                  <Check size={13} className="shrink-0" aria-hidden />
                  Tu respuesta
                </span>
              )}
            </span>
            <CaretRight size={clases.flecha} className="shrink-0 text-noct-neutral-400" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
