import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonCompartir } from '../../components/BotonCompartir'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { Historial } from '../historial/Historial'
import { ProcedimientoVista } from './ProcedimientoVista'
import { etiquetaDeTipo } from './tiposArticulo'

export function ArticuloPage() {
  const { categoriaId = '', articuloId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

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
    await eliminarRegistro('articulos', articuloId)
    navigate(`/soluciones/${categoriaId}`)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to={`/soluciones/${categoriaId}`}>{categoria?.nombre ?? 'Categoría'}</BotonVolver>
        <div>
          <h1 className="text-xl font-semibold">{articulo.titulo}</h1>
          <p className="text-xs text-slate-500">{etiquetaDeTipo(articulo.tipo)}</p>
        </div>
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
          onClick={() => setMostrarEliminar(true)}
          className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
        >
          Eliminar
        </button>
      </div>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={
          procedimiento
            ? `¿Eliminar procedimiento "${articulo.titulo}"?`
            : `¿Eliminar artículo "${articulo.titulo}"?`
        }
        descripcion={
          procedimiento
            ? 'Esta acción eliminará todo el procedimiento y sus pasos asociados.'
            : 'Esta acción eliminará el artículo por completo.'
        }
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />

      {procedimiento && <ProcedimientoVista articuloId={articuloId} procedimiento={procedimiento} />}

      {articulo.contenido.trim() !== '' && (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-a:text-sky-400">
          <Markdown remarkPlugins={[remarkGfm]}>{articulo.contenido}</Markdown>
        </article>
      )}

      {/* En los procedimientos, los adjuntos viven en cada paso (donde
          se usan). El apartado del articulo solo se muestra para
          articulos sin procedimiento (manuales en Markdown), que no
          tienen pasos donde anclar el archivo. */}
      {!procedimiento && <Adjuntos entidadTipo="articulo" entidadId={articuloId} />}

      <Historial entidadTipo="articulo" entidadId={articuloId} />
    </div>
  )
}
