import { Link } from 'react-router-dom'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

const GRUPOS: { tipo: ResultadoBusqueda['tipo']; etiqueta: string }[] = [
  { tipo: 'diagnostico', etiqueta: 'Diagnósticos' },
  { tipo: 'articulo', etiqueta: 'Soluciones' },
  { tipo: 'dispositivo', etiqueta: 'Dispositivos' },
  { tipo: 'credencial', etiqueta: 'Notas' },
]

export function ResultadosBusqueda({ resultados }: { resultados: ResultadoBusqueda[] }) {
  if (resultados.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
        No se encontraron resultados
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {GRUPOS.map(({ tipo, etiqueta }) => {
        const delGrupo = resultados.filter((r) => r.tipo === tipo)
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
  )
}
