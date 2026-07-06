import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'

// Seccion Red: inventario de la infraestructura de red (racks, puntos
// de red, switches, access points, camaras). Reune los dispositivos de
// las categorias marcadas como es_red y da entrada a la topologia.
export function RedPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  const [categoriaId, setCategoriaId] = useState('')
  const [texto, setTexto] = useState('')

  const categoriasRed = useMemo(() => (categorias ?? []).filter((c) => c.esRed), [categorias])
  const idsRed = useMemo(() => new Set(categoriasRed.map((c) => c.id)), [categoriasRed])
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const filtrados = useMemo(() => {
    const buscado = texto.trim().toLowerCase()
    return (dispositivos ?? [])
      .filter((d) => idsRed.has(d.categoriaId))
      .filter((d) => !categoriaId || d.categoriaId === categoriaId)
      .filter((d) => {
        if (!buscado) return true
        return [d.nombre, d.ubicacion, d.ip, d.marca, d.modelo]
          .join(' ')
          .toLowerCase()
          .includes(buscado)
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  }, [dispositivos, idsRed, categoriaId, texto])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Red</h1>
          <p className="text-sm text-slate-400">Infraestructura y topología de la red</p>
        </div>
        <Link
          to="/dispositivos/nuevo"
          className="shrink-0 rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950"
        >
          + Equipo
        </Link>
      </header>

      <Link
        to="/red/topologia"
        className="flex items-center gap-3 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-3"
      >
        <IconoTopologia className="h-6 w-6 shrink-0 text-sky-400" />
        <div>
          <p className="text-sm font-medium text-slate-100">Ver topología</p>
          <p className="text-xs text-slate-400">Mapa de conexiones entre los equipos</p>
        </div>
        <span className="ml-auto text-slate-500">→</span>
      </Link>

      <div className="flex flex-col gap-2">
        <select
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">Todas las categorías de red</option>
          {categoriasRed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar switch, punto de red, rack..."
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {filtrados.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          {texto || categoriaId
            ? 'Ningún equipo de red coincide con el filtro'
            : 'Aún no hay equipos de red registrados'}
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
                  {[nombreCategoria.get(dispositivo.categoriaId), dispositivo.ubicacion, dispositivo.ip]
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

function IconoTopologia(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="9" y="3" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15" y="16" width="6" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4M12 12H6v4M12 12h6v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
