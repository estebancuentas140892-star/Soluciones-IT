import { useState } from 'react'
import type { VinculoProtegido } from '../../lib/db'
import { HojaInferior } from '../../components/HojaInferior'
import { Info, Key, LockSimple } from '../../components/iconos'
import { useEsAncho } from '../../components/useEsAncho'
import { CredencialEnPaso } from './CredencialEnPaso'
import { useTituloDelVinculo } from './useTituloDelVinculo'

// LA CREDENCIAL DE UNA ACCIÓN, COMO FILA QUE ABRE SU HOJA (rediseño móvil
// "1b Pulgar", tarea 328, AD-078).
//
// En la ejecución de una guía la credencial se CONSULTA, no se trabaja en
// ella: una fila con borde dice cuál hace falta ("Se abre aquí, sin salir de
// la guía") y "Ver" abre una hoja inferior con el bloque protegido de
// siempre (`CredencialEnPaso`, variante `bloque`). Antes el bloque iba en el
// cuerpo de la acción y, al desbloquear y mostrar, empujaba hacia abajo todo
// lo demás.
//
// La hoja no cambia nada de la Bóveda (regla 29, AD-073): pide el permiso,
// la contraseña maestra y el autobloqueo de siempre, registra cada consulta y
// ofrece "Bloquear Bóveda" cuando está abierta. Cerrarla, bloquear o volver a
// mostrar no mueve la guía: la acción, el avance y el paso siguen debajo,
// intactos. El nombre es el mismo que dice la hoja (`useTituloDelVinculo`).
export function CredencialEnHoja({ vinculo }: { vinculo: VinculoProtegido }) {
  const [abierta, setAbierta] = useState(false)
  const titulo = useTituloDelVinculo(vinculo) || (vinculo.tipo === 'equipo' ? 'Credencial del equipo' : 'Credencial')
  // En el teléfono la hoja tapa la guía: su línea de contexto dice que
  // consultarla no la abandona ("Sin salir de la guía", tarea 343). Desde 768
  // es un panel al costado y la guía sigue a la vista.
  const ancho = useEsAncho()

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {/* En el teléfono el rótulo va dentro de la fila, "Clave necesaria"
          (tarea 345, DESPUÉS de Claude Design). */}
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400 max-md:hidden">
        <LockSimple size={13} className="shrink-0" aria-hidden />
        Credencial
      </p>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierta}
        aria-label={`Ver la credencial: ${titulo}`}
        onClick={() => setAbierta(true)}
        // Desde 768 px la hoja es un panel al costado y la guía sigue a la
        // vista (tarea 339): la fila que lo abrió queda con el tinte de acento.
        className={`flex min-h-[58px] w-full min-w-0 items-center gap-3 rounded-[14px] border-[1.5px] border-noct-text/25 py-1.5 pl-3.5 pr-2 text-left hover:bg-noct-text/[.04] active:bg-noct-text/[.07] max-md:min-h-[68px] max-md:bg-noct-surface max-md:py-3 max-md:pr-3.5 ${
          abierta ? 'md:border-noct-accent/60 md:bg-noct-accent/[.12]' : ''
        }`}
      >
        {/* En el teléfono, la llave en su caja de 40 (tarea 345). */}
        <span aria-hidden className="flex shrink-0 items-center justify-center text-noct-neutral-300 max-md:h-10 max-md:w-10 max-md:rounded-xl max-md:bg-noct-text/[.06]">
          <Key size={19} className="max-md:h-[22px] max-md:w-[22px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="hidden text-[13.5px] leading-snug text-noct-neutral-400 max-md:block">Clave necesaria</span>
          {/* El nombre no se recorta (regla 23): crece en altura. */}
          <span className="block text-[15px] font-semibold leading-snug text-pretty [overflow-wrap:anywhere] max-md:text-[16px]">
            {titulo}
          </span>
          <span className="block text-[12.5px] leading-snug text-noct-neutral-400 max-md:text-[13.5px]">
            Se abre aquí, sin salir de la guía
          </span>
        </span>
        <span
          aria-hidden
          className="flex min-h-10 shrink-0 items-center rounded-[10px] bg-noct-accent/[.14] px-3 text-[14px] font-semibold text-noct-accent-300 max-md:bg-transparent max-md:px-1 max-md:text-[15.5px]"
        >
          Ver
        </span>
      </button>

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={titulo}
        contexto={ancho ? undefined : 'Sin salir de la guía'}
        etiquetaCerrar="Cerrar y volver a la guía"
      >
        {/* EN EL TELÉFONO, EL CONTEXTO EN VOZ ALTA (tarea 345, DESPUÉS de Claude
            Design): la hoja tapa la guía, y dice que no se ha salido de ella.
            Debajo, el bloque protegido de siempre (permiso, contraseña maestra,
            autobloqueo y registro de cada consulta) y, al pie, la vuelta. */}
        {!ancho && (
          <p
            data-sin-salir-de-la-guia
            className="mb-3 flex items-start gap-2 rounded-xl bg-noct-accent/[.12] px-3 py-2.5 text-[15px] font-semibold leading-snug text-noct-accent-300"
          >
            <Info size={18} className="mt-px shrink-0" aria-hidden />
            Se abre aquí. Tu paso sigue debajo, como lo dejaste.
          </p>
        )}
        <CredencialEnPaso vinculo={vinculo} variante="bloque" />
        {!ancho && (
          <button
            type="button"
            onClick={() => setAbierta(false)}
            className="mt-3.5 flex min-h-[54px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-noct-text/25 text-[16px] font-semibold text-noct-text hover:bg-noct-text/[.05] active:bg-noct-presionado"
          >
            Volver a la guía
          </button>
        )}
      </HojaInferior>
    </div>
  )
}
