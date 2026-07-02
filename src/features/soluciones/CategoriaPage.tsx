import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { TIPOS_ARTICULO } from './tiposArticulo'

export function CategoriaPage() {
  const { categoriaId = '' } = useParams()

  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])
  const articulos = useLiveQuery(
    () => db.articulos.where('categoriaId').equals(categoriaId).filter((a) => !a.eliminadoEn).toArray(),
    [categoriaId],
    [],
  )

  if (categoria === null) return <Navigate to="/soluciones" replace />

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <Link to="/soluciones" className="text-xs text-slate-400">
            ← Soluciones
          </Link>
          <h1 className="text-xl font-semibold">{categoria?.nombre ?? '...'}</h1>
        </div>
        <Link
          to={`/soluciones/${categoriaId}/nuevo`}
          className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950"
        >
          + Artículo
        </Link>
      </header>

      {articulos && articulos.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Todavía no hay artículos en esta categoría
        </p>
      )}

      {TIPOS_ARTICULO.map(({ valor, etiqueta }) => {
        const delTipo = articulos?.filter((a) => a.tipo === valor) ?? []
        if (delTipo.length === 0) return null
        return (
          <section key={valor}>
            <h2 className="mb-2 text-sm font-medium text-slate-400">{etiqueta}</h2>
            <ul className="flex flex-col gap-2">
              {delTipo.map((articulo) => (
                <li key={articulo.id}>
                  <Link
                    to={`/soluciones/${categoriaId}/${articulo.id}`}
                    className="block rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  >
                    {articulo.titulo}
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
