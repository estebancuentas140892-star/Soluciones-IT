import { useLiveQuery } from 'dexie-react-hooks'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { Adjuntos } from '../../components/Adjuntos'
import { etiquetaDeTipo } from './tiposArticulo'

export function ArticuloPage() {
  const { categoriaId = '', articuloId = '' } = useParams()
  const navigate = useNavigate()

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])

  if (articulo === null) return <Navigate to={`/soluciones/${categoriaId}`} replace />
  if (!articulo) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>

  async function eliminar() {
    if (!window.confirm(`¿Eliminar "${articulo!.titulo}"?`)) return
    await eliminarRegistro('articulos', articuloId)
    navigate(`/soluciones/${categoriaId}`)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <Link to={`/soluciones/${categoriaId}`} className="text-xs text-slate-400">
            ← {categoria?.nombre ?? 'Categoría'}
          </Link>
          <h1 className="text-xl font-semibold">{articulo.titulo}</h1>
          <p className="text-xs text-slate-500">{etiquetaDeTipo(articulo.tipo)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to={`/soluciones/${categoriaId}/${articuloId}/editar`}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={() => void eliminar()}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
          >
            Eliminar
          </button>
        </div>
      </header>

      {articulo.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {articulo.etiquetas.map((etiqueta) => (
            <span key={etiqueta} className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
              {etiqueta}
            </span>
          ))}
        </div>
      )}

      <article className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-a:text-sky-400">
        <Markdown remarkPlugins={[remarkGfm]}>{articulo.contenido}</Markdown>
      </article>

      <Adjuntos entidadTipo="articulo" entidadId={articuloId} />
    </div>
  )
}
