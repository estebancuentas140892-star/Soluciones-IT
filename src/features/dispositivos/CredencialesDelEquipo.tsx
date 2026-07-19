import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight, LockSimple } from '../../components/iconos'
import { useGrafo } from '../../components/useGrafo'
import { origenesDistintos, referenciasHacia } from '../../lib/grafo'

// Credenciales que dan acceso a este equipo (grupo N3): el inverso del
// vínculo `credenciales.dispositivos`, derivado del grafo (no se guarda).
// Solo se muestra a quien tiene permiso de bóveda, con la misma
// discreción que el resto de la sección: se listan los títulos y el
// enlace a la ficha de la credencial (donde, tras BovedaGuard y la
// contraseña maestra, se ven los secretos). Sin permiso, la sección no
// aparece: no revela siquiera que el equipo tiene credenciales.
// Re-autorizado a Nocturne: filas de la lista "Resolver con este
// equipo" (icono de candado neutro, "Bóveda · requiere desbloqueo").
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
    <>
      {credenciales.map((credencial) => (
        <Link
          key={credencial.id}
          to={credencial.ruta}
          className="flex min-h-[50px] items-center gap-[13px] rounded-md px-2 py-2.5 text-noct-text transition-colors hover:bg-noct-text/[.05]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-noct-neutral-400/[.12] text-noct-neutral-400">
            <LockSimple size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium leading-tight">{credencial.titulo}</span>
            <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
              Bóveda · requiere desbloqueo
            </span>
          </span>
          <CaretRight size={15} className="shrink-0 text-noct-neutral-600" aria-hidden />
        </Link>
      ))}
    </>
  )
}
