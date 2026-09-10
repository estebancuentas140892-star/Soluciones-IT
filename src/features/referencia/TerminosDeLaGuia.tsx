import { useMemo, useState } from 'react'
import { BookBookmark, CaretDown, CaretUp } from '../../components/iconos'
import type { Procedimiento } from '../../lib/db'
import { HojaReferencia } from './HojaReferencia'
import { referenciasDelProcedimiento, tipoEfectivo, tituloEfectivo } from './referencias'
import { useReferencias } from './useReferencias'

// "TERMINOS DE ESTA GUIA", EN LA PRESENTACION.
//
// La ficha de una guia sirve para DECIDIR si esta es la guia correcta
// (encargo del 2026-09-10, tarea 2), y parte de esa decision es saber
// si uno entiende el vocabulario que va a encontrar. Este control lo
// responde antes de empezar.
//
// Dos condiciones, las dos del encargo:
//
//   - solo aparece si la guia tiene terminos vinculados. Sin ellos no
//     hay control, ni vacio ni desactivado;
//   - al abrirlo se ve una lista breve y NADA MAS: los nombres y su
//     definicion corta. Ni los pasos, ni las tareas, ni en que punto se
//     usa cada uno. Eso es el procedimiento, y el procedimiento se lee
//     donde se ejecuta.
//
// Solo lista TERMINOS: los atajos y los comandos se presentan dentro de
// su tarea, con las teclas o el comando delante, y sacarlos aqui
// invitaria a teclearlos fuera de contexto.

export function TerminosDeLaGuia({ procedimiento }: { procedimiento: Procedimiento | null }) {
  const referencias = useReferencias()
  const [abierto, setAbierto] = useState(false)
  const [detalleId, setDetalleId] = useState<string | null>(null)

  const vinculos = useMemo(() => referenciasDelProcedimiento(procedimiento), [procedimiento])
  const terminos = useMemo(
    () => vinculos.filter((vinculo) => tipoEfectivo(vinculo, referencias) === 'termino'),
    [vinculos, referencias],
  )

  if (terminos.length === 0) return null

  const detalle = detalleId ? terminos.find((t) => t.id === detalleId) : null

  return (
    <section>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex min-h-[46px] w-full items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3 text-left text-noct-text hover:bg-noct-text/[.04]"
      >
        <BookBookmark size={17} className="shrink-0 text-noct-accent-300" aria-hidden />
        <span className="min-w-0 flex-1 text-[13.5px] font-medium">Términos de esta guía</span>
        <span className="shrink-0 text-[12px] text-noct-neutral-400">{terminos.length}</span>
        {abierto ? (
          <CaretUp size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        ) : (
          <CaretDown size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
        )}
      </button>

      {abierto && (
        <div className="mt-1.5 flex flex-col">
          {terminos.map((vinculo) => {
            const viva = referencias.get(vinculo.id)
            return (
              <button
                key={vinculo.id}
                type="button"
                onClick={() => setDetalleId(vinculo.id)}
                aria-haspopup="dialog"
                className="flex min-h-[46px] flex-col justify-center rounded-md px-1.5 py-2 text-left hover:bg-noct-text/[.05]"
              >
                <span className="text-[13.5px] font-medium text-noct-text">
                  {tituloEfectivo(vinculo, referencias)}
                  {viva?.abreviatura && (
                    <span className="font-normal text-noct-neutral-400"> ({viva.abreviatura})</span>
                  )}
                </span>
                {viva?.definicion ? (
                  <span className="mt-0.5 text-pretty text-[12.5px] leading-snug text-noct-neutral-400">
                    {viva.definicion}
                  </span>
                ) : (
                  !viva && (
                    <span className="mt-0.5 text-[12px] text-noct-neutral-600">No disponible aquí</span>
                  )
                )}
              </button>
            )
          })}
        </div>
      )}

      {detalle && (
        <HojaReferencia
          abierto
          onCerrar={() => setDetalleId(null)}
          referenciaId={detalle.id}
          tituloRespaldo={detalle.titulo}
          referencias={referencias}
        />
      )}
    </section>
  )
}
