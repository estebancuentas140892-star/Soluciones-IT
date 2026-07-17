import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

const GRUPOS: { tipo: ResultadoBusqueda['tipo']; etiqueta: string }[] = [
  { tipo: 'diagnostico', etiqueta: 'Diagnósticos' },
  { tipo: 'categoria', etiqueta: 'Categorías' },
  { tipo: 'articulo', etiqueta: 'Soluciones' },
  { tipo: 'dispositivo', etiqueta: 'Dispositivos' },
  { tipo: 'adjunto', etiqueta: 'Adjuntos' },
  { tipo: 'credencial', etiqueta: 'Bóveda' },
]

// Filtro por tipo (fase N2, punto 4): con 6 tipos de resultado posibles,
// agrupar deja de bastar cuando la lista crece. Los chips solo muestran
// los tipos presentes en la respuesta actual; seleccion unica alternable,
// mismo patron que las tarjetas de categoria de Soluciones y Dispositivos.
export function ResultadosBusqueda({ resultados }: { resultados: ResultadoBusqueda[] }) {
  const [filtro, setFiltro] = useState<ResultadoBusqueda['tipo'] | null>(null)

  if (resultados.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
        No se encontraron resultados
      </p>
    )
  }

  const gruposPresentes = GRUPOS.filter(({ tipo }) => resultados.some((r) => r.tipo === tipo))
  const filtroActivo = filtro && gruposPresentes.some((g) => g.tipo === filtro) ? filtro : null
  const visibles = filtroActivo ? resultados.filter((r) => r.tipo === filtroActivo) : resultados

  return (
    <div className="flex flex-col gap-4">
      {gruposPresentes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {gruposPresentes.map(({ tipo, etiqueta }) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setFiltro((actual) => (actual === tipo ? null : tipo))}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                filtroActivo === tipo
                  ? 'border-sky-700 bg-sky-950/50 text-sky-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              Solo {etiqueta.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {GRUPOS.map(({ tipo, etiqueta }) => {
          const delGrupo = visibles.filter((r) => r.tipo === tipo)
          if (delGrupo.length === 0) return null
          return (
            <section key={tipo}>
              <h2 className="mb-2 text-sm font-medium text-slate-400">{etiqueta}</h2>
              <ul className="flex flex-col gap-2">
                {delGrupo.map((resultado) => (
                  <li key={resultado.id}>
                    <Link
                      to={resultado.ruta}
                      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                    >
                      {resultado.portadaRef && <MiniaturaPortada referencia={resultado.portadaRef} />}
                      <span className="min-w-0">
                        <p className="text-sm font-medium text-slate-100">{resultado.titulo}</p>
                        {resultado.subtitulo && <p className="text-xs text-slate-400">{resultado.subtitulo}</p>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
