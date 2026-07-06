import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Conexion, type Dispositivo, type TipoConexion } from '../../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  agruparConexiones,
  MEDIOS_SUGERIDOS,
  type ExtremoConexion,
} from '../../lib/conexiones'

// Relacion nueva vista desde la ficha actual: define quien es origen y
// quien destino segun lo que el tecnico quiere documentar.
type Modo = 'enlace' | 'instalado' | 'contiene'

// Seccion Conexiones de la ficha de un dispositivo: lista sus enlaces
// e instalaciones (navegables a la ficha del otro extremo) y permite
// agregar o quitar conexiones.
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

  const grupos = useMemo(() => agruparConexiones(conexiones ?? [], dispositivo.id), [conexiones, dispositivo.id])
  const [agregando, setAgregando] = useState(false)

  const total = grupos.instaladoEn.length + grupos.contiene.length + grupos.enlaces.length

  async function quitar(conexion: Conexion) {
    await eliminarRegistro('conexiones', conexion.id)
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-400">Conexiones</h2>
        <Link
          to={`/red/topologia/${dispositivo.id}`}
          className="text-xs text-sky-400 underline decoration-dotted underline-offset-2"
        >
          Ver en topología →
        </Link>
      </div>

      {total === 0 && !agregando && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-4 text-center text-sm text-slate-500">
          Sin conexiones registradas
        </p>
      )}

      {grupos.instaladoEn.length > 0 && (
        <GrupoConexiones titulo="Instalado en">
          {grupos.instaladoEn.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.contiene.length > 0 && (
        <GrupoConexiones titulo="Contiene">
          {grupos.contiene.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {grupos.enlaces.length > 0 && (
        <GrupoConexiones titulo="Enlaces">
          {grupos.enlaces.map((extremo) => (
            <FilaConexion key={extremo.conexion.id} extremo={extremo} onQuitar={quitar} />
          ))}
        </GrupoConexiones>
      )}

      {agregando ? (
        <FormularioConexion dispositivo={dispositivo} onCerrar={() => setAgregando(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          className="rounded-xl border border-slate-800 px-4 py-2.5 text-sm text-sky-400"
        >
          + Agregar conexión
        </button>
      )}
    </section>
  )
}

function GrupoConexiones({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-slate-500">{titulo}</p>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function FilaConexion({
  extremo,
  onQuitar,
}: {
  extremo: ExtremoConexion
  onQuitar: (conexion: Conexion) => Promise<void>
}) {
  const { conexion, otroId, otroNombre, puertoLocal, puertoRemoto } = extremo
  const detalle = [
    puertoLocal && `Puerto ${puertoLocal}`,
    puertoRemoto && `→ puerto ${puertoRemoto}`,
    conexion.medio,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5">
      <Link to={`/dispositivos/${otroId}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{otroNombre}</p>
        {(detalle || conexion.notas) && (
          <p className="truncate text-xs text-slate-400">{detalle || conexion.notas}</p>
        )}
      </Link>
      <button
        type="button"
        onClick={() => void onQuitar(conexion)}
        aria-label="Quitar conexión"
        className="shrink-0 rounded-lg border border-slate-800 px-2 py-1 text-slate-400"
      >
        ×
      </button>
    </li>
  )
}

const CLASE_CAMPO =
  'rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500'

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

  const [modo, setModo] = useState<Modo>('enlace')
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

    const esInstalacion = modo !== 'enlace'
    const tipo: TipoConexion = esInstalacion ? 'instalacion' : 'enlace'
    // En 'contiene' el equipo seleccionado es el que se instala en
    // este (este es el rack); en el resto, este es el origen.
    const origenEsteDispositivo = modo !== 'contiene'
    const origen = origenEsteDispositivo ? dispositivo : otro
    const destino = origenEsteDispositivo ? otro : dispositivo

    await guardarRegistro('conexiones', {
      id: nuevoId(),
      tipo,
      origenId: origen.id,
      origenNombre: origen.nombre,
      origenPuerto: esInstalacion ? '' : puertoLocal.trim(),
      destinoId: destino.id,
      destinoNombre: destino.nombre,
      destinoPuerto: esInstalacion ? '' : puertoRemoto.trim(),
      medio: esInstalacion ? '' : medio.trim(),
      notas: notas.trim(),
    })

    onCerrar()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">Nueva conexión</p>
        <button type="button" onClick={onCerrar} className="text-xs text-slate-400">
          Cancelar
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Tipo de relación
        <select value={modo} onChange={(e) => setModo(e.target.value as Modo)} className={CLASE_CAMPO}>
          <option value="enlace">Enlace hacia otro equipo</option>
          <option value="instalado">Está instalado en (rack)</option>
          <option value="contiene">Contiene el equipo (este es un rack)</option>
        </select>
      </label>

      {otro ? (
        <div className="flex items-center gap-2 rounded-xl border border-sky-900/60 bg-sky-950/30 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-100">{otro.nombre}</p>
            {otro.ubicacion && <p className="truncate text-xs text-slate-400">{otro.ubicacion}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOtro(null)
              setBusqueda('')
            }}
            className="shrink-0 text-xs text-slate-400"
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
            className={CLASE_CAMPO}
          />
          {coincidencias.length > 0 && (
            <ul className="flex flex-col gap-1">
              {coincidencias.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setOtro(d)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left"
                  >
                    <p className="text-sm text-slate-100">{d.nombre}</p>
                    {(d.ubicacion || d.ip) && (
                      <p className="text-xs text-slate-400">
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

      {modo === 'enlace' && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Puerto en {dispositivo.nombre || 'este equipo'}
              <input
                type="text"
                value={puertoLocal}
                onChange={(e) => setPuertoLocal(e.target.value)}
                placeholder="Ej. 18"
                className={CLASE_CAMPO}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Puerto en el otro
              <input
                type="text"
                value={puertoRemoto}
                onChange={(e) => setPuertoRemoto(e.target.value)}
                placeholder="Opcional"
                className={CLASE_CAMPO}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Medio
            <input
              type="text"
              list="medios-conexion"
              value={medio}
              onChange={(e) => setMedio(e.target.value)}
              placeholder="UTP, fibra óptica..."
              className={CLASE_CAMPO}
            />
            <datalist id="medios-conexion">
              {MEDIOS_SUGERIDOS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Notas (opcional)
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className={CLASE_CAMPO}
        />
      </label>

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={!otro || guardando}
        className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50"
      >
        {guardando ? 'Guardando...' : 'Guardar conexión'}
      </button>
    </div>
  )
}
