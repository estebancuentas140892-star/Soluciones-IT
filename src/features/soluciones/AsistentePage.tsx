import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import { Chasis } from '../../app/Chasis'
import { AsistenteVista } from './AsistenteVista'

// Pantalla del modo ejecucion (asistente): nivel 3 del chasis (tarea
// 185), una tarea con salida. Es de los pocos sitios donde la barra de
// pestañas cede, para que el tecnico vea solo lo que necesita en el
// momento exacto; a cambio, la BarraTarea dice que esta ejecutando, que
// procedimiento y a donde vuelve (R19). Salir no pierde avance: el
// progreso vive en la base local, no en el estado de esta pantalla.
export function AsistentePage() {
  const { categoriaId = '', articuloId = '' } = useParams()

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
  const categoria = useLiveQuery(() => db.categorias.get(categoriaId), [categoriaId])
  const procedimiento = useMemo(() => normalizarProcedimiento(articulo?.procedimiento), [articulo])

  if (articulo === null) return <Navigate to="/soluciones" replace />
  if (!articulo) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }
  // Un articulo sin pasos (sin procedimiento, o con metadata pero sin
  // pasos: K1) no tiene modo ejecucion que ofrecer.
  if (!procedimientoEjecutable(procedimiento)) {
    return <Navigate to={`/soluciones/${categoriaId}/${articuloId}`} replace />
  }

  return (
    <Chasis
      modo="tarea"
      rotulo="Ejecutando"
      titulo={articulo.titulo}
      vuelta={categoria?.nombre ? `Guías › ${categoria.nombre}` : 'Guías'}
      salidaEtiqueta="Salir del modo ejecución"
    >
      <main className="flex flex-1 flex-col px-4 pb-10 pt-4">
        {/* Sin onCompletado: al nivel 0 no hay a quien avisar,
            AsistenteVista ya muestra su propio resumen de "completado" y
            el tecnico decide cuando salir con el boton de arriba. */}
        <AsistenteVista articuloId={articuloId} procedimiento={procedimiento} nivel={0} />
      </main>
    </Chasis>
  )
}
