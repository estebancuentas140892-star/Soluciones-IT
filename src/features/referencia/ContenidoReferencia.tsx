import type { ReactNode } from 'react'
import { TagNeutral } from '../../components/nocturne'
import type { Referencia } from '../../lib/db'
import { EstadoUso } from './EstadoUso'

// LO QUE SE LEE DE UNA FICHA SIN ABRIRLA.
//
// Nació dentro de `HojaReferencia` (la hoja que se abre desde una tarea
// de una guía) y se separó el 2026-09-16 para que el buscador en modo
// consulta enseñe EXACTAMENTE lo mismo sin salir de su capa: una
// definición no puede decir una cosa en la hoja y otra en el buscador.
//
// Una herramienta muestra lo que se lee primero en su ficha: qué es, para
// qué sirve y cómo se usa en Metroparques, con lo que se sabe de ese uso.
//
// No navega a ningún sitio. Las fichas relacionadas solo se listan cuando
// quien la pinta sabe recorrerlas sin salir (`onAbrirRelacionada`).

export function ContenidoReferencia({
  referencia,
  referencias,
  onAbrirRelacionada,
}: {
  referencia: Referencia
  /** Fichas vivas por id, para nombrar las relacionadas. */
  referencias?: Map<string, Referencia>
  /** Cambia a una ficha relacionada dentro del mismo contenedor. */
  onAbrirRelacionada?: (id: string) => void
}) {
  const esHerramienta = referencia.tipo === 'herramienta'

  return (
    <div className="flex flex-col gap-3.5">
      {referencia.definicion && (
        <p className="text-pretty text-[14.5px] leading-[1.55] text-noct-text">{referencia.definicion}</p>
      )}

      {esHerramienta && referencia.cuandoUsar && (
        <Bloque titulo="¿Para qué sirve?">
          <p className="text-pretty text-[13.5px] leading-[1.55] text-noct-neutral-200">{referencia.cuandoUsar}</p>
        </Bloque>
      )}

      {esHerramienta && (referencia.usoEnMetroparques || referencia.estadoUso) && (
        <Bloque titulo="En Metroparques">
          <div className="flex flex-col gap-1.5">
            {referencia.usoEnMetroparques && (
              <p className="text-pretty text-[13.5px] leading-[1.55] text-noct-neutral-200">
                {referencia.usoEnMetroparques}
              </p>
            )}
            <EstadoUso estado={referencia.estadoUso} />
          </div>
        </Bloque>
      )}

      {esHerramienta && referencia.notas && (
        <Bloque titulo="Notas">
          <p className="text-pretty text-[13.5px] leading-[1.55] text-noct-neutral-200">{referencia.notas}</p>
        </Bloque>
      )}

      {referencia.valor && (
        <p className="break-all rounded-lg bg-noct-bg px-3 py-2.5 font-mono text-[13.5px] leading-normal text-noct-text">
          {referencia.valor}
        </p>
      )}

      {referencia.ejemplo && (
        <Bloque titulo="Ejemplo">
          <p className="text-pretty rounded-lg bg-noct-bg px-3 py-2.5 text-[13px] leading-[1.55] text-noct-neutral-200">
            {referencia.ejemplo}
          </p>
        </Bloque>
      )}

      {(referencia.alias ?? []).length > 0 && (
        <Bloque titulo="También se llama">
          <div className="flex flex-wrap gap-1.5">
            {referencia.alias.map((alias) => (
              <TagNeutral key={alias}>{alias}</TagNeutral>
            ))}
          </div>
        </Bloque>
      )}

      {onAbrirRelacionada && referencias && (referencia.relacionadas ?? []).length > 0 && (
        <Bloque titulo="Relacionado">
          <div className="flex flex-col">
            {referencia.relacionadas.map((relacionada) => {
              const viva = referencias.get(relacionada.id)
              return (
                <button
                  key={relacionada.id}
                  type="button"
                  disabled={!viva}
                  onClick={() => onAbrirRelacionada(relacionada.id)}
                  className="flex min-h-11 items-center rounded-md px-1.5 text-left text-[13.5px] text-noct-text hover:bg-noct-text/[.06] disabled:text-noct-neutral-500 disabled:hover:bg-transparent"
                >
                  <span className="min-w-0 flex-1">
                    {viva?.titulo || relacionada.titulo}
                    {!viva && <span className="text-[12px] text-noct-neutral-600"> (no disponible)</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </Bloque>
      )}

      {referencia.advertencia && (
        <p className="rounded-r-lg border-l-2 border-noct-precaucion bg-noct-precaucion/10 px-3 py-2.5 text-[13px] leading-normal">
          <span className="font-semibold text-noct-precaucion">Precaución.</span> {referencia.advertencia}
        </p>
      )}
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[.08em] text-noct-neutral-500">{titulo}</p>
      {children}
    </div>
  )
}
