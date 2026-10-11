import { Link } from 'react-router-dom'
import type { AutorizacionFacturacion, EstadoAutorizacion } from '../../lib/db'
import { etiquetaEstadoAutorizacion, textoRango } from '../../lib/autorizaciones'
import { fechaConAnio } from '../../lib/mantenimientos'
import type { EstadoConOrigen } from '../../lib/origenNavegacion'

// CÓMO SE VE UNA AUTORIZACIÓN DE FACTURACIÓN EN UNA LISTA (tarea 321).
//
// La fila responde lo que hay que saber frente al POS sin abrir nada: el
// prefijo, el rango, el estado y, si está confirmado, el vencimiento. El
// estado va en su pastilla con su palabra: "Documentada, por validar" en
// ámbar y "En conflicto" en rojo dicen solos que piden revisión; nunca se
// confía solo en el color.

const TONO_ESTADO: Record<EstadoAutorizacion, string> = {
  documentada: 'border-noct-precaucion/40 text-noct-precaucion',
  confirmada: 'border-noct-exito/40 text-noct-exito',
  conflicto: 'border-noct-error/40 text-noct-error',
  reemplazada: 'border-noct-divider text-noct-neutral-400',
}

/** La pastilla del estado: palabra completa, borde de su tono. */
export function PastillaEstadoAutorizacion({ estado }: { estado: EstadoAutorizacion }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] font-medium leading-[1.5] ${TONO_ESTADO[estado]}`}
    >
      {etiquetaEstadoAutorizacion(estado)}
    </span>
  )
}

export function FilaAutorizacion({
  autorizacion,
  pos,
  origen,
}: {
  autorizacion: AutorizacionFacturacion
  /**
   * Los POS que la usan, ya escritos ("POSPN01, POSPN02"), solo en la
   * lista general: dentro de la ficha de un POS sobra. '' dice que no
   * tiene ninguno.
   */
  pos?: string
  origen?: EstadoConOrigen
}) {
  const rango = textoRango(autorizacion)
  const vence =
    autorizacion.estado === 'confirmada' && autorizacion.vencimientoConfirmado
      ? `Vence el ${fechaConAnio(autorizacion.vencimientoConfirmado)}`
      : ''
  return (
    <Link
      to={`/facturacion/${autorizacion.id}`}
      state={origen}
      className="flex min-h-12 items-center gap-3 py-2 text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] font-medium leading-[1.35] [overflow-wrap:anywhere]">{autorizacion.prefijo}</span>
          <PastillaEstadoAutorizacion estado={autorizacion.estado} />
        </span>
        <span className="text-[12.5px] text-noct-neutral-400 [overflow-wrap:anywhere]">
          {rango ? `Rango ${rango}` : 'Sin rango documentado'}
          {vence && <span className="text-noct-neutral-300"> · {vence}</span>}
        </span>
        {pos !== undefined && (
          <span className="text-[12px] text-noct-neutral-500 [overflow-wrap:anywhere]">
            {pos || 'Sin POS asociado'}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300" aria-hidden>
        Ver
      </span>
    </Link>
  )
}
