import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useSyncExternalStore } from 'react'
import { db } from '../lib/db'
import { describirCambio } from '../lib/descripcionCambio'
import {
  descartarCambioPendiente,
  obtenerEstadoSync,
  sincronizar,
  suscribirSync,
} from '../lib/sync'
import { Modal } from './Modal'

interface Props {
  abierto: boolean
  onCerrar: () => void
}

// Panel de sincronizacion (tarea 68): la vista humana del punto de
// estado. Muestra que esta pasando (ultima sincronizacion, tiempo
// real, cambios por subir) y, sobre todo, QUE fallo y COMO seguir
// cuando un cambio queda atascado, sin consola de desarrollador ni
// reinstalar nada. Descartar un cambio es la salida de emergencia:
// pide confirmacion y restaura la version del servidor de esa ficha.
export function PanelSync({ abierto, onCerrar }: Props) {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const pendientes = useLiveQuery(() => db.cambiosPendientes.orderBy('creadoEn').toArray(), [], [])
  const conError = pendientes.filter((c) => c.error !== null)
  const [descartando, setDescartando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function descartar(id: string) {
    setOcupado(true)
    try {
      await descartarCambioPendiente(id)
    } finally {
      setOcupado(false)
      setDescartando(null)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId="panel-sync-titulo">
      <div className="flex flex-col gap-4">
        <h2 id="panel-sync-titulo" className="text-base font-semibold text-slate-100">
          Sincronización
        </h2>

        <dl className="flex flex-col gap-1.5 text-sm text-slate-300">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Estado</dt>
            <dd>
              {estado.enCurso
                ? 'Sincronizando...'
                : estado.tiempoReal
                  ? 'Conectado en tiempo real'
                  : 'Conectado (revisa cada 2 minutos)'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Última sincronización</dt>
            <dd>{estado.ultimaSync ? new Date(estado.ultimaSync).toLocaleTimeString() : 'Aún no'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Cambios por subir</dt>
            <dd>{estado.cambiosPendientes}</dd>
          </div>
        </dl>

        {estado.sinSesion && (
          <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
            No se detecta una sesión activa: puede que debas volver a iniciar sesión.
          </p>
        )}

        {estado.ultimoError && (
          <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
            Última pasada con problema: {estado.ultimoError}
          </p>
        )}

        {estado.conflictosRecientes.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-amber-300">
              Ediciones de compañeros sobrescritas ({estado.conflictosRecientes.length})
            </h3>
            <ul className="flex flex-col gap-1.5">
              {estado.conflictosRecientes.map((mensaje, indice) => (
                <li
                  key={indice}
                  className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200"
                >
                  {mensaje}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              Se subió el cambio de todas formas (gana la última escritura); revisa el historial de
              esas fichas si algo no cuadra.
            </p>
          </div>
        )}

        {conError.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-red-300">
              Cambios que el servidor rechazó ({conError.length})
            </h3>
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {conError.map((cambio) => {
                const d = describirCambio(cambio)
                return (
                  <li
                    key={cambio.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2"
                  >
                    <p className="text-sm text-slate-100">{d.titulo}</p>
                    <p className="text-xs text-red-200">{d.explicacion}</p>
                    <p className="text-[10px] text-slate-500">Intentos: {d.intentos}</p>
                    {descartando === cambio.id ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-amber-200">
                          ¿Descartar este cambio? Se perderá y la ficha volverá a como está en el
                          servidor.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => void descartar(cambio.id)}
                            className="rounded-lg border border-red-800 px-2.5 py-1 text-xs text-red-300 disabled:opacity-50"
                          >
                            {ocupado ? 'Descartando...' : 'Sí, descartar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDescartando(null)}
                            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDescartando(cambio.id)}
                        className="self-start text-xs text-slate-400 underline underline-offset-2"
                      >
                        Descartar este cambio
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-slate-500">
              Los cambios rechazados se reintentan solos en cada sincronización. Descartar es solo
              para cuando el error no se resuelve.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void sincronizar()}
            className="rounded-xl border border-sky-800 px-4 py-2 text-sm text-sky-300"
          >
            Reintentar ahora
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
