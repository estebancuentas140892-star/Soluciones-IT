import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'

export function SolucionesPage() {
  const categorias = useLiveQuery(
    () => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'),
    [],
    [],
  )

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <header>
        <h1 className="text-xl font-semibold">Soluciones</h1>
        <p className="text-sm text-slate-400">Procedimientos, manuales y resolución de problemas por categoría</p>
      </header>

      {categorias && categorias.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Aún no hay categorías. Sincroniza con conexión a internet para descargarlas.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {categorias?.map((categoria) => (
          <Link
            key={categoria.id}
            to={`/soluciones/${categoria.id}`}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-5 text-left text-sm font-medium text-slate-100"
          >
            {categoria.nombre}
          </Link>
        ))}
      </div>
    </div>
  )
}
