import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { db } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { Historial } from '../historial/Historial'
import { cadenaUbicaciones, hijosDirectos, mapaPorId } from './arbol'

// Ficha 360 de una ubicacion (grupo N3): su lugar en la jerarquia, las
// sub-ubicaciones que contiene y los equipos que hay en ella (el inverso
// de dispositivos.ubicacion_id), mas su historial.
export function UbicacionPage() {
  const { ubicacionId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  const ubicacion = useLiveQuery(() => db.ubicaciones.get(ubicacionId), [ubicacionId])
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const porId = useMemo(() => mapaPorId(ubicaciones), [ubicaciones])
  const subUbicaciones = useMemo(() => hijosDirectos(ubicacionId, ubicaciones), [ubicaciones, ubicacionId])
  const equipos = useMemo(
    () =>
      dispositivos
        .filter((d) => d.ubicacionId === ubicacionId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [dispositivos, ubicacionId],
  )

  if (ubicacion === null) return <Navigate to="/ubicaciones" replace />
  if (!ubicacion) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>

  // Cadena de la raíz a la propia; los ancestros (sin la propia) son las
  // migas de pan navegables.
  const cadena = cadenaUbicaciones(ubicacionId, porId)
  const ancestros = cadena.slice(0, -1)

  async function eliminar() {
    await eliminarRegistro('ubicaciones', ubicacionId)
    navigate('/ubicaciones')
  }

  const advertencia =
    equipos.length > 0 || subUbicaciones.length > 0
      ? `${describir(equipos.length, 'equipo', 'equipos')}${
          equipos.length > 0 && subUbicaciones.length > 0 ? ' y ' : ''
        }${describir(subUbicaciones.length, 'sub-ubicación', 'sub-ubicaciones')} quedarán sin este vínculo.`
      : null

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to="/ubicaciones">Ubicaciones</BotonVolver>
        {ancestros.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {ancestros.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <Link to={`/ubicaciones/${a.id}`} className="text-sky-400 underline decoration-dotted underline-offset-2">
                  {a.nombre}
                </Link>
                <span>›</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold">{ubicacion.nombre}</h1>
        {cadena.length > 1 && (
          <p className="text-xs text-slate-600">{cadena.map((u) => u.nombre).join(' › ')}</p>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/ubicaciones/nueva?padre=${ubicacionId}`}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          + Sub-ubicación
        </Link>
        <Link
          to={`/ubicaciones/${ubicacionId}/editar`}
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
        titulo={`¿Eliminar la ubicación "${ubicacion.nombre}"?`}
        descripcion="Los equipos conservarán el nombre del lugar como texto, pero perderán el enlace a esta ficha."
        advertencia={advertencia}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />

      {ubicacion.notas && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Notas</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{ubicacion.notas}</p>
        </section>
      )}

      {subUbicaciones.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-slate-400">Sub-ubicaciones</h2>
          <ul className="flex flex-col gap-2">
            {subUbicaciones.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/ubicaciones/${u.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5"
                >
                  <span className="truncate text-sm text-slate-100">{u.nombre}</span>
                  <span className="shrink-0 text-xs text-sky-400">Ver →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-slate-400">Equipos en este lugar</h2>
        {equipos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 px-4 py-4 text-center text-sm text-slate-500">
            Ningún equipo tiene esta ubicación.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {equipos.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/dispositivos/${d.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-100">{d.nombre}</span>
                    {(d.marca || d.ip) && (
                      <span className="block truncate text-xs text-slate-500">
                        {[d.marca, d.ip].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-sky-400">Ver →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Historial entidadTipo="ubicacion" entidadId={ubicacionId} />
    </div>
  )
}

function describir(n: number, singular: string, plural: string): string {
  if (n === 0) return ''
  return `${n} ${n === 1 ? singular : plural}`
}
