import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, type Conexion, type Dispositivo } from '../../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  agruparConexiones,
  candidatosConexion,
  datosSegunModo,
  MEDIOS_SUGERIDOS,
  proximoPuertoLibre,
  type ExtremoConexion,
  type ModoConexion,
} from '../../lib/conexiones'
import { idsDeRed } from '../../lib/categorias'
import { mapaDeTextos, nombreVivo } from '../../lib/referencia'
import { CaretRight, Plus, X } from '../../components/iconos'
import { BTN_GHOST_ACENTO, BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
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
        <FormularioConexion
          dispositivo={dispositivo}
          enlaces={grupos.enlaces}
          onCerrar={() => setAgregando(false)}
        />
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
  enlaces,
  onCerrar,
}: {
  dispositivo: Dispositivo
  enlaces: ExtremoConexion[]
  onCerrar: () => void
}) {
  const todos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn && d.id !== dispositivo.id).toArray(),
    [dispositivo.id],
    [],
  )
  // Categorias para el alta rapida de equipo (hallazgo O3): mismo orden
  // que usa DispositivoForm, categoria_id es NOT NULL en el esquema asi
  // que hace falta elegir una.
  const categorias = useLiveQuery(() => db.categorias.filter((c) => !c.eliminadoEn).sortBy('orden'), [], [])

  const [modo, setModo] = useState<ModoConexion>('enlace')
  const [busqueda, setBusqueda] = useState('')
  const [otro, setOtro] = useState<Dispositivo | null>(null)
  // Hallazgo N4: arranca en el menor puerto libre de este equipo, visto
  // desde sus enlaces ya registrados. Sigue siendo editable: es una
  // propuesta, no una imposición.
  const [puertoLocal, setPuertoLocal] = useState(() => proximoPuertoLibre(enlaces))
  const [puertoRemoto, setPuertoRemoto] = useState('')
  const [medio, setMedio] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Alta rapida del otro extremo (hallazgo O3): cuando el equipo todavia
  // no existe en el inventario, se crea sin salir de este formulario,
  // mismo patron "buscar o crear inline" que SelectorUbicacion/
  // SelectorPersona (nombre + lo minimo que exige el esquema, aqui
  // categoria).
  const [creandoEquipo, setCreandoEquipo] = useState(false)
  const [nombreEquipoNuevo, setNombreEquipoNuevo] = useState('')
  const [categoriaEquipoNuevo, setCategoriaEquipoNuevo] = useState('')
  const [guardandoEquipo, setGuardandoEquipo] = useState(false)

  // Hallazgo N5: prioriza equipos de la misma ubicación o de categoría
  // de red, y pre-sugiere sin necesidad de teclear cuando alguno aplica.
  const idsRed = useMemo(() => idsDeRed(categorias), [categorias])
  const coincidencias = useMemo(
    () => candidatosConexion(todos ?? [], busqueda, dispositivo, idsRed),
    [todos, busqueda, dispositivo, idsRed],
  )

  // `cerrarAlTerminar` en false es "Guardar y agregar otra" (hallazgo
  // O2): conserva el tipo de relacion elegido (lo tedioso de re-elegir)
  // y solo limpia el resto, sin cerrar el formulario.
  async function guardar(cerrarAlTerminar: boolean) {
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

    if (cerrarAlTerminar) {
      onCerrar()
      return
    }
    setOtro(null)
    setBusqueda('')
    // Sigue sugiriendo el siguiente puerto libre (hallazgo N4): la lista
    // de enlaces del prop aún no incluye el que se acaba de guardar, así
    // que se suma a mano el puerto recién usado antes de recalcular.
    setPuertoLocal(conPuertos ? proximoPuertoLibre([...enlaces, { puertoLocal: puertoLocal.trim() }]) : '')
    setPuertoRemoto('')
    setMedio('')
    setNotas('')
    setGuardando(false)
  }

  async function crearEquipo() {
    const nombre = nombreEquipoNuevo.trim()
    if (nombre === '' || categoriaEquipoNuevo === '') return
    setGuardandoEquipo(true)
    const id = nuevoId()
    await guardarRegistro('dispositivos', {
      id,
      categoriaId: categoriaEquipoNuevo,
      nombre,
      marca: '',
      modelo: '',
      serial: '',
      placaInventario: '',
      ubicacion: '',
      ubicacionId: null,
      responsable: '',
      responsableId: null,
      reemplazaA: null,
      ip: '',
      estado: 'Operativo',
      observaciones: '',
      detalles: {},
      foto: null,
    })
    // Se relee de la base (en vez de fabricar el objeto a mano) para
    // usar la fila real, con updatedAt/updatedBy que puso el repositorio.
    const creado = await db.dispositivos.get(id)
    if (creado) setOtro(creado)
    setCreandoEquipo(false)
    setNombreEquipoNuevo('')
    setCategoriaEquipoNuevo('')
    setGuardandoEquipo(false)
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
            <>
              {!busqueda.trim() && (
                <p className="text-[11.5px] text-noct-neutral-500">
                  Sugeridos por ubicación o tipo de red
                </p>
              )}
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
            </>
          )}

          {/* Alta rapida del otro extremo (hallazgo O3): el equipo puede
              no existir todavia en el inventario (se acaba de instalar).
              Mismo patron "buscar o crear" que SelectorUbicacion/
              SelectorPersona. */}
          {creandoEquipo ? (
            <div className="flex flex-col gap-2 rounded-md border border-noct-divider bg-noct-surface/60 px-3 py-3">
              <input
                type="text"
                value={nombreEquipoNuevo}
                onChange={(e) => setNombreEquipoNuevo(e.target.value)}
                placeholder="Nombre del equipo nuevo"
                className={`min-h-11 ${CLASE_CAMPO}`}
                autoFocus
              />
              <select
                value={categoriaEquipoNuevo}
                onChange={(e) => setCategoriaEquipoNuevo(e.target.value)}
                className={`min-h-11 ${CLASE_CAMPO}`}
              >
                <option value="">Elige una categoría...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void crearEquipo()}
                  disabled={guardandoEquipo || nombreEquipoNuevo.trim() === '' || categoriaEquipoNuevo === ''}
                  className={`${BTN_PRIMARIO} disabled:opacity-50`}
                >
                  {guardandoEquipo ? 'Creando...' : 'Crear y usar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreandoEquipo(false)
                    setNombreEquipoNuevo('')
                    setCategoriaEquipoNuevo('')
                  }}
                  className={BTN_SECUNDARIO}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCreandoEquipo(true)
                setNombreEquipoNuevo(busqueda.trim())
              }}
              className={`self-start ${BTN_GHOST_ACENTO}`}
            >
              <Plus size={13} aria-hidden />
              Crear equipo nuevo
            </button>
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void guardar(true)}
          disabled={!otro || guardando}
          className={`${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-50`}
        >
          {guardando ? 'Guardando...' : 'Guardar conexión'}
        </button>
        {/* "Guardar y agregar otra" (hallazgo O2): un equipo suele tener
            varias conexiones del MISMO tipo (un switch con 20 uplinks a
            puntos de red, por ejemplo); conserva el tipo de relación
            elegido y deja el formulario abierto para la siguiente. */}
        <button
          type="button"
          onClick={() => void guardar(false)}
          disabled={!otro || guardando}
          className={`${BTN_SECUNDARIO} min-h-11 px-4 disabled:opacity-50`}
        >
          Guardar y agregar otra
        </button>
      </div>
    </div>
  )
}
