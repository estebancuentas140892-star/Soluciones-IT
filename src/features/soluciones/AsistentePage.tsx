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
// momento exacto; a cambio, la BarraTarea dice que esta ejecutando y
// deja salir (R19). Cabecera COMPACTA desde la tarea 218 (G-09, G-10):
// una sola linea de 44 px con el titulo y la X, sin rotulo ni ruta de
// vuelta ("vuelves aqui al terminar" ya no se repite: el tecnico acaba
// de decidir entrar hace cuatro segundos). Salir no pierde avance: el
// progreso vive en la base local, no en el estado de esta pantalla.
export function AsistentePage() {
  const { categoriaId = '', articuloId = '' } = useParams()

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
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
      compacta
      rotulo="Ejecutando"
      titulo={articulo.titulo}
      salidaEtiqueta="Salir del modo ejecución"
    >
      {/* Sin relleno inferior propio: la acción dominante fija de
          `AsistenteVista` (M-011) es el último elemento del flujo y ya
          reserva su alto y el área segura del teléfono. */}
      <main className="flex flex-1 flex-col px-4 pt-4">
        {/* Sin onCompletado: al nivel 0 no hay a quien avisar,
            AsistenteVista ya muestra su propio resumen de "completado" y
            el tecnico decide cuando salir con el boton de arriba. */}
        <AsistenteVista articuloId={articuloId} procedimiento={procedimiento} nivel={0} />
      </main>
    </Chasis>
  )
}
