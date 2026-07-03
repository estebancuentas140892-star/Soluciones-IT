import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonCompartir } from '../../components/BotonCompartir'
import { Historial } from '../historial/Historial'
import { ProcedimientoVista } from './ProcedimientoVista'
import { etiquetaDeTipo } from './tiposArticulo'

export function ArticuloPage() {
  const { categoriaId = '', articuloId = '' } = useParams()
  const navigate = useNavigate()

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])

  // Memorizado para que los ids generados al normalizar datos viejos
  // sean estables entre renders (el progreso local depende de ellos).
  const procedimiento = useMemo(() => normalizarProcedimiento(articulo?.procedimiento), [articulo])

  const idVisitado = articulo && !articulo.eliminadoEn ? articulo.id : null
  useEffect(() => {
    if (idVisitado) void registrarVisita('articulo', idVisitado)
  }, [idVisitado])

  if (articulo === null) return <Navigate to={`/soluciones/${categoriaId}`} replace />
  if (!articulo) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>

  async function eliminar() {
    if (!window.confirm(`¿Eliminar "${articulo!.titulo}"?`)) return
    await eliminarRegistro('articulos', articuloId)
    navigate(`/soluciones/${categoriaId}`)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header>
        <Link to={`/soluciones/${categoriaId}`} className="text-xs text-slate-400">
          ← {categoria?.nombre ?? 'Categoría'}
        </Link>
        <h1 className="text-xl font-semibold">{articulo.titulo}</h1>
        <p className="text-xs text-slate-500">{etiquetaDeTipo(articulo.tipo)}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <BotonCompartir titulo={articulo.titulo} />
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

      {articulo.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {articulo.etiquetas.map((etiqueta) => (
            <span key={etiqueta} className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
              {etiqueta}
            </span>
          ))}
        </div>
      )}

      {procedimiento && <ProcedimientoVista articuloId={articuloId} procedimiento={procedimiento} />}

      {articulo.contenido.trim() !== '' && (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-a:text-sky-400">
          <Markdown remarkPlugins={[remarkGfm]}>{articulo.contenido}</Markdown>
        </article>
      )}

      <Adjuntos entidadTipo="articulo" entidadId={articuloId} />

      <Historial entidadTipo="articulo" entidadId={articuloId} />
    </div>
  )
}
