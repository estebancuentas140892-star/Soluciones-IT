import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { BotonVolver } from '../../components/BotonVolver'
import { AsistenteVista } from './AsistenteVista'

// Pantalla del modo asistente: fuera del Layout (sin barra inferior),
// para que el tecnico vea solo lo que necesita en el momento exacto,
// sin distraerse con el resto de la app ni con el resto del
// procedimiento (que en la vista de lista se ve completo de un
// vistazo). Salir vuelve a la ficha del articulo sin perder avance:
// el progreso vive en la base local, no en el estado de esta pantalla.
export function AsistentePage() {
  const { categoriaId = '', articuloId = '' } = useParams()

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
  const procedimiento = useMemo(() => normalizarProcedimiento(articulo?.procedimiento), [articulo])

  if (articulo === null) return <Navigate to={`/soluciones/${categoriaId}`} replace />
  if (!articulo) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  // Un articulo sin procedimiento no tiene modo asistente que ofrecer.
  if (!procedimiento) return <Navigate to={`/soluciones/${categoriaId}/${articuloId}`} replace />

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 pb-10 pt-6">
      <header className="flex items-center justify-between gap-2">
        <BotonVolver to={`/soluciones/${categoriaId}/${articuloId}`}>Salir</BotonVolver>
        <p className="min-w-0 flex-1 truncate text-right text-xs text-slate-500">{articulo.titulo}</p>
      </header>

      {/* Sin onCompletado: al nivel 0 no hay a quien avisar, AsistenteVista
          ya muestra su propia pantalla de "completado" y el tecnico
          decide cuando salir con el boton de arriba. */}
      <AsistenteVista articuloId={articuloId} procedimiento={procedimiento} nivel={0} />
    </div>
  )
}
