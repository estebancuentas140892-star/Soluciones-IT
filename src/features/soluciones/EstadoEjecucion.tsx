import { ClockCounterClockwise, Eye, PencilSimple } from '../../components/iconos'
import type { ResumenPaso } from './estadoPasos'

// LO QUE VA ENTRE LA CABECERA Y EL PASO (propuesta final de Claude
// Design, 2026-10-01, fila "Ejecución de una guía").
//
// La pregunta de la pantalla es "¿qué tengo que hacer ahora?", así que
// lo que orienta se reduce a dos piezas que no compiten con la acción:
//
//   - una barra fina con un segmento por paso, que dice cuánto se lleva
//     sin nombrar ningún paso (el contador "3/8" de la cabecera abre el
//     índice con los nombres);
//   - una línea de estado, solo cuando hay algo que decir: que se está
//     CONSULTANDO otro paso (nada se marca), que se RETOMÓ una ejecución
//     a medias (con "Empezar de nuevo" a un toque, AD-040) o que la guía
//     es un BORRADOR (se dice, no se impide). Una a la vez y en una línea,
//     nunca una tarjeta.

/**
 * Un segmento por paso y, si la guía tiene comprobación final, uno más para
 * ella. Hecho en acento; el que se está viendo, en el color del texto (se
 * distingue de lo hecho sin parecer un control); el resto, apagado. Cuando
 * se consulta otro paso, ese va en ámbar y el de trabajo en el gris claro.
 * Es decorativo para el lector de pantalla: el contador de la cabecera ya
 * dice "Paso 3 de 8".
 *
 * Desde el rediseño móvil "1b Pulgar" (tarea 328) van DENTRO de la cabecera
 * compacta, bajo su línea, sobre la misma superficie (`BandaBajoTarea`):
 * 4 px de alto y 4 px entre ellos. Antes iban en el cuerpo, a 3 px, y se
 * desplazaban con el paso.
 *
 * Solo en el teléfono: en escritorio y tableta la ruta horizontal
 * (`RutaProcedimiento`) ya enseña todos los pasos con su estado.
 */
export function SegmentosDePasos({
  resumenes,
  total = resumenes.length,
  indiceVisto,
  indiceTrabajo,
  consultando,
  conComprobacion = false,
  enComprobacion = false,
  enCabecera = false,
}: {
  resumenes: ResumenPaso[]
  /**
   * Los pasos de la ruta entera (tarea 302). Con una pregunta sin
   * responder pueden ser más que los que ya se conocen: los que faltan van
   * como segmentos pendientes, sin nombre. null si todavía no se sabe.
   */
  total?: number | null
  /** El paso a la vista, o null en la comprobación final. */
  indiceVisto: number | null
  indiceTrabajo: number | null
  consultando: boolean
  /** ¿La guía tiene comprobación final? Entonces lleva su segmento al final. */
  conComprobacion?: boolean
  /** ¿Se está en la comprobación final? Su segmento es el que se ve. */
  enComprobacion?: boolean
  /** ¿Va en la cabecera compacta (con su margen) o en el cuerpo? */
  enCabecera?: boolean
}) {
  const porConocer = Math.max(0, (total ?? resumenes.length) - resumenes.length)
  if (resumenes.length + porConocer + (conComprobacion ? 1 : 0) < 2) return null
  return (
    <div aria-hidden data-segmentos-pasos className={`flex gap-1 md:hidden ${enCabecera ? 'px-3.5 pb-2.5 pt-0.5' : 'pt-1.5'}`}>
      {resumenes.map((resumen) => {
        let clase = resumen.estado === 'hecho' ? 'bg-noct-accent' : 'bg-noct-neutral-700'
        if (consultando && resumen.indice === indiceTrabajo) clase = 'bg-noct-neutral-400'
        if (resumen.indice === indiceVisto) clase = consultando ? 'bg-noct-precaucion' : 'bg-noct-text'
        return <span key={resumen.id} className={`h-1 min-w-0 flex-1 rounded-sm ${clase}`} />
      })}
      {Array.from({ length: porConocer }, (_, i) => (
        <span key={`por-conocer-${i}`} className="h-1 min-w-0 flex-1 rounded-sm bg-noct-neutral-700" />
      ))}
      {conComprobacion && (
        <span
          data-segmento-comprobacion
          className={`h-1 min-w-0 flex-1 rounded-sm ${enComprobacion ? 'bg-noct-text' : 'bg-noct-neutral-700'}`}
        />
      )}
    </div>
  )
}

export type EstadoLinea =
  | { tipo: 'consulta' }
  // `totalPasos` es null mientras el total dependa de una respuesta (tarea 302).
  | { tipo: 'retomada'; numeroPaso: number; totalPasos: number | null; onEmpezarDeNuevo: () => void }
  | { tipo: 'borrador' }

/** La línea de estado de la ejecución, o nada si no hay nada que decir. */
export function LineaDeEstado({ estado }: { estado: EstadoLinea | null }) {
  if (!estado) return null

  if (estado.tipo === 'consulta') {
    return (
      <p role="status" className="flex min-h-11 items-center gap-2 text-[13px] leading-snug text-noct-precaucion">
        <Eye size={15} className="shrink-0" aria-hidden />
        Solo consulta · no se marca nada
      </p>
    )
  }

  if (estado.tipo === 'retomada') {
    return (
      <div className="flex min-h-11 items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-snug text-noct-neutral-400">
          <ClockCounterClockwise size={14} className="shrink-0" aria-hidden />
          <span className="min-w-0">
            Retomando · paso {estado.numeroPaso}
            {estado.totalPasos !== null && ` de ${estado.totalPasos}`}
          </span>
        </p>
        <button
          type="button"
          onClick={estado.onEmpezarDeNuevo}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1.5 text-[13px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
        >
          Empezar de nuevo
        </button>
      </div>
    )
  }

  // EJECUTAR UN BORRADOR SE DICE, NO SE IMPIDE (encargo del 2026-09-20,
  // tarea 2). Neutro: un borrador no es un riesgo.
  return (
    <p className="flex items-center gap-2 py-2 text-[12.5px] leading-snug text-noct-neutral-400">
      <PencilSimple size={13} className="shrink-0" aria-hidden />
      Borrador · algunos datos todavía están por confirmar.
    </p>
  )
}
