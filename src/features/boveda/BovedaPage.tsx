import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import {
  bloquear,
  definirMinutosAutobloqueo,
  obtenerMinutosAutobloqueo,
  OPCIONES_AUTOBLOQUEO_MIN,
} from './sesionBoveda'

export function BovedaPage() {
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])

  const [categoria, setCategoria] = useState('')
  const [minutos, setMinutos] = useState(obtenerMinutosAutobloqueo)

  const categorias = useMemo(
    () => [...new Set((credenciales ?? []).map((c) => c.categoria).filter(Boolean))].sort(),
    [credenciales],
  )

  const filtradas = useMemo(
    () =>
      (credenciales ?? [])
        .filter((c) => !categoria || c.categoria === categoria)
        .sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [credenciales, categoria],
  )

  function cambiarMinutos(valor: number) {
    setMinutos(valor)
    definirMinutosAutobloqueo(valor)
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Notas</h1>
          <p className="text-sm text-slate-400">IP, usuarios y contraseñas del equipo</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={bloquear}
            className="rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-300"
          >
            Bloquear
          </button>
          <Link
            to="/notas/nueva"
            className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950"
          >
            + Credencial
          </Link>
        </div>
      </header>

      <div className="flex items-center gap-2">
        {categorias.length > 0 && (
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <label className="flex flex-1 items-center justify-end gap-2 text-xs text-slate-400">
          Autobloqueo
          <select
            value={minutos}
            onChange={(e) => cambiarMinutos(Number(e.target.value))}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {OPCIONES_AUTOBLOQUEO_MIN.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtradas.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          {categoria ? 'Ninguna credencial coincide con el filtro' : 'Aún no hay credenciales guardadas'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtradas.map((credencial) => (
          <li key={credencial.id}>
            <Link
              to={`/notas/${credencial.id}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <p className="text-sm font-medium text-slate-100">{credencial.titulo}</p>
              {credencial.categoria && (
                <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                  {credencial.categoria}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
