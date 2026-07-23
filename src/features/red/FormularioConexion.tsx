import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, type Dispositivo } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  candidatosConexion,
  datosSegunModo,
  MEDIOS_SUGERIDOS,
  proximoPuertoLibre,
  ubicacionHeredable,
  type ExtremoConexion,
  type ModoConexion,
} from '../../lib/conexiones'
import { idsDeRed } from '../../lib/categorias'
import { Monitor, Plus } from '../../components/iconos'
import { BTN_GHOST, BTN_GHOST_ACENTO, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { CLASE_CAMPO, CLASE_CAMPO_SOBRE_SUPERFICIE, CLASE_ETIQUETA as CLASE_ETIQUETA_BASE } from '../../components/campos'

// Aquí el rótulo se aplica al propio `<label>`, que además apila el
// texto sobre el control, así que suma el flex al rótulo compartido.
const CLASE_ETIQUETA = `flex flex-col gap-1.5 ${CLASE_ETIQUETA_BASE}`

const TIPOS_CONEXION: { valor: ModoConexion; nombre: string; ayuda: string }[] = [
  { valor: 'enlace', nombre: 'Da servicio a', ayuda: 'Este equipo da servicio al otro por un puerto (uplink). Entra en la topología.' },
  {
    valor: 'recibeDe',
    nombre: 'Recibe de',
    ayuda: 'El otro equipo te da servicio por un puerto (uplink). Entra en la topología.',
  },
  { valor: 'instalado', nombre: 'Instalado en', ayuda: 'Este equipo está montado dentro del otro (un rack).' },
  { valor: 'contiene', nombre: 'Contiene', ayuda: 'El otro equipo está montado dentro de este.' },
  {
    valor: 'relacionado',
    nombre: 'Relacionado',
    ayuda: 'Vincula equipos que no son de red (un POS con su impresora). No entra en la topología.',
  },
]

// Alta de una conexión, compartida entre ConexionesFicha.tsx (ficha de
// dispositivo) y TopologiaEquipoPage.tsx (hallazgo D1 de
// AUDITORIA_FLUJOS_TI.md): antes eran dos implementaciones casi
// idénticas ya divergidas (el medio por defecto arrancaba vacío en una
// y en UTP en la otra, MEDIOS_SUGERIDOS[0] ya es UTP). Con esto el
// estado y la lógica de guardado son ÚNICOS; `variante` solo controla
// el "chrome" visual que cada pantalla ya tenía antes de esta tarea
// (select vs chips para el tipo de relación, datalist vs chips para el
// medio, encabezado propio vs footer con Cancelar aparte).
export function FormularioConexion({
  dispositivo,
  enlaces,
  variante,
  onCerrar,
}: {
  dispositivo: Dispositivo
  enlaces: ExtremoConexion[]
  variante: 'ficha' | 'topologia'
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
  // Hallazgo D1: unificado en UTP (MEDIOS_SUGERIDOS[0]) en las dos
  // pantallas; antes arrancaba vacío en la ficha y en UTP en la
  // topología.
  const [medio, setMedio] = useState(MEDIOS_SUGERIDOS[0])
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

  // Hallazgo N3: si este equipo todavía no tiene ubicación y el otro
  // extremo sí, se ofrece copiarla (nunca se pisa una ya cargada).
  const [heredandoUbicacion, setHeredandoUbicacion] = useState(false)
  const sugerenciaUbicacion = useMemo(
    () => (otro ? ubicacionHeredable(dispositivo, otro) : null),
    [dispositivo, otro],
  )
  async function heredarUbicacion() {
    if (!sugerenciaUbicacion) return
    setHeredandoUbicacion(true)
    await guardarRegistro('dispositivos', { ...dispositivo, ...sugerenciaUbicacion })
    setHeredandoUbicacion(false)
  }

  const tipoActual = TIPOS_CONEXION.find((t) => t.valor === modo)
  const esEnlace = modo === 'enlace' || modo === 'recibeDe'

  // `cerrarAlTerminar` en false es "Guardar y agregar otra" (hallazgo
  // O2, solo disponible en la variante `ficha`): conserva el tipo de
  // relacion elegido (lo tedioso de re-elegir) y solo limpia el resto,
  // sin cerrar el formulario.
  async function guardar(cerrarAlTerminar: boolean) {
    if (!otro || guardando) return
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
    setMedio(MEDIOS_SUGERIDOS[0])
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

  const claseChip = (activo: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium ${
      activo
        ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
        : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
    }`
  const claseCampoTopologia = `${CLASE_CAMPO_SOBRE_SUPERFICIE} min-h-11`

  return (
    <div
      className={
        variante === 'ficha'
          ? 'flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3'
          : 'mb-3 flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3'
      }
    >
      {variante === 'ficha' && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-noct-text">Nueva conexión</p>
          <button type="button" onClick={onCerrar} className="text-xs text-noct-neutral-500 hover:text-noct-text">
            Cancelar
          </button>
        </div>
      )}

      {variante === 'ficha' ? (
        <label className={CLASE_ETIQUETA}>
          Tipo de relación
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as ModoConexion)}
            className={`min-h-11 ${CLASE_CAMPO}`}
          >
            {TIPOS_CONEXION.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-noct-neutral-500">Tipo de relación</span>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_CONEXION.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setModo(t.valor)}
                aria-pressed={t.valor === modo}
                className={claseChip(t.valor === modo)}
              >
                {t.nombre}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] leading-normal text-noct-neutral-600">{tipoActual?.ayuda}</p>
        </div>
      )}

      {otro && (
        <div
          className={
            variante === 'ficha'
              ? 'flex items-center gap-2 rounded-md border border-noct-accent/30 bg-noct-accent/[.08] px-3 py-2'
              : 'flex items-center justify-between gap-2 rounded-md border border-noct-accent/30 bg-noct-accent/[.08] px-3 py-2.5'
          }
        >
          {variante === 'ficha' ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-noct-text">{otro.nombre}</p>
              {otro.ubicacion && <p className="truncate text-xs text-noct-neutral-400">{otro.ubicacion}</p>}
            </div>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-2 text-[13.5px] text-noct-text">
              <Monitor size={15} className="shrink-0 text-noct-accent-300" aria-hidden />
              <span className="truncate">{otro.nombre}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setOtro(null)
              setBusqueda('')
            }}
            className={
              variante === 'ficha'
                ? 'shrink-0 text-xs text-noct-neutral-500 hover:text-noct-text'
                : 'shrink-0 p-1.5 text-[12px] text-noct-neutral-500 hover:text-noct-text'
            }
          >
            Cambiar
          </button>
        </div>
      )}

      {otro && sugerenciaUbicacion && (
        <div className="flex items-center justify-between gap-2.5 rounded-md border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-[13px] py-2.5">
          <p className="text-[12.5px] leading-relaxed text-noct-precaucion">
            Este equipo no tiene ubicación. ¿Copiar &quot;{sugerenciaUbicacion.ubicacion}&quot; desde{' '}
            {otro.nombre}?
          </p>
          <button
            type="button"
            disabled={heredandoUbicacion}
            onClick={heredarUbicacion}
            className="shrink-0 whitespace-nowrap text-[12px] font-medium text-noct-precaucion underline disabled:opacity-50"
          >
            {heredandoUbicacion ? 'Copiando...' : 'Copiar ubicación'}
          </button>
        </div>
      )}

      {!otro && (
        <div className={variante === 'ficha' ? 'flex flex-col gap-2' : 'flex flex-col gap-1.5'}>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={
              variante === 'ficha'
                ? 'Buscar el otro equipo por nombre, ubicación o IP...'
                : 'Buscar el otro equipo por nombre, ubicación o IP'
            }
            className={
              variante === 'ficha'
                ? `min-h-11 ${CLASE_CAMPO}`
                : `${claseCampoTopologia} [&::-webkit-search-cancel-button]:hidden`
            }
          />
          {coincidencias.length > 0 && (
            <div className="flex flex-col gap-1">
              {!busqueda.trim() && (
                <p className="text-[11.5px] text-noct-neutral-500">
                  Sugeridos por ubicación o tipo de red
                </p>
              )}
              {coincidencias.map((d) =>
                variante === 'ficha' ? (
                  <button
                    key={d.id}
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
                ) : (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setOtro(d)
                      setBusqueda('')
                    }}
                    className="flex min-h-11 items-center gap-2.5 rounded-md border border-noct-divider bg-noct-surface px-2.5 text-left text-noct-text hover:border-noct-accent"
                  >
                    <Monitor size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{d.nombre}</span>
                    {d.ip && <span className="font-mono text-[11px] text-noct-neutral-600">{d.ip}</span>}
                  </button>
                ),
              )}
            </div>
          )}

          {/* Alta rapida del otro extremo (hallazgo O3): el equipo puede
              no existir todavia en el inventario (se acaba de instalar).
              Mismo patron "buscar o crear" que SelectorUbicacion/
              SelectorPersona. Solo en la variante `ficha`: es la que ya
              la tenia; unificar el chrome no exige llevarla a la otra
              pantalla en esta tarea. */}
          {variante === 'ficha' &&
            (creandoEquipo ? (
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
            ))}
        </div>
      )}

      {esEnlace && (
        <div className="flex flex-col gap-2">
          <div className={variante === 'ficha' ? 'grid grid-cols-2 gap-2' : 'flex gap-2.5'}>
            <label className={variante === 'ficha' ? CLASE_ETIQUETA : 'flex flex-1 flex-col gap-1.5'}>
              <span className={variante === 'ficha' ? undefined : 'text-[12px] text-noct-neutral-500'}>
                {variante === 'ficha' ? `Puerto en ${dispositivo.nombre || 'este equipo'}` : 'Puerto aquí'}
              </span>
              <input
                type="text"
                value={puertoLocal}
                onChange={(e) => setPuertoLocal(e.target.value)}
                placeholder={variante === 'ficha' ? 'Ej. 18' : '3'}
                className={variante === 'ficha' ? `min-h-11 ${CLASE_CAMPO}` : `${claseCampoTopologia} font-mono`}
              />
            </label>
            <label className={variante === 'ficha' ? CLASE_ETIQUETA : 'flex flex-1 flex-col gap-1.5'}>
              <span className={variante === 'ficha' ? undefined : 'text-[12px] text-noct-neutral-500'}>
                Puerto en el otro
              </span>
              <input
                type="text"
                value={puertoRemoto}
                onChange={(e) => setPuertoRemoto(e.target.value)}
                placeholder="Opcional"
                className={variante === 'ficha' ? `min-h-11 ${CLASE_CAMPO}` : `${claseCampoTopologia} font-mono`}
              />
            </label>
          </div>
          {variante === 'ficha' ? (
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
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] text-noct-neutral-500">Medio</span>
              <div className="flex flex-wrap gap-1.5">
                {MEDIOS_SUGERIDOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMedio(m)}
                    aria-pressed={medio === m}
                    className={claseChip(medio === m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modo === 'relacionado' && (
        <p className="rounded-md border border-noct-divider bg-noct-bg px-3 py-2 text-xs text-noct-neutral-400">
          Relaciona dos equipos que no son de red (por ejemplo un POS con su impresora). Aparece en la ficha de
          ambos, sin puertos ni medio, y no entra en la topología.
        </p>
      )}

      {variante === 'ficha' && (
        <label className={CLASE_ETIQUETA}>
          Notas (opcional)
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={`min-h-11 ${CLASE_CAMPO}`}
          />
        </label>
      )}

      <div className={variante === 'ficha' ? 'flex flex-wrap gap-2' : 'flex gap-2'}>
        <button
          type="button"
          onClick={() => void guardar(true)}
          disabled={!otro || guardando}
          className={
            variante === 'ficha'
              ? `${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-50`
              : `${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-55`
          }
        >
          {guardando ? 'Guardando...' : 'Guardar conexión'}
        </button>
        {variante === 'ficha' ? (
          // "Guardar y agregar otra" (hallazgo O2): un equipo suele tener
          // varias conexiones del MISMO tipo (un switch con 20 uplinks a
          // puntos de red, por ejemplo); conserva el tipo de relación
          // elegido y deja el formulario abierto para la siguiente.
          <button
            type="button"
            onClick={() => void guardar(false)}
            disabled={!otro || guardando}
            className={`${BTN_SECUNDARIO} min-h-11 px-4 disabled:opacity-50`}
          >
            Guardar y agregar otra
          </button>
        ) : (
          <button type="button" onClick={onCerrar} className={`${BTN_GHOST} min-h-11 px-3`}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
