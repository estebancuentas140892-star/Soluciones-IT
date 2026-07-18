import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGrafo } from '../../components/useGrafo'
import { origenesDistintos, referenciasHacia } from '../../lib/grafo'

// Credenciales que dan acceso a este equipo (grupo N3): el inverso del
// vínculo `credenciales.dispositivos`, derivado del grafo (no se guarda).
// Solo se muestra a quien tiene permiso de bóveda, con la misma
// discreción que el resto de la sección: se listan los títulos y el
// enlace a la ficha de la credencial (donde, tras BovedaGuard y la
// contraseña maestra, se ven los secretos). Sin permiso, la sección no
// aparece: no revela siquiera que el equipo tiene credenciales.
export function CredencialesDelEquipo({
  dispositivoId,
  puedeVerBoveda,
}: {
  dispositivoId: string
  puedeVerBoveda: boolean
}) {
  const grafo = useGrafo()
  const credenciales = useMemo(
    () => origenesDistintos(referenciasHacia(grafo, 'dispositivo', dispositivoId, ['credencial_dispositivo'])),
    [grafo, dispositivoId],
  )

  if (!puedeVerBoveda || credenciales.length === 0) return null

  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-slate-500">Credenciales de este equipo</h3>
      <ul className="flex flex-col gap-2">
        {credenciales.map((credencial) => (
          <li key={credencial.id}>
            <Link
              to={credencial.ruta}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5"
            >
              <span className="min-w-0 truncate text-sm text-slate-100">🔒 {credencial.titulo}</span>
              <span className="shrink-0 text-xs text-sky-400">Ver →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
