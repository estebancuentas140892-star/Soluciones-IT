import { Link } from 'react-router-dom'
import { avisar } from '../../components/avisosFlotantes'
import { VALOR_TECNICO_COMPACTO } from '../../components/FilaDato'
import { IconoCategoria } from '../../components/IconoCategoria'
import { IconoVentana } from '../../components/ventana/IconoVentana'
import { BOTON_COPIAR, TARJETA } from '../../components/ventana/estilos'
import type { Dispositivo } from '../../lib/db'
import { inicialesDe } from '../../lib/iniciales'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { partirTitulo } from '../busqueda/resultados'
import { estadoEnLista, type TonoEstado } from '../red/topologiaVisual'
import { normalizarTexto } from '../soluciones/iconosSoluciones'

// UNA PERSONA CON VARIOS EQUIPOS, AL BUSCAR (tarea 364, D4 de la auditoría
// del 2026-10-27). «Daniel» daba dos tarjetas iguales arriba («Daniel
// Restrepo»), una por equipo, y había que leerlas enteras para ver que eran
// la misma persona. Ahora es una tarjeta: la cabecera con sus iniciales, su
// nombre, su área y su sitio una sola vez, y cuántos equipos tiene; debajo,
// cada equipo con su IP (y su sitio, si no es el mismo para todos). La
// cabecera abre la ficha de la persona; cada fila, la de su equipo, y su IP se
// copia sin abrirla.
//
// Desde 768 px, la misma idea en filas densas: la persona es una fila de
// cabecera y sus equipos van sangrados debajo, con la IP a la derecha.

const PASTILLA_POR_TONO: Record<TonoEstado, string> = {
  exito: 'bg-noct-exito-tinte text-noct-exito',
  precaucion: 'bg-noct-precaucion-tinte text-noct-precaucion',
  error: 'bg-noct-error-tinte text-noct-error',
  neutro: 'bg-noct-neutral-900 text-noct-neutral-300',
}

/** Un equipo de la persona, con lo que su fila dice además de su nombre. */
export interface EquipoDePersona {
  dispositivo: Dispositivo
  categoriaNombre: string
  /** Su sitio, si no es el mismo para todos sus equipos; si no, ''. */
  extra: string
}

function Resaltado({ texto, resaltar }: { texto: string; resaltar: string }) {
  const { pre, match, post } = partirTitulo(texto, normalizarTexto(resaltar.trim()))
  return (
    <>
      {pre}
      {match && <span className="rounded-[3px] bg-noct-accent/[.16] text-noct-accent-200">{match}</span>}
      {post}
    </>
  )
}

