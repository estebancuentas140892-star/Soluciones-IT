import { useLayoutEffect, useState } from 'react'
import { useAvisoFlotante, type IconoAviso } from './avisosFlotantes'
import { Check, ClockCounterClockwise, Copy, LockSimple } from './iconos'
import { useHuecoAvisoActualizacion } from './ranuraAvisoActualizacion'

const ICONOS: Record<IconoAviso, typeof Check> = {
  hecho: Check,
  copiado: Copy,
  candado: LockSimple,
  historial: ClockCounterClockwise,
}

// El aviso flotante del teléfono (tarea 341; el almacén y su porqué en
// `avisosFlotantes.ts`). Invertido (fondo en el color del texto, texto en el
// del fondo), radio 14, 14/600 con su icono, y SOBRE EL PIE FIJO: encima del
// hueco que ya publican las barras de acción y la franja del chasis para el
// aviso de versión nueva (`ranuraAvisoActualizacion.ts`), así que nunca tapa
// la acción de la pantalla. Sin hueco, a 16 px del borde.
//
// Se monta una vez, en la raíz de la app. La región `status` existe siempre
// para que el lector de pantalla anuncie cada aviso nuevo; no roba el foco
// ni recibe toques. Desde 768 px no se ve (lo aprobado para tableta y
// escritorio no lleva avisos), pero se sigue anunciando.
export function AvisoFlotante() {
  const aviso = useAvisoFlotante()
  const hueco = useHuecoAvisoActualizacion()
  const [abajo, setAbajo] = useState<number | null>(null)

  // Se mide al aparecer y cuando cambia el hueco (salir de la guía con la X
  // muestra el aviso y luego navega a una pantalla con otra barra).
  useLayoutEffect(() => {
    if (!aviso) return
    const borde = bordeDelPie(hueco)
    setAbajo(borde !== null && borde > 0 ? Math.max(0, window.innerHeight - borde) + 10 : null)
  }, [aviso, hueco])

  const Icono = aviso ? ICONOS[aviso.icono] : null
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="nocturne pointer-events-none fixed inset-x-3 z-[70] flex justify-center font-inter md:sr-only"
      style={{ bottom: abajo === null ? 'calc(env(safe-area-inset-bottom) + 16px)' : `${abajo}px` }}
    >
      {aviso && Icono && (
        <div
          key={aviso.id}
          data-aviso-flotante
          className="flex max-w-full items-center gap-2.5 rounded-[14px] bg-noct-text px-4 py-3 text-[14px] font-semibold leading-[1.3] text-noct-bg shadow-[0_10px_30px_rgb(0_0_0/0.35)]"
        >
          <Icono size={17} aria-hidden className="shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{aviso.texto}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Dónde empieza el pie fijo, en px desde arriba, o null si no hay pie. Un
 * hueco vacío no se dibuja (`empty:hidden`) y no mide nada: entonces cuenta
 * su sitio. La franja del chasis es pegajosa, así que su sitio es su
 * `bottom` (sobre las pestañas); el hueco de una barra de acciones vive
 * dentro de ella, así que su sitio es la barra.
 */
function bordeDelPie(hueco: HTMLElement | null): number | null {
  if (!hueco) return null
  const caja = hueco.getBoundingClientRect()
  if (caja.height > 0) return caja.top
  const estilo = getComputedStyle(hueco)
  if (estilo.position === 'sticky' || estilo.position === 'fixed') {
    const desdeAbajo = parseFloat(estilo.bottom)
    return Number.isFinite(desdeAbajo) ? window.innerHeight - desdeAbajo : null
  }
  const barra = hueco.parentElement?.getBoundingClientRect()
  return barra && barra.height > 0 ? barra.top : null
}
