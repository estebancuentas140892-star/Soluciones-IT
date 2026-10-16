import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { EsqueletoMantenimiento } from '../../components/Esqueleto'
import { Plus } from '../../components/iconos'
import { BTN_DELINEADO_CABECERA } from '../../components/nocturne'
import { db } from '../../lib/db'
import { MantenimientosDelEquipo } from './MantenimientosDelEquipo'

// EL MANTENIMIENTO DE UN EQUIPO, SU PANTALLA (rediseño móvil "1b Pulgar",
// tarea 331): "hoja para consultar, pantalla para trabajar". Se llega desde
// la fila "Mantenimiento" de la ficha (que lleva el galón de pantalla) y se
// vuelve a ella. Nivel documento: conserva las pestañas.
export function MantenimientosPage() {
  const { dispositivoId = '' } = useParams()
  const dispositivo = useLiveQuery(async () => (await db.dispositivos.get(dispositivoId)) ?? null, [dispositivoId])
  // La hoja "Programar mantenimiento": se abre desde la barra de abajo en el
  // teléfono y desde la cabecera desde 768 px (tarea 339).
  const [programando, setProgramando] = useState(false)

  if (dispositivo === null || dispositivo?.eliminadoEn) return <Navigate to="/dispositivos" replace />
  // Mientras se lee, su forma (tarea 342): nada se afirma antes de leer.
  if (dispositivo === undefined) {
    return (
      <Chasis modo="documento">
        <main className="flex flex-1 flex-col px-4 pb-4 pt-2">
          <EsqueletoMantenimiento />
        </main>
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
      // PROGRAMAR, DELINEADO EN LA CABECERA DESDE 768 PX (tarea 339): no hace
      // avanzar nada, así que esta pantalla no tiene acción rellena.
      accionPrincipal={
        <button
          type="button"
          onClick={() => setProgramando(true)}
          aria-haspopup="dialog"
          aria-expanded={programando}
          className={BTN_DELINEADO_CABECERA}
        >
          <Plus size={16} aria-hidden />
          Programar mantenimiento
        </button>
      }
    >
      <main className="flex flex-1 flex-col px-4 pt-4 lg:px-10">
        <MantenimientosDelEquipo
          dispositivoId={dispositivoId}
          nombreEquipo={dispositivo.nombre}
          programando={programando}
          onProgramar={setProgramando}
        />
      </main>
    </Chasis>
  )
}
