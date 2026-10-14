import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { db } from '../../lib/db'
import { MantenimientosDelEquipo } from './MantenimientosDelEquipo'

// EL MANTENIMIENTO DE UN EQUIPO, SU PANTALLA (rediseño móvil "1b Pulgar",
// tarea 331): "hoja para consultar, pantalla para trabajar". Se llega desde
// la fila "Mantenimiento" de la ficha (que lleva el galón de pantalla) y se
// vuelve a ella. Nivel documento: conserva las pestañas.
// Desde 768 px (tarea 338) Programar ya no va en una barra pegada: el aire
// del final lo pone esta pantalla, como el `pb-12` de las fichas de antes.
export function MantenimientosPage() {
  const { dispositivoId = '' } = useParams()
  const dispositivo = useLiveQuery(async () => (await db.dispositivos.get(dispositivoId)) ?? null, [dispositivoId])

  if (dispositivo === null || dispositivo?.eliminadoEn) return <Navigate to="/dispositivos" replace />
  if (dispositivo === undefined) {
    return (
      <Chasis modo="documento">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </Chasis>
    )
  }

  return (
    <Chasis
      modo="documento"
      volverA={`/dispositivos/${dispositivoId}`}
      volverEtiqueta={dispositivo.nombre}
      titulo="Mantenimiento"
      contexto={dispositivo.nombre}
    >
      <main className="flex flex-1 flex-col px-4 pt-4 md:pb-12 lg:px-10">
        <MantenimientosDelEquipo dispositivoId={dispositivoId} nombreEquipo={dispositivo.nombre} />
      </main>
    </Chasis>
  )
}
