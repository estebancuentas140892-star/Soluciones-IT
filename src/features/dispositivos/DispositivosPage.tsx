import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { MiniaturaPortada } from '../../components/MiniaturaPortada'
import { IndicadorEstado } from './IndicadorEstado'

export function DispositivosPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  const [categoriaId, setCategoriaId] = useState('')
  const [estado, setEstado] = useState('')
  const [ubicacion, setUbicacion] = useState('')

  // Las categorias de red se muestran en la seccion Red, no aqui.
  const categoriasGenerales = useMemo(() => (categorias ?? []).filter((c) => !c.esRed), [categorias])
  const idsRed = useMemo(
    () => new Set((categorias ?? []).filter((c) => c.esRed).map((c) => c.id)),
    [categorias],
  )

  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const generales = useMemo(
    () => (dispositivos ?? []).filter((d) => !idsRed.has(d.categoriaId)),
    [dispositivos, idsRed],
  )

  const estados = useMemo(
    () => [...new Set(generales.map((d) => d.estado).filter(Boolean))].sort(),
    [generales],
  )

  const filtrados = useMemo(() => {
    const ubicacionBuscada = ubicacion.trim().toLowerCase()
    return generales.filter((d) => {
      if (categoriaId && d.categoriaId !== categoriaId) return false
      if (estado && d.estado !== estado) return false
      if (ubicacionBuscada && !d.ubicacion.toLowerCase().includes(ubicacionBuscada)) return false
      return true
    })
  }, [generales, categoriaId, estado, ubicacion])

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

      <div className="flex gap-2">
        <Link
          to="/escaner"
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          <IconoEscanear className="h-3.5 w-3.5" />
          Escanear código
        </Link>
        <Link
          to="/dispositivos/etiquetas"
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          Etiquetas QR
        </Link>
        <Link
          to="/dispositivos/importar"
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          Importar
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todas las categorías</option>
            {categoriasGenerales.map((c) => (
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
              <div className="flex min-w-0 items-center gap-3">
                {dispositivo.foto && (
                  <MiniaturaPortada referencia={dispositivo.foto.referencia} alt={dispositivo.nombre} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{dispositivo.nombre}</p>
                  <p className="truncate text-xs text-slate-400">
                    {[nombreCategoria.get(dispositivo.categoriaId), dispositivo.marca, dispositivo.ubicacion]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <IndicadorEstado estado={dispositivo.estado} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function IconoEscanear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12h10" strokeLinecap="round" />
    </svg>
  )
}
