import { useId, useState } from 'react'
import type { VinculoProtegido } from '../../lib/db'
import { Key, LockSimple, X } from '../../components/iconos'
import { Modal } from '../../components/Modal'
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
  const idTitulo = useId()
  const titulo = useTituloDelVinculo(vinculo) || (vinculo.tipo === 'equipo' ? 'Credencial del equipo' : 'Credencial')

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
        <LockSimple size={13} className="shrink-0" aria-hidden />
        Credencial
      </p>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Ver la credencial: ${titulo}`}
        onClick={() => setAbierta(true)}
        className="flex min-h-[58px] w-full min-w-0 items-center gap-3 rounded-[14px] border-[1.5px] border-noct-text/25 py-1.5 pl-3.5 pr-2 text-left hover:bg-noct-text/[.04] active:bg-noct-text/[.07]"
      >
        <Key size={19} className="shrink-0 text-noct-neutral-300" aria-hidden />
        <span className="min-w-0 flex-1">
          {/* El nombre no se recorta (regla 23): crece en altura. */}
          <span className="block text-[15px] font-semibold leading-snug text-pretty [overflow-wrap:anywhere]">
            {titulo}
          </span>
          <span className="block text-[12.5px] leading-snug text-noct-neutral-400">Se abre aquí, sin salir de la guía</span>
        </span>
        <span
          aria-hidden
          className="flex min-h-10 shrink-0 items-center rounded-[10px] bg-noct-accent/[.14] px-3 text-[14px] font-semibold text-noct-accent-300"
        >
          Ver
        </span>
      </button>

      <Modal abierto={abierta} onCerrar={() => setAbierta(false)} tituloId={idTitulo}>
        <div className="mb-2 flex items-start gap-2">
          <h2 id={idTitulo} className="min-w-0 flex-1 pt-2 text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={() => setAbierta(false)}
            aria-label="Cerrar y volver a la guía"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
          >
            <X size={19} aria-hidden />
          </button>
        </div>
        <CredencialEnPaso vinculo={vinculo} variante="bloque" />
      </Modal>
    </div>
  )
}
