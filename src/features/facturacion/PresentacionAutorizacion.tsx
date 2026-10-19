import { Link } from 'react-router-dom'
import { CaretRight } from '../../components/iconos'
import { PastillaEstado, type TonoPastilla } from '../../components/PastillaEstado'
import type { AutorizacionFacturacion, EstadoAutorizacion } from '../../lib/db'
import { etiquetaEstadoAutorizacion, textoRango } from '../../lib/autorizaciones'
import { fechaConAnio } from '../../lib/mantenimientos'
import type { EstadoConOrigen } from '../../lib/origenNavegacion'
import { useEsAncho } from '../../components/useEsAncho'

// CÓMO SE VE UNA AUTORIZACIÓN DE FACTURACIÓN EN UNA LISTA (tarea 321).
//
// La fila responde lo que hay que saber frente al POS sin abrir nada: el
// prefijo, el rango, el estado y, si está confirmado, el vencimiento. El
// estado va en su pastilla con su palabra: "Documentada, por validar" en
// ámbar y "En conflicto" en rojo dicen solos que piden revisión; nunca se
// confía solo en el color.

// El tono de cada estado en la pastilla de siempre (`PastillaEstado`, desde
// la tarea 343; antes una pastilla propia con los mismos colores).
const TONO_ESTADO: Record<EstadoAutorizacion, TonoPastilla> = {
  documentada: 'precaucion',
  confirmada: 'exito',
  conflicto: 'error',
  reemplazada: 'neutro',
}

// Desde 768, la pastilla propia de siempre, con sus mismos colores (tarea
// 345: desde 768 la presentación no cambia).
const CLASES_DESDE_768: Record<EstadoAutorizacion, string> = {
  documentada: 'border-noct-precaucion/40 text-noct-precaucion',
  confirmada: 'border-noct-exito/40 text-noct-exito',
  conflicto: 'border-noct-error/40 text-noct-error',
  reemplazada: 'border-noct-divider text-noct-neutral-400',
}

/**
 * La pastilla del estado: palabra completa, borde de su tono. `conPunto`
 * (tarea 343): en el teléfono, con su punto delante, como el carnet de la
 * autorización del handoff. En el teléfono es `PastillaEstado`; desde 768,
 * la de antes (tarea 345). La palabra es la misma en los dos.
 */
export function PastillaEstadoAutorizacion({ estado, conPunto = false }: { estado: EstadoAutorizacion; conPunto?: boolean }) {
  const ancho = useEsAncho()
  if (ancho) {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] max-md:text-[12px] font-medium leading-[1.5] ${CLASES_DESDE_768[estado]}`}
      >
        {etiquetaEstadoAutorizacion(estado)}
      </span>
    )
  }
  return (
    <PastillaEstado tono={TONO_ESTADO[estado]} conPunto={conPunto}>
      {etiquetaEstadoAutorizacion(estado)}
    </PastillaEstado>
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
  // EN EL TELÉFONO, LA FILA DEL HANDOFF (tarea 343): 72 de alto, el prefijo
  // en IBM Plex Mono a 17/600 con su estado, el contexto a 13, el galón de
  // pantalla y la respuesta al tocar. Desde 768, la de siempre. Desde la
  // tarea 345 la pastilla lleva su punto, como en la ficha, y el contexto va
  // en una línea, "Rango … · POS" (handoff, sección 08), con el vencimiento
  // confirmado debajo si lo hay.
  const ancho = useEsAncho()
  return (
    <Link
      to={`/facturacion/${autorizacion.id}`}
      state={origen}
      className="flex min-h-12 items-center gap-3 py-2 text-noct-text hover:bg-noct-text/[.05] max-md:min-h-[72px] max-md:py-2.5 max-md:active:bg-noct-presionado"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 max-md:gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14px] font-medium leading-[1.35] [overflow-wrap:anywhere] max-md:font-mono max-md:text-[17px] max-md:font-semibold">
            {autorizacion.prefijo}
          </span>
          <PastillaEstadoAutorizacion estado={autorizacion.estado} conPunto />
        </span>
        {ancho ? (
          <>
            <span className="text-[12.5px] text-noct-neutral-400 [overflow-wrap:anywhere] max-md:text-[13px]">
              {rango ? `Rango ${rango}` : 'Sin rango documentado'}
              {vence && <span className="text-noct-neutral-300"> · {vence}</span>}
            </span>
            {pos !== undefined && (
              <span className="text-[12px] text-noct-neutral-500 [overflow-wrap:anywhere] max-md:text-[13px] max-md:text-noct-neutral-400">
                {pos || 'Sin POS asociado'}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[14px] leading-snug text-noct-neutral-300 [overflow-wrap:anywhere]">
              {rango ? `Rango ${rango}` : 'Sin rango documentado'}
              {pos !== undefined && ` · ${pos || 'Sin POS asociado'}`}
            </span>
            {vence && <span className="text-[13px] text-noct-neutral-400">{vence}</span>}
          </>
        )}
      </span>
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300 max-md:hidden" aria-hidden>
        Ver
      </span>
      <CaretRight size={14} className="shrink-0 text-noct-neutral-500 md:hidden" aria-hidden />
    </Link>
  )
}
