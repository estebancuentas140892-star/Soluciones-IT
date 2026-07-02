import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db, type TipoArticulo } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { TIPOS_ARTICULO } from './tiposArticulo'

export function ArticuloForm() {
  const { categoriaId = '', articuloId } = useParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(articuloId)

  const articulo = useLiveQuery(
    () => (articuloId ? db.articulos.get(articuloId) : undefined),
    [articuloId],
  )

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoArticulo>('manual')
  const [etiquetas, setEtiquetas] = useState('')
  const [contenido, setContenido] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!articulo || cargadoInicial) return
    setTitulo(articulo.titulo)
    setTipo(articulo.tipo)
    setEtiquetas(articulo.etiquetas.join(', '))
    setContenido(articulo.contenido)
    setCargadoInicial(true)
  }, [articulo, cargadoInicial])

  if (esEdicion && articulo === null) return <Navigate to={`/soluciones/${categoriaId}`} replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setGuardando(true)

    const id = articuloId ?? nuevoId()
    await guardarRegistro(
      'articulos',
      {
        id,
        categoriaId,
        titulo: titulo.trim(),
        tipo,
        contenido,
        etiquetas: etiquetas
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      },
      motivo.trim(),
    )

    navigate(`/soluciones/${categoriaId}/${id}`)
  }

  if (esEdicion && !cargadoInicial) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <header>
        <Link to={esEdicion ? `/soluciones/${categoriaId}/${articuloId}` : `/soluciones/${categoriaId}`} className="text-xs text-slate-400">
          ← Volver
        </Link>
        <h1 className="text-xl font-semibold">{esEdicion ? 'Editar artículo' : 'Nuevo artículo'}</h1>
      </header>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Título
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoArticulo)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {TIPOS_ARTICULO.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Etiquetas (separadas por coma)
          <input
            type="text"
            value={etiquetas}
            onChange={(e) => setEtiquetas(e.target.value)}
            placeholder="zebra, impresora, térmica"
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Contenido (admite Markdown)
          <textarea
            required
            rows={10}
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        {esEdicion && (
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Motivo del cambio (opcional)
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Por qué se actualizó este artículo?"
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
