import { Link } from 'react-router-dom'
import { CaretRight } from '../../components/iconos'
import { TituloSeccion } from '../../components/nocturne'
import { partirTitulo, VISUAL_POR_TIPO, type GrupoResultados } from './resultados'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

// Presentacion compartida de los resultados del buscador global. El
// catalogo y el agrupado viven en resultados.ts; aqui solo la forma.
// Lo usan Inicio (que busca en linea, sin capa) y BuscadorGlobal (la
// capa que se abre desde la barra superior de cualquier pestaña).

export function FilaResultado({
  resultado,
  consulta,
  onNavegar,
}: {
  resultado: ResultadoBusqueda
  consulta: string
  // La capa se cierra al elegir un resultado; Inicio no pasa nada.
  onNavegar?: () => void
}) {
  const { Icono, tono } = VISUAL_POR_TIPO[resultado.tipo]
  const { pre, match, post } = partirTitulo(resultado.titulo, consulta)
  return (
    <Link
      to={resultado.ruta}
      onClick={onNavegar}
      className="flex min-h-[52px] items-center gap-[13px] rounded px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded ${tono}`}>
        <Icono size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block text-sm font-medium leading-[1.3] [text-wrap:pretty]">
          {pre}
          {match && <span className="rounded-[3px] bg-noct-accent/[.18] text-noct-accent-300">{match}</span>}
          {post}
        </span>
        {resultado.subtitulo && (
          <span className="block truncate text-[12px] text-noct-neutral-500">{resultado.subtitulo}</span>
        )}
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
    </Link>
  )
}

export function ResultadosBusqueda({
  grupos,
  consulta,
  onNavegar,
}: {
  grupos: GrupoResultados[]
  consulta: string
  onNavegar?: () => void
}) {
  return (
    <div className="@container flex flex-col gap-5">
      {grupos.map((grupo) => (
        <section key={grupo.id}>
          <div className="mb-1.5 flex items-center gap-2 px-0.5">
            <grupo.Icono size={14} className="text-noct-neutral-400" aria-hidden />
            <TituloSeccion>{grupo.nombre}</TituloSeccion>
            <span className="text-[11px] text-noct-neutral-600">{grupo.items.length}</span>
          </div>
          <div className="grid grid-cols-1 @2xl:grid-cols-2">
            {grupo.items.map((item) => (
              <FilaResultado key={item.id} resultado={item} consulta={consulta} onNavegar={onNavegar} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
