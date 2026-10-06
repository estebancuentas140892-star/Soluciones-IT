import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Boton } from './Boton'
import { avisoBreveVigente, DURACION_AVISO_BREVE_MS, retirarAvisoBreve, suscribirAvisoBreve } from './almacenAvisoBreve'
import { CheckCircle } from './iconos'

// EL AVISO BREVE (tarea 291, auditoría UX, S6): la línea que lo pinta.
// La regla, el almacén y `avisarBreve()` están en `almacenAvisoBreve.ts`.

// Lo que ocupa el borde inferior de la pantalla: las pestañas del chasis y
// las barras propias de una pantalla, que se marcan con
// `data-borde-inferior`. El aviso se pinta 12 px por encima de la más alta.
function alturaBordeInferior(): number {
  let alto = 0
  for (const elemento of document.querySelectorAll<HTMLElement>('[data-borde-inferior]')) {
    const caja = elemento.getBoundingClientRect()
    if (caja.height === 0) continue
    alto = Math.max(alto, window.innerHeight - caja.top)
  }
  return alto
}

export function AvisosBreves() {
  const aviso = useSyncExternalStore(suscribirAvisoBreve, avisoBreveVigente, () => null)
  const [desde, setDesde] = useState(16)

  useEffect(() => {
    if (!aviso) return
    const temporizador = window.setTimeout(() => {
      if (avisoBreveVigente()?.id === aviso.id) retirarAvisoBreve()
    }, DURACION_AVISO_BREVE_MS)
    return () => window.clearTimeout(temporizador)
  }, [aviso])

  useLayoutEffect(() => {
    if (!aviso) return
    const medir = () => setDesde(Math.max(16, alturaBordeInferior() + 12))
    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [aviso])

  return createPortal(
    // La región viva existe siempre (vacía si no hay aviso): un lector de
    // pantalla anuncia lo que entra en una región que ya estaba, no una
    // que aparece con el texto dentro.
    <div role="status" aria-live="polite" className="nocturne font-inter">
      {aviso && (
        <div
          key={aviso.id}
          style={{ bottom: desde }}
          className="fixed inset-x-3 z-[55] flex min-h-12 items-center gap-2.5 rounded-[10px] border border-noct-divider bg-noct-surface py-1 pr-1.5 pl-3.5 text-sm text-noct-text shadow-lg md:right-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2"
        >
          <CheckCircle size={17} className="shrink-0 text-noct-exito" aria-hidden />
          <span className="min-w-0 flex-1 text-pretty py-2">{aviso.texto}</span>
          {aviso.accion && (
            <Boton
              papel="texto"
              onClick={() => {
                retirarAvisoBreve()
                aviso.accion?.onClick()
              }}
            >
              {aviso.accion.texto}
            </Boton>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
