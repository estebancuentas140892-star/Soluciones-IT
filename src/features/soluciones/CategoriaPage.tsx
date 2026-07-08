import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useParams } from 'react-router-dom'
import { db, type Articulo } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { contarHechos } from '../../lib/progresoPasos'
import { BotonVolver } from '../../components/BotonVolver'
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
      <header className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-2">
          <BotonVolver to="/soluciones">Soluciones</BotonVolver>
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
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                  >
                    <span className="min-w-0 truncate">{articulo.titulo}</span>
                    <AvanceArticulo articulo={articulo} />
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

// Chip "X/Y pasos" para retomar de un vistazo un procedimiento a
// medias, sin tener que abrirlo. Solo se muestra en artículos con
// procedimiento y avance previo (evita ruido en el resto de la lista).
function AvanceArticulo({ articulo }: { articulo: Articulo }) {
  const procedimiento = normalizarProcedimiento(articulo.procedimiento)
  const progreso = useLiveQuery(() => db.progresoPasos.get(articulo.id), [articulo.id])

  if (!procedimiento) return null
  const total = procedimiento.pasos.length
  const hechos = contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((p) => p.id))
  if (hechos === 0) return null

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
        hechos === total
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
          : 'border-amber-800 bg-amber-950/40 text-amber-400'
      }`}
    >
      {hechos}/{total}
    </span>
  )
}
