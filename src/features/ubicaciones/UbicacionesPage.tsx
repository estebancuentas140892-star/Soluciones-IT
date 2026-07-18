import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { db } from '../../lib/db'
import { mapaPorId, ordenarPorRuta, rutaUbicacion } from './arbol'
import { textosSinUbicacion } from './migracion'

// Lista de ubicaciones (grupo N3): el lugar fisico como entidad, con su
// jerarquia y cuantos equipos hay en cada una. Da entrada a la migracion
// asistida de los textos de ubicacion que todavia no son entidad.
export function UbicacionesPage() {
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const porId = useMemo(() => mapaPorId(ubicaciones), [ubicaciones])
  const ordenadas = useMemo(() => ordenarPorRuta(ubicaciones), [ubicaciones])
  const conteoPorUbicacion = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const d of dispositivos) {
      if (d.ubicacionId) conteo.set(d.ubicacionId, (conteo.get(d.ubicacionId) ?? 0) + 1)
    }
    return conteo
  }, [dispositivos])

  // Cuantos textos de ubicacion sueltos quedan por migrar a entidad.
  const porMigrar = useMemo(() => textosSinUbicacion(dispositivos).length, [dispositivos])

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to="/dispositivos">Dispositivos</BotonVolver>
        <h1 className="text-xl font-semibold">Ubicaciones</h1>
        <p className="text-sm text-slate-400">Los lugares físicos donde viven los equipos.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/ubicaciones/nueva"
          className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-slate-950"
        >
          + Nueva ubicación
        </Link>
        {porMigrar > 0 && (
          <Link
            to="/ubicaciones/migrar"
            className="rounded-xl border border-amber-900 bg-amber-950/30 px-4 py-2.5 text-sm text-amber-300"
          >
            Migrar {porMigrar} {porMigrar === 1 ? 'ubicación de texto' : 'ubicaciones de texto'}
          </Link>
        )}
      </div>

      {ordenadas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Aún no hay ubicaciones registradas.
          {porMigrar > 0 && ' Puedes crear las primeras migrando los textos existentes.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenadas.map((u) => {
            const conteo = conteoPorUbicacion.get(u.id) ?? 0
            return (
              <li key={u.id}>
                <Link
                  to={`/ubicaciones/${u.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-100">{u.nombre}</span>
                    {u.padreId && (
                      <span className="block truncate text-xs text-slate-500">
                        {rutaUbicacion(u.id, porId)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {conteo} {conteo === 1 ? 'equipo' : 'equipos'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