export function GrupoDePersona({
  personaId,
  nombre,
  contexto,
  equipos,
  estado,
  alAbrir,
  resaltar,
  enTarjeta,
}: {
  personaId: string
  nombre: string
  /** El área y el sitio común, o «Sin área registrada» (`contextoDePersona`). */
  contexto: string
  equipos: EquipoDePersona[]
  /** El `state` del salto (el origen, con la búsqueda), como en `FilaDispositivo`. */
  estado?: unknown
  alAbrir?: () => void
  resaltar: string
  /** Por debajo de 768 px, la tarjeta del teléfono. */
  enTarjeta: boolean
}) {
  const cuenta = `${equipos.length} ${equipos.length === 1 ? 'equipo' : 'equipos'}`
  if (!enTarjeta) {
    return (
      <div data-grupo-persona={personaId} className="flex flex-col">
        <Link
          to={`/personas/${personaId}`}
          state={estado}
          onClick={alAbrir}
          className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 text-noct-text hover:bg-noct-text/[.05]"
        >
          <span
            aria-hidden
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-noct-cat-9/[.12] text-[13px] font-bold text-noct-cat-9"
          >
            {inicialesDe(nombre)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span data-nombre-principal className="min-w-0 text-[15px] font-semibold leading-[1.3] [overflow-wrap:anywhere] text-pretty">
              <Resaltado texto={nombre} resaltar={resaltar} />
            </span>
            <span className="text-[12.5px] leading-[1.4] text-noct-neutral-500">
              {contexto} · {cuenta}
            </span>
          </span>
        </Link>
        {equipos.map(({ dispositivo, categoriaNombre, extra }) => {
          const estadoVisible = estadoEnLista(dispositivo.estado)
          return (
            <Link
              key={dispositivo.id}
              to={`/dispositivos/${dispositivo.id}`}
              state={estado}
              onClick={alAbrir}
              data-equipo-de-persona
              className="flex min-h-12 items-center gap-3 rounded-lg py-1.5 pl-[58px] pr-2 text-noct-text hover:bg-noct-text/[.05]"
            >
              <IconoCategoria nombre={categoriaNombre} tam={34} className={estadoVisible?.excepcion ? 'opacity-[.66]' : ''} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="min-w-0 text-[14.5px] font-medium leading-[1.3] [overflow-wrap:anywhere]">
                  <Resaltado texto={dispositivo.nombre} resaltar={resaltar} />
                </span>
                {(extra || estadoVisible) && (
                  <span className="text-[12.5px] leading-[1.4] text-noct-neutral-500">
                    {[extra, estadoVisible?.etiqueta].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              {dispositivo.ip && <span className={`shrink-0 ${VALOR_TECNICO_COMPACTO}`}>{dispositivo.ip}</span>}
            </Link>
          )
        })}
      </div>
    )
  }
  return (
    <section data-grupo-persona={personaId} className={`${TARJETA} flex min-w-0 flex-col rounded-[18px]`}>
      <Link
        to={`/personas/${personaId}`}
        state={estado}
        onClick={alAbrir}
        className="flex min-h-[60px] items-center gap-2.5 rounded-[18px] py-2.5 pl-2.5 pr-3 text-noct-text active:bg-noct-presionado"
      >
        <span
          aria-hidden
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-noct-cat-9/[.12] text-[15px] font-extrabold text-noct-cat-9"
        >
          {inicialesDe(nombre)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          {/* El nombre de la persona es la identidad de la tarjeta: entero
              (regla 23). */}
          <span data-nombre-principal className="min-w-0 text-[16px] font-extrabold leading-[21px] [overflow-wrap:anywhere] text-pretty">
            <Resaltado texto={nombre} resaltar={resaltar} />
          </span>
          <span className="text-[14px] font-semibold leading-snug text-noct-neutral-300">{contexto}</span>
        </span>
        <span className="shrink-0 text-[13.5px] font-bold text-noct-neutral-300">{cuenta}</span>
      </Link>
      {equipos.map(({ dispositivo, categoriaNombre, extra }) => {
        const estadoVisible = estadoEnLista(dispositivo.estado)
        const ip = dispositivo.ip?.trim() ?? ''
        return (
          <div
            key={dispositivo.id}
            data-equipo-de-persona
            className="mx-2.5 flex min-w-0 items-center gap-2 border-t-[1.5px] border-noct-divider py-1.5"
          >
            <Link
              to={`/dispositivos/${dispositivo.id}`}
              state={estado}
              onClick={alAbrir}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl text-noct-text active:bg-noct-presionado"
            >
              <IconoCategoria nombre={categoriaNombre} tam={36} className={estadoVisible?.excepcion ? 'opacity-[.66]' : ''} />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="min-w-0 text-[15px] font-bold leading-5 [overflow-wrap:anywhere] text-pretty">
                  <Resaltado texto={dispositivo.nombre} resaltar={resaltar} />
                </span>
                {(ip || extra) && (
                  <span className="flex flex-wrap items-baseline gap-x-2 leading-[1.35]">
                    {ip && <span className="font-mono text-[14px] font-semibold text-noct-neutral-300">{ip}</span>}
                    {extra && <span className="text-[14px] font-semibold text-noct-neutral-300">{extra}</span>}
                  </span>
                )}
                {estadoVisible && (
                  <span
                    data-estado-equipo={estadoVisible.tono}
                    className={`mt-[3px] inline-flex h-[22px] items-center gap-[5px] self-start rounded-full px-2 text-[12.5px] font-extrabold ${PASTILLA_POR_TONO[estadoVisible.tono]}`}
                  >
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    {estadoVisible.etiqueta}
                  </span>
                )}
              </span>
            </Link>
            {ip && (
              <button
                type="button"
                aria-label={`Copiar IP de ${dispositivo.nombre}`}
                onClick={() => {
                  void copiarAlPortapapeles(ip).then((ok) => avisar(ok ? `IP copiada: ${ip}` : 'No se pudo copiar la IP', 'copiado'))
                }}
                className={BOTON_COPIAR}
              >
                <IconoVentana nombre="copiar" tam={20} />
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}
