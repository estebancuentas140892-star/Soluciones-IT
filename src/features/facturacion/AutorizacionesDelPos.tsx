import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Plus } from '../../components/iconos'
import { BTN_GHOST_ACENTO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { autorizacionesDelPos, motivoDeRevision } from './autorizacion'
import { FilaAutorizacion } from './PresentacionAutorizacion'

// "FACTURACIÓN" DENTRO DE "MÁS DEL EQUIPO" DE UN POS (tarea 321).
//
// Desde el POS se entiende qué autorización tiene, su prefijo, su rango,
// su estado, el vencimiento si está confirmado y si pide revisión. Cada
// fila lleva a la ficha de la autorización (una pantalla, una acción:
// consultarla; editarla es otra). No es una tabla administrativa: lo
// demás (formulario, fuente, verificación, consecutivo) está en su ficha.
// Las claves `DIAN - ...` que la conciliación dejó en "Más datos del
// equipo" siguen ahí, como trazabilidad.

export function AutorizacionesDelPos({ dispositivoId, nombre }: { dispositivoId: string; nombre: string }) {
  const autorizaciones = useLiveQuery(
    () => db.autorizaciones_facturacion.where('dispositivoIds').equals(dispositivoId).toArray(),
    [dispositivoId],
  )
  if (!autorizaciones) return null
  const delPos = autorizacionesDelPos(autorizaciones, dispositivoId)
  const origen = conOrigen(`/dispositivos/${dispositivoId}`, nombre)

  return (
    <div className="flex flex-col gap-2">
      {delPos.length > 0 ? (
        <ul className="flex flex-col divide-y divide-noct-divider">
          {delPos.map((autorizacion) => {
            const motivo = motivoDeRevision(autorizacion)
            return (
              <li key={autorizacion.id}>
                <FilaAutorizacion autorizacion={autorizacion} origen={origen} />
                {motivo && <p className="pb-2 text-[12px] leading-[1.45] text-noct-neutral-500">{motivo}</p>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-[12.5px] text-noct-neutral-500">Ninguna autorización registrada.</p>
      )}
      <Link
        to={`/facturacion/nueva?equipo=${dispositivoId}`}
        state={origen}
        className={`${BTN_GHOST_ACENTO} min-h-11 self-start`}
      >
        <Plus size={13} aria-hidden />
        Registrar autorización
      </Link>
    </div>
  )
}
