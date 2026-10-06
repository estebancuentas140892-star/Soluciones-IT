import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useSyncExternalStore } from 'react'
import { db } from '../lib/db'
import { agruparPorError } from '../lib/descripcionCambio'
import {
  descartarCambioPendiente,
  obtenerEstadoSync,
  sincronizar,
  suscribirSync,
} from '../lib/sync'
import { Boton } from './Boton'
import { Hoja } from './Hoja'

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
//
// Desde la tarea 291 es la hoja estándar (auditoría UX, F1): la × cierra
// (sin un "Cerrar" repetido, P4), "Reintentar ahora" va al pie y todos sus
// botones tocan en 44 px como mínimo (T3: "Reintentar" medía 26 y
// "Descartar" era un enlace de 11 px).
export function PanelSync({ abierto, onCerrar }: Props) {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync)
  const pendientes = useLiveQuery(() => db.cambiosPendientes.orderBy('creadoEn').toArray(), [], [])
  const conError = pendientes.filter((c) => c.error !== null)
  const grupos = agruparPorError(conError)
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
    <Hoja
      abierta={abierto}
      onCerrar={onCerrar}
      titulo="Sincronización"
      pie={
        <Boton
          papel="principal"
          tamano={52}
          anchoCompleto
          onClick={() => void sincronizar()}
          cargando={estado.enCurso}
          textoCargando="Sincronizando…"
        >
          Reintentar ahora
        </Boton>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-1.5 text-sm text-noct-neutral-200">
          <div className="flex justify-between gap-3">
            <dt className="text-noct-neutral-400">Estado</dt>
            <dd>
              {estado.enCurso
                ? 'Sincronizando…'
                : estado.tiempoReal
                  ? 'Conectado en tiempo real'
                  : 'Conectado (revisa cada 2 minutos)'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-noct-neutral-400">Última sincronización</dt>
            <dd>{estado.ultimaSync ? new Date(estado.ultimaSync).toLocaleTimeString() : 'Aún no'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-noct-neutral-400">Cambios por subir</dt>
            <dd>{estado.cambiosPendientes}</dd>
          </div>
        </dl>

        {estado.sinSesion && (
          <p className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-3 py-2 text-xs text-noct-precaucion">
            No se detecta una sesión activa: puede que debas volver a iniciar sesión.
          </p>
        )}

        {estado.ultimoError && (
          <p className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-3 py-2 text-xs text-noct-precaucion">
            Última pasada con problema: {estado.ultimoError}
          </p>
        )}

        {estado.conflictosRecientes.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-noct-precaucion">
              Ediciones de compañeros sobrescritas ({estado.conflictosRecientes.length})
            </h3>
            <ul className="flex flex-col gap-1.5">
              {estado.conflictosRecientes.map((mensaje, indice) => (
                <li
                  key={indice}
                  className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-3 py-2 text-xs text-noct-precaucion"
                >
                  {mensaje}
                </li>
              ))}
            </ul>
            <p className="text-xs text-noct-neutral-500">
              Se subió el cambio de todas formas (gana la última escritura); revisa el historial de
              esas fichas si algo no cuadra.
            </p>
          </div>
        )}

        {conError.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-noct-error">
              Cambios que el servidor rechazó ({conError.length})
            </h3>
            {/* Agrupados por causa: casi siempre todos fallan por lo
                mismo, así que la explicación va UNA vez por grupo y
                debajo la lista de fichas afectadas. Antes se repetía el
                párrafo completo por cada ficha y el panel se volvía
                larguísimo justo cuando había más que leer. */}
            {grupos.map((grupo) => (
              <div
                key={grupo.explicacion}
                className="flex flex-col gap-2 rounded-lg border border-noct-error/35 bg-noct-error/[.08] px-3 py-2.5"
              >
                <p className="text-xs text-noct-error">{grupo.explicacion}</p>
                <p className="text-[11px] text-noct-neutral-400">
                  {grupo.cambios.length === 1
                    ? 'Afecta a 1 ficha:'
                    : `Afecta a ${grupo.cambios.length} fichas:`}
                </p>
                <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                  {grupo.cambios.map(({ cambio, descripcion }) => (
                    <li key={cambio.id} className="flex flex-col gap-1 border-l border-noct-error/35 pl-2.5">
                      <p className="text-[13px] leading-snug text-noct-text">{descripcion.titulo}</p>
                      {descartando === cambio.id ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-noct-precaucion">
                            ¿Descartar este cambio? Se perderá y la ficha volverá a como está en el
                            servidor.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Boton
                              papel="destructivo"
                              onClick={() => void descartar(cambio.id)}
                              cargando={ocupado}
                              textoCargando="Descartando…"
                            >
                              Descartar el cambio
                            </Boton>
                            <Boton papel="texto" tono="descarte" onClick={() => setDescartando(null)}>
                              Cancelar
                            </Boton>
                          </div>
                        </div>
                      ) : (
                        <Boton
                          papel="texto"
                          tono="descarte"
                          className="-ml-2 self-start"
                          onClick={() => setDescartando(cambio.id)}
                        >
                          Descartar ({descripcion.intentos === 1 ? '1 intento' : `${descripcion.intentos} intentos`})
                        </Boton>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-noct-neutral-500">
              Los cambios rechazados se reintentan solos en cada sincronización. Descartar es solo
              para cuando el error no se resuelve.
            </p>
          </div>
        )}

      </div>
    </Hoja>
  )
}
