import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, type Conexion, type Dispositivo } from '../../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  agruparConexiones,
  datosSegunModo,
  MEDIOS_SUGERIDOS,
  type ExtremoConexion,
  type ModoConexion,
} from '../../lib/conexiones'
import { mapaDeTextos, nombreVivo } from '../../lib/referencia'
import { CaretRight, Plus, X } from '../../components/iconos'
import { BTN_GHOST_ACENTO, BTN_PRIMARIO, TituloSeccion } from '../../components/nocturne'
import { CLASE_CAMPO, CLASE_ETIQUETA as CLASE_ETIQUETA_BASE } from '../../components/campos'

// Aquí el rótulo se aplica al propio `<label>`, que además apila el
// texto sobre el control, así que suma el flex al rótulo compartido.
const CLASE_ETIQUETA = `flex flex-col gap-1.5 ${CLASE_ETIQUETA_BASE}`

// Seccion Conexiones de la ficha de un dispositivo: lista sus enlaces
// e instalaciones (navegables a la ficha del otro extremo) y permite
// agregar o quitar conexiones. Re-autorizada al sistema Nocturne
// (handoff "Rediseño de aplicación empresarial", Ficha de
// Dispositivo.dc.html): la logica y los datos no cambian.
export function ConexionesFicha({ dispositivo }: { dispositivo: Dispositivo }) {
  const conexiones = useLiveQuery(
    () =>
      db.conexiones
        .where('origenId')
        .equals(dispositivo.id)
        .or('destinoId')
        .equals(dispositivo.id)
        .toArray(),
    [dispositivo.id],
    [],
  )

  // Nombres vivos de los demás equipos (fase N1, regla de referencia
  // viva): la conexión guarda el nombre del otro extremo como copia de
  // referencia, pero si el equipo existe local se muestra su nombre
  // actual, así renombrar un switch se refleja en todas sus conexiones
  // sin reescribir nada. La copia solo se usa si el equipo no sincronizó
  // o fue eliminado.
  const nombrePorId = useLiveQuery(
    async () => mapaDeTextos(await db.dispositivos.toArray(), (d) => d.nombre),
    [],
    new Map<string, string>(),
  )

  const grupos = useMemo(() => agruparConexiones(conexiones ?? [], dispositivo.id), [conexiones, dispositivo.id])
  const [agregando, setAgregando] = useState(false)

  const total =
    grupos.instaladoEn.length + grupos.contiene.length + grupos.enlaces.length + grupos.relacionados.length

  async function quitar(conexion: Conexion) {
    await eliminarRegistro('conexiones', conexion.id)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <TituloSeccion>Conexiones</TituloSeccion>
        <Link
          to={`/red/topologia/${dispositivo.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-noct-accent-300 hover:text-noct-accent-400"
        >
          Ver en topología
          <CaretRight size={12} aria-hidden />
        </Link>
      </div>

      {total === 0 && !agregando && (
        <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4 text-center text-sm text-noct-neutral-500">
          Sin conexiones registradas
        </p>
      )}

      {grupos.instaladoEn.length > 0 && (
        <GrupoConexiones titulo="Instalado en">
          {grupos.instaladoEn.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.contiene.length > 0 && (
        <GrupoConexiones titulo="Contiene">
          {grupos.contiene.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.enlaces.length > 0 && (
        <GrupoConexiones titulo="Enlaces">
          {grupos.enlaces.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.relacionados.length > 0 && (
        <GrupoConexiones titulo="Relacionados">
          {grupos.relacionados.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} nombrePorId={nombrePorId} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {agregando ? (
        <FormularioConexion dispositivo={dispositivo} onCerrar={() => setAgregando(false)} />
      ) : (
        <button type="button" onClick={() => setAgregando(true)} className={`${BTN_GHOST_ACENTO} self-start`}>
          <Plus size={13} aria-hidden />
          Agregar conexión
        </button>
      )}
    </section>
  )
}

function GrupoConexiones({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] text-noct-neutral-500">{titulo}</p>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function FilaConexion({
  extremo,
  nombrePorId,
  onQuitar,
}: {
  extremo: ExtremoConexion
  nombrePorId: Map<string, string>
  onQuitar: (conexion: Conexion) => Promise<void>
}) {
  const { conexion, otroId, otroNombre, puertoLocal, puertoRemoto } = extremo
  const nombre = nombreVivo(nombrePorId, otroId, otroNombre)
  const detalle = [
    puertoLocal && `Puerto ${puertoLocal}`,
    puertoRemoto && `→ puerto ${puertoRemoto}`,
    conexion.medio,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-center gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <Link to={`/dispositivos/${otroId}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-noct-text">{nombre}</p>
        {(detalle || conexion.notas) && (
          <p className="truncate text-xs text-noct-neutral-400">{detalle || conexion.notas}</p>
        )}
      </Link>
      <button
        type="button"
        onClick={() => void onQuitar(conexion)}
        aria-label="Quitar conexión"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-noct-neutral-500 hover:bg-noct-text/[.05] hover:text-noct-text"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  )
}

function FormularioConexion({
  dispositivo,
  onCerrar,
}: {
  dispositivo: Dispositivo
  onCerrar: () => void
}) {
  const todos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn && d.id !== dispositivo.id).toArray(),
    [dispositivo.id],
    [],
  )

  const [modo, setModo] = useState<ModoConexion>('enlace')
  const [busqueda, setBusqueda] = useState('')
  const [otro, setOtro] = useState<Dispositivo | null>(null)
  const [puertoLocal, setPuertoLocal] = useState('')
  const [puertoRemoto, setPuertoRemoto] = useState('')
  const [medio, setMedio] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  const coincidencias = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return []
    return (todos ?? [])
      .filter((d) => [d.nombre, d.ubicacion, d.ip].join(' ').toLowerCase().includes(texto))
      .slice(0, 8)
  }, [todos, busqueda])

  async function guardar() {
    if (!otro) return
    setGuardando(true)

    const { tipo, origenEsteDispositivo, conPuertos } = datosSegunModo(modo)
    const origen = origenEsteDispositivo ? dispositivo : otro
    const destino = origenEsteDispositivo ? otro : dispositivo
    // Los campos del formulario son siempre "puerto en este equipo" y
    // "puerto en el otro"; segun el sentido (N1), eso mapea a origen o
    // a destino.
    const puertoEnOrigen = origenEsteDispositivo ? puertoLocal : puertoRemoto
    const puertoEnDestino = origenEsteDispositivo ? puertoRemoto : puertoLocal

    await guardarRegistro('conexiones', {
      id: nuevoId(),
      tipo,
      origenId: origen.id,
      origenNombre: origen.nombre,
      origenPuerto: conPuertos ? puertoEnOrigen.trim() : '',
      destinoId: destino.id,
      destinoNombre: destino.nombre,
      destinoPuerto: conPuertos ? puertoEnDestino.trim() : '',
      medio: conPuertos ? medio.trim() : '',
      notas: notas.trim(),
    })

    onCerrar()
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-noct-text">Nueva conexión</p>
        <button type="button" onClick={onCerrar} className="text-xs text-noct-neutral-500 hover:text-noct-text">
          Cancelar
        </button>
      </div>

      <label className={CLASE_ETIQUETA}>
        Tipo de relación
        <select
          value={modo}
          onChange={(e) => setModo(e.target.value as ModoConexion)}
          className={`min-h-11 ${CLASE_CAMPO}`}
        >
          <option value="enlace">Da servicio a (uplink hacia otro equipo)</option>
          <option value="recibeDe">Recibe servicio de (uplink desde otro equipo)</option>
          <option value="instalado">Está instalado en (rack)</option>
          <option value="contiene">Contiene el equipo (este es un rack)</option>
          <option value="relacionado">Relacionado con (equipo no de red)</option>
        </select>
      </label>

      {otro ? (
        <div className="flex items-center gap-2 rounded-md border border-noct-accent/30 bg-noct-accent/[.08] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-noct-text">{otro.nombre}</p>
            {otro.ubicacion && <p className="truncate text-xs text-noct-neutral-400">{otro.ubicacion}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOtro(null)
              setBusqueda('')
            }}
            className="shrink-0 text-xs text-noct-neutral-500 hover:text-noct-text"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar el otro equipo por nombre, ubicación o IP..."
            className={`min-h-11 ${CLASE_CAMPO}`}
          />
          {coincidencias.length > 0 && (
            <ul className="flex flex-col gap-1">
              {coincidencias.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setOtro(d)}
                    className="w-full rounded-md border border-noct-divider bg-noct-bg px-3 py-2 text-left hover:border-noct-accent"
                  >
                    <p className="text-sm text-noct-text">{d.nombre}</p>
                    {(d.ubicacion || d.ip) && (
                      <p className="text-xs text-noct-neutral-400">
                        {[d.ubicacion, d.ip].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(modo === 'enlace' || modo === 'recibeDe') && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className={CLASE_ETIQUETA}>
              Puerto en {dispositivo.nombre || 'este equipo'}
              <input
                type="text"
                value={puertoLocal}
                onChange={(e) => setPuertoLocal(e.target.value)}
                placeholder="Ej. 18"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>
            <label className={CLASE_ETIQUETA}>
              Puerto en el otro
              <input
                type="text"
                value={puertoRemoto}
                onChange={(e) => setPuertoRemoto(e.target.value)}
                placeholder="Opcional"
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>
          </div>
          <label className={CLASE_ETIQUETA}>
            Medio
            <input
              type="text"
              list="medios-conexion"
              value={medio}
              onChange={(e) => setMedio(e.target.value)}
              placeholder="UTP, fibra óptica..."
              className={`min-h-11 ${CLASE_CAMPO}`}
            />
            <datalist id="medios-conexion">
              {MEDIOS_SUGERIDOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>
      )}

      {modo === 'relacionado' && (
        <p className="rounded-md border border-noct-divider bg-noct-bg px-3 py-2 text-xs text-noct-neutral-400">
          Relaciona dos equipos que no son de red (por ejemplo un POS con su impresora). Aparece en la ficha de
          ambos, sin puertos ni medio, y no entra en la topología.
        </p>
      )}

      <label className={CLASE_ETIQUETA}>
        Notas (opcional)
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className={`min-h-11 ${CLASE_CAMPO}`}
        />
      </label>

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={!otro || guardando}
        className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
      >
        {guardando ? 'Guardando...' : 'Guardar conexión'}
      </button>
    </div>
  )
}
