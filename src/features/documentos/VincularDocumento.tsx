import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CLASE_CAMPO_SOBRE_SUPERFICIE } from '../../components/campos'
import { Check, LinkSimple, MagnifyingGlass, X } from '../../components/iconos'
import { BTN_ICONO_SECUNDARIO, BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import { db, type Adjunto, type Dispositivo } from '../../lib/db'
import { compararNatural } from '../../lib/conexiones'
import { incluyeTexto } from '../../lib/texto'
import { camposDeBusqueda } from '../dispositivos/busquedaEquipos'
import { vincularDocumento, type DestinoVinculo } from './documentosEquipo'

// VINCULAR UN DOCUMENTO A OTROS EQUIPOS (tarea 322), dentro de una hoja de
// la pantalla del adjunto. El caso real: un acta en PDF con una página por
// equipo. Se buscan y marcan los equipos, y cada uno lleva su página o
// nota. No se sube nada: los vínculos nuevos apuntan al mismo archivo.
//
// Marcar un equipo no mueve la lista: la fila se queda donde está, con su
// casilla marcada, y la página o nota se escribe abajo, en "Se vinculará
// a" (antes la tarjeta aparecía arriba y empujaba las filas: el siguiente
// toque caía en otro equipo). Los equipos que ya lo tienen no salen. Con
// muchos equipos solo se enseñan los primeros que coinciden: escribir
// afina.

const MAXIMO_RESULTADOS = 40

export function VincularDocumento({
  adjunto,
  yaVinculados,
  alTerminar,
}: {
  adjunto: Adjunto
  /** Los equipos que ya lo tienen, el de esta pantalla incluido. */
  yaVinculados: string[]
  alTerminar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [elegidos, setElegidos] = useState<DestinoVinculo[]>([])
  const [guardando, setGuardando] = useState(false)
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [] as Dispositivo[])

  const excluidos = new Set(yaVinculados)
  const marcados = new Set(elegidos.map((e) => e.dispositivoId))
  const candidatos = dispositivos
    .filter((d) => !excluidos.has(d.id) && incluyeTexto(camposDeBusqueda(d), texto))
    .sort((a, b) => compararNatural(a.nombre, b.nombre))
  const visibles = candidatos.slice(0, MAXIMO_RESULTADOS)
  const nombrePorId = new Map(dispositivos.map((d) => [d.id, d.nombre]))

  function alternar(dispositivoId: string) {
    setElegidos((actual) =>
      actual.some((e) => e.dispositivoId === dispositivoId)
        ? actual.filter((e) => e.dispositivoId !== dispositivoId)
        : [...actual, { dispositivoId, nota: '' }],
    )
  }

  function anotar(dispositivoId: string, nota: string) {
    setElegidos((actual) => actual.map((e) => (e.dispositivoId === dispositivoId ? { ...e, nota } : e)))
  }

  async function vincular() {
    if (elegidos.length === 0 || guardando) return
    setGuardando(true)
    await vincularDocumento(adjunto, elegidos)
    alTerminar()
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="vincular-buscar" className="flex flex-col gap-2">
        <h3 id="vincular-buscar" className="text-[13px] font-semibold text-noct-neutral-400">
          Elige los equipos
        </h3>
        <label className="relative flex items-center">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 text-noct-neutral-500" aria-hidden />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar equipo"
            placeholder="Nombre, serial, placa, IP..."
            className={`min-h-11 pl-9 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
          />
        </label>
        {visibles.length === 0 ? (
          <p className="py-2 text-[13.5px] text-noct-neutral-400">
            {texto.trim() ? 'Ningún equipo coincide.' : 'No quedan equipos sin este documento.'}
          </p>
        ) : (
          <ul className="flex flex-col">
            {visibles.map((d) => {
              const marcado = marcados.has(d.id)
              return (
                <li key={d.id}>
                  {/* Casilla con la misma forma que las de la app (botón con role="checkbox"). */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcado}
                    onClick={() => alternar(d.id)}
                    className="flex min-h-11 w-full items-center gap-2.5 border-b border-noct-divider py-1.5 text-left hover:bg-noct-text/[.04]"
                  >
                    {marcado ? (
                      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-noct-accent">
                        <Check size={13} className="text-noct-bg" />
                      </span>
                    ) : (
                      <span aria-hidden className="h-5 w-5 shrink-0 rounded-md border-[1.5px] border-noct-neutral-600" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[14.5px] text-noct-text [overflow-wrap:anywhere]">{d.nombre}</span>
                      {d.ubicacion && (
                        <span className="text-[12px] leading-snug text-noct-neutral-400 [overflow-wrap:anywhere]">{d.ubicacion}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {candidatos.length > visibles.length && (
          <p className="text-[12.5px] text-noct-neutral-500">
            {candidatos.length - visibles.length} equipos más coinciden: escribe para afinar.
          </p>
        )}
      </section>

      {elegidos.length > 0 && (
        <section aria-labelledby="vincular-elegidos" className="flex flex-col gap-2.5">
          <h3 id="vincular-elegidos" className="text-[13px] font-semibold text-noct-neutral-400">
            Se vinculará a
          </h3>
          <ul className="flex flex-col gap-3">
            {elegidos.map((e) => {
              const nombre = nombrePorId.get(e.dispositivoId) ?? 'Equipo'
              return (
                <li key={e.dispositivoId} className="flex flex-col gap-1.5 rounded-xl border border-noct-divider p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[14.5px] font-medium [overflow-wrap:anywhere]">{nombre}</span>
                    <button
                      type="button"
                      onClick={() => alternar(e.dispositivoId)}
                      aria-label={`No vincular a ${nombre}`}
                      className={BTN_ICONO_SECUNDARIO}
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-noct-neutral-400">Página o nota en {nombre} (opcional)</span>
                    <input
                      type="text"
                      value={e.nota}
                      onChange={(ev) => anotar(e.dispositivoId, ev.target.value)}
                      className={`min-h-11 ${CLASE_CAMPO_SOBRE_SUPERFICIE}`}
                    />
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <button type="button" onClick={vincular} disabled={elegidos.length === 0 || guardando} className={`w-full ${BTN_PRIMARIO_RELLENO}`}>
        <LinkSimple size={18} aria-hidden />
        {guardando
          ? 'Vinculando...'
          : elegidos.length === 0
            ? 'Vincular'
            : elegidos.length === 1
              ? 'Vincular a 1 equipo'
              : `Vincular a ${elegidos.length} equipos`}
      </button>
    </div>
  )
}
