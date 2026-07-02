import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'

export function DispositivosPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  const [categoriaId, setCategoriaId] = useState('')
  const [estado, setEstado] = useState('')
  const [ubicacion, setUbicacion] = useState('')

  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const estados = useMemo(
    () => [...new Set((dispositivos ?? []).map((d) => d.estado).filter(Boolean))].sort(),
    [dispositivos],
  )

  const filtrados = useMemo(() => {
    const ubicacionBuscada = ubicacion.trim().toLowerCase()
    return (dispositivos ?? []).filter((d) => {
      if (categoriaId && d.categoriaId !== categoriaId) return false
      if (estado && d.estado !== estado) return false
      if (ubicacionBuscada && !d.ubicacion.toLowerCase().includes(ubicacionBuscada)) return false
      return true
    })
  }, [dispositivos, categoriaId, estado, ubicacion])

  const hayFiltrosActivos = Boolean(categoriaId || estado || ubicacion)

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Dispositivos</h1>
          <p className="text-sm text-slate-400">Inventario y fichas técnicas del equipo</p>
        </div>
        <Link
          to="/dispositivos/nuevo"
          className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950"
        >
          + Dispositivo
        </Link>
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todas las categorías</option>
            {categorias?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todos los estados</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          placeholder="Filtrar por ubicación..."
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {filtrados.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          {hayFiltrosActivos ? 'Ningún dispositivo coincide con el filtro' : 'Aún no hay dispositivos registrados'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtrados.map((dispositivo) => (
          <li key={dispositivo.id}>
            <Link
              to={`/dispositivos/${dispositivo.id}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-100">{dispositivo.nombre}</p>
                <p className="text-xs text-slate-400">
                  {[nombreCategoria.get(dispositivo.categoriaId), dispositivo.marca, dispositivo.ubicacion]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {dispositivo.estado && (
                <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                  {dispositivo.estado}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
