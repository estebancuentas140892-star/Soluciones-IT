import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CaretDown, CaretRight, Warning } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { IconoNodo } from './IconoNodo'
import type { NodoTopologia } from './arbol'
import { claseEstado, detalleDeNodo, estadoConEtiqueta, tipoDeNodoVisual } from './topologiaVisual'
import type { ChipImpacto, PadreDeNodo } from './useNodoRed'

// La vecindad de un nodo de la topología: de qué depende, qué cae si
// falla y qué depende de él.
//
// Estaba dentro de `TopologiaEquipoPage`. Sale de ahí en la tarea 204
// (hallazgo M-018) porque la pestaña Red pasó a abrir con esta misma
// pantalla: es lo que la auditoría llama "el hallazgo que ahorra
// trabajo", la pantalla que Red necesitaba ya estaba construida, solo
// estaba a tres toques. Copiarla habría dejado dos versiones del mismo
// bloque condenadas a divergir.
//
// Lo único que cambia entre las dos pantallas es A DÓNDE lleva tocar un
// equipo, y por eso es una prop: en la topología de un equipo se abre su
// ficha (con origen, para que el regreso deshaga un salto, regla M-R2);
// en la pestaña Red se sustituye el nodo en su sitio y se sigue
// recorriendo.

/** A dónde lleva tocar un equipo, y con qué estado de navegación. */
export type EnlaceANodo = (dispositivoId: string) => { to: string; state?: unknown }

export function NodoRed({
  dependeDe,
  chipsImpacto,
  totalDependientes,
  arbol,
  nombreCategoria,
  enlaceANodo,
}: {
  dependeDe: PadreDeNodo[]
  chipsImpacto: ChipImpacto[]
  totalDependientes: number
  arbol: NodoTopologia
  nombreCategoria: Map<string, string>
  enlaceANodo: EnlaceANodo
}) {
  return (
    <>
      {dependeDe.length > 0 && (
        <section>
          <TituloSeccion className="mb-2">Depende de</TituloSeccion>
          <div className="flex flex-col">
            {dependeDe.map((p) => {
              const enlace = enlaceANodo(p.id)
              return (
                <Link
                  key={`${p.id}-${p.via}`}
                  to={enlace.to}
                  state={enlace.state}
                  className="flex min-h-12 items-center gap-[11px] rounded-md px-1.5 py-2 text-noct-text hover:bg-noct-text/[.05]"
                >
                  <FlechaCodoArriba className="w-6 shrink-0 text-noct-neutral-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium leading-[1.3]">{p.nombre}</span>
                    <span className="mt-px block text-[11.5px] text-noct-neutral-500">{p.via}</span>
                  </span>
                  <CaretRight size={14} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {chipsImpacto.length > 0 && (
        <section>
          <TituloSeccion className="mb-2">Si este equipo falla</TituloSeccion>
          <div className="rounded-lg border border-noct-precaucion/[.35] bg-noct-precaucion/[.08] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[13px] leading-normal text-noct-neutral-300">
              <Warning size={14} className="shrink-0 text-noct-precaucion" aria-hidden />
              También quedarían sin servicio{' '}
              <strong className="font-medium">
                {totalDependientes} {totalDependientes === 1 ? 'equipo' : 'equipos'}
              </strong>
              :
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {chipsImpacto.map((chip) => (
                <span
                  key={chip.categoriaId}
                  className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-noct-divider px-2.5 text-[12px] text-noct-neutral-300"
                >
                  <IconoNodo
                    tipo={tipoDeNodoVisual(chip.categoria)}
                    className="h-[13px] w-[13px] text-noct-neutral-400"
                  />
                  {chip.texto}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {arbol.hijos.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <TituloSeccion>Dependen de este equipo</TituloSeccion>
            <span className="text-[11px] text-noct-neutral-600">
              {totalDependientes} {totalDependientes === 1 ? 'equipo depende' : 'equipos dependen'}
            </span>
          </div>
          <ArbolDependientes nodo={arbol} nombreCategoria={nombreCategoria} enlaceANodo={enlaceANodo} />
        </section>
      )}
    </>
  )
}

// Árbol de descendientes: filas indentadas con caret para expandir o
// contraer, icono por tipo de equipo, detalle de cómo conecta con su
// padre y punto de estado. Todas las ramas arrancan abiertas; el
// técnico contrae lo que no necesita. Se clavea por camino (no por id)
// porque el mismo equipo puede aparecer en dos ramas.
function ArbolDependientes({
  nodo,
  nombreCategoria,
  enlaceANodo,
}: {
  nodo: NodoTopologia
  nombreCategoria: Map<string, string>
  enlaceANodo: EnlaceANodo
}) {
  const [contraidos, setContraidos] = useState<ReadonlySet<string>>(new Set())

  function alternar(clave: string) {
    setContraidos((previos) => {
      const siguientes = new Set(previos)
      if (siguientes.has(clave)) siguientes.delete(clave)
      else siguientes.add(clave)
      return siguientes
    })
  }

  return (
    <div className="flex flex-col">
      {nodo.hijos.map((hijo) => (
        <FilaArbol
          key={`${hijo.dispositivoId}·${hijo.via}`}
          nodo={hijo}
          nivel={0}
          clave={`${hijo.dispositivoId}·${hijo.via}`}
          contraidos={contraidos}
          alternar={alternar}
          nombreCategoria={nombreCategoria}
          enlaceANodo={enlaceANodo}
        />
      ))}
    </div>
  )
}

function FilaArbol({
  nodo,
  nivel,
  clave,
  contraidos,
  alternar,
  nombreCategoria,
  enlaceANodo,
}: {
  nodo: NodoTopologia
  nivel: number
  clave: string
  contraidos: ReadonlySet<string>
  alternar: (clave: string) => void
  nombreCategoria: Map<string, string>
  enlaceANodo: EnlaceANodo
}) {
  const tieneHijos = nodo.hijos.length > 0
  const abierto = tieneHijos && !contraidos.has(clave)
  const categoria = nombreCategoria.get(nodo.categoriaId) ?? ''
  const detalle = detalleDeNodo({ via: nodo.via, medio: nodo.medio })
  const estado = estadoConEtiqueta(nodo.estado)
  const enlace = enlaceANodo(nodo.dispositivoId)

  return (
    <>
      <div
        className="flex min-h-[50px] items-center gap-2 rounded-md py-1.5 pr-1"
        style={{ paddingLeft: `${4 + nivel * 20}px` }}
      >
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => alternar(clave)}
            aria-expanded={abierto}
            aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${nodo.nombre}`}
            className="flex min-h-11 w-[34px] shrink-0 items-center justify-center rounded-md text-noct-neutral-400 hover:bg-noct-text/[.06] hover:text-noct-text"
          >
            {abierto ? <CaretDown size={15} aria-hidden /> : <CaretRight size={15} aria-hidden />}
          </button>
        ) : (
          <span className="flex w-[34px] shrink-0 justify-center" aria-hidden>
            <span className="h-[5px] w-[5px] rounded-full bg-noct-neutral-700" />
          </span>
        )}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400">
          <IconoNodo tipo={tipoDeNodoVisual(categoria)} className="h-4 w-4" />
        </span>
        <Link to={enlace.to} state={enlace.state} className="min-w-0 flex-1 text-noct-text">
          <span className="block truncate text-[13.5px] font-medium leading-[1.3]">
            {nodo.nombre}
            {nodo.truncado && (
              <span className="ml-1 text-noct-precaucion" title="Ya aparece más arriba">
                ↺
              </span>
            )}
          </span>
          {detalle && <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">{detalle}</span>}
        </Link>
        <span
          title={estado.etiqueta}
          className={`h-[7px] w-[7px] shrink-0 rounded-full bg-current ${claseEstado(estado.etiqueta)}`}
        />
      </div>
      {abierto &&
        nodo.hijos.map((hijo) => (
          <FilaArbol
            key={`${clave}/${hijo.dispositivoId}·${hijo.via}`}
            nodo={hijo}
            nivel={nivel + 1}
            clave={`${clave}/${hijo.dispositivoId}·${hijo.via}`}
            contraidos={contraidos}
            alternar={alternar}
            nombreCategoria={nombreCategoria}
            enlaceANodo={enlaceANodo}
          />
        ))}
    </>
  )
}

// Flecha de codo hacia arriba (ph-arrow-elbow-left-up del mockup):
// glifo local decorativo para la sección "Depende de", como los
// chevrons inline de TopologiaPage. No entra al set de iconos de
// dominio (regenerable) por ser exclusivo de estas pantallas.
function FlechaCodoArriba({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <path d="M14 20H9a3 3 0 0 1-3-3V8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3 11 3-4 3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
