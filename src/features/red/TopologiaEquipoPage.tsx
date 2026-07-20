import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db, type Conexion, type Dispositivo, type TipoConexion } from '../../lib/db'
import { ShellNocturne } from '../../app/ShellNocturne'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import { agruparConexiones, MEDIOS_SUGERIDOS, type ExtremoConexion } from '../../lib/conexiones'
import { mapaDeTextos, nombreVivo } from '../../lib/referencia'
import { CaretRight, CaretDown, Monitor, Plus, TreeStructure, Warning, X } from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { BotonVolver } from '../../components/BotonVolver'
import { IconoNodo } from './IconoNodo'
import { construirArbol, contarDescendientes, contarImpacto, infoDeDispositivos, type NodoTopologia } from './arbol'
import { claseEstado, detalleDeNodo, estadoConEtiqueta, tipoDeNodoVisual } from './topologiaVisual'

// Topología de un equipo re-autorizada en el sistema Nocturne (handoff
// "Rediseño de aplicación empresarial", Topología de Equipo.dc.html).
// Es la vista de topología centrada en UN dispositivo (ruta
// /red/topologia/:dispositivoId): antes solo mostraba un árbol pelado
// en tema claro; ahora es una pantalla rica que responde de un vistazo
// "¿de qué depende?", "¿qué se cae si falla?" y "¿qué depende de él?",
// más el editor de conexiones. La lógica y los datos son los mismos que
// ya usan la ficha y el mapa de red: árbol de topología (arbol.ts),
// agrupación de conexiones (conexiones.ts) y el guardado real
// (repositorio.ts); esta pantalla solo compone esas piezas con el
// aspecto del mockup. El bosque general (/red/topologia, sin equipo)
// sigue en TopologiaPage hasta su propia re-autoría (tarea 92).

// Tipo de relación del formulario de "Agregar conexión": define quién
// es origen y quién destino según lo que el técnico quiere documentar.
// Mismo criterio que el editor de la ficha (ConexionesFicha).
type ModoConexion = 'enlace' | 'instalado' | 'contiene' | 'relacionado'

const TIPOS_CONEXION: { valor: ModoConexion; nombre: string; ayuda: string }[] = [
  { valor: 'enlace', nombre: 'Enlace', ayuda: 'Este equipo da servicio al otro por un puerto. Entra en la topología.' },
  { valor: 'instalado', nombre: 'Instalado en', ayuda: 'Este equipo está montado dentro del otro (un rack).' },
  { valor: 'contiene', nombre: 'Contiene', ayuda: 'El otro equipo está montado dentro de este.' },
  {
    valor: 'relacionado',
    nombre: 'Relacionado',
    ayuda: 'Vincula equipos que no son de red (un POS con su impresora). No entra en la topología.',
  },
]

export function TopologiaEquipoPage() {
  const { dispositivoId = '' } = useParams()

  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  const equipo = (dispositivos ?? []).find((d) => d.id === dispositivoId)

  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )
  const nombrePorId = useLiveQuery(
    async () => mapaDeTextos(await db.dispositivos.toArray(), (d) => d.nombre),
    [],
    new Map<string, string>(),
  )

  const infoPorId = useMemo(() => infoDeDispositivos(dispositivos ?? []), [dispositivos])

  // Árbol de dependientes con este equipo como raíz: sus hijos son los
  // equipos a los que da servicio (enlaces) o que contiene (rack).
  const arbol = useMemo(
    () => construirArbol(dispositivoId, conexiones ?? [], infoPorId),
    [dispositivoId, conexiones, infoPorId],
  )
  const impacto = useMemo(() => contarImpacto(arbol), [arbol])
  const totalDependientes = useMemo(() => contarDescendientes(arbol), [arbol])

  // Conexiones agrupadas de este equipo (mismas cuatro categorías que
  // la ficha). "Depende de" se arma de sus padres directos: donde está
  // instalado y los enlaces que RECIBE (no los que da).
  const grupos = useMemo(
    () => agruparConexiones(conexiones ?? [], dispositivoId),
    [conexiones, dispositivoId],
  )

  const dependeDe = useMemo(() => {
    const padres: { id: string; nombre: string; via: string }[] = []
    for (const e of grupos.instaladoEn) {
      padres.push({ id: e.otroId, nombre: nombreVivo(nombrePorId, e.otroId, e.otroNombre), via: 'Instalado' })
    }
    for (const e of grupos.enlaces) {
      if (e.esOrigen) continue // los que este equipo SIRVE son hijos, no padres
      const via = e.puertoRemoto ? `Puerto ${e.puertoRemoto}` : e.conexion.medio || 'Enlace'
      padres.push({
        id: e.otroId,
        nombre: nombreVivo(nombrePorId, e.otroId, e.otroNombre),
        via: [via, e.conexion.medio && e.conexion.medio !== via ? e.conexion.medio : '']
          .filter(Boolean)
          .join(' · '),
      })
    }
    return padres
  }, [grupos, nombrePorId])

  const chipsImpacto = useMemo(() => {
    return [...impacto.entries()]
      .map(([categoriaId, cantidad]) => {
        const categoria = nombreCategoria.get(categoriaId) ?? categoriaId
        return { categoriaId, cantidad, categoria, texto: `${cantidad} ${categoria}` }
      })
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [impacto, nombreCategoria])

  const [agregando, setAgregando] = useState(false)

  if (!dispositivos || !conexiones) {
    return <ShellNocturne>{null}</ShellNocturne>
  }

  if (!equipo) {
    return (
      <ShellNocturne>
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
          <p className="text-[14.5px] font-medium">No se encontró el equipo</p>
          <Link to="/red/topologia" className={BTN_SECUNDARIO}>
            Volver a la topología
          </Link>
        </main>
      </ShellNocturne>
    )
  }

  const estado = estadoConEtiqueta(equipo.estado)

  return (
    <ShellNocturne>
      {/* Cabecera fija: retorno a la topología, acceso a la ficha e
          identidad del equipo (nombre, estado con punto de color e IP). */}
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
        <header className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-2.5">
          <BotonVolver variante="nocturne" />
          <Link to={`/dispositivos/${equipo.id}`} className={`shrink-0 ${BTN_GHOST}`}>
            <Monitor size={14} aria-hidden />
            Abrir la ficha
          </Link>
        </header>
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-noct-accent/[.14] text-noct-accent-300">
            <TreeStructure size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-medium leading-[1.3]">{equipo.nombre}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-noct-neutral-500">
              <span className={`inline-flex items-center gap-1.5 ${claseEstado(estado.etiqueta)}`}>
                <span className="h-[7px] w-[7px] rounded-full bg-current" />
                {estado.etiqueta}
              </span>
              {equipo.ip && (
                <>
                  <span className="text-noct-neutral-600">·</span>
                  <span className="font-mono text-noct-neutral-500">{equipo.ip}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-[116px] pt-4 lg:pb-16">
        {/* Depende de: padres directos, navegables a su ficha. */}
        {dependeDe.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Depende de</TituloSeccion>
            <div className="flex flex-col">
              {dependeDe.map((p) => (
                <Link
                  key={`${p.id}-${p.via}`}
                  to={`/dispositivos/${p.id}`}
                  className="flex min-h-12 items-center gap-[11px] rounded-md px-1.5 py-2 text-noct-text hover:bg-noct-text/[.05]"
                >
                  <FlechaCodoArriba className="w-6 shrink-0 text-noct-neutral-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium leading-[1.3]">{p.nombre}</span>
                    <span className="mt-px block text-[11.5px] text-noct-neutral-500">{p.via}</span>
                  </span>
                  <CaretRight size={14} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Si este equipo falla: impacto por categoría, resaltado en el
            tono de precaución. */}
        {chipsImpacto.length > 0 && (
          <section>
            <TituloSeccion className="mb-2">Si este equipo falla</TituloSeccion>
            <div className="rounded-lg border border-noct-precaucion/[.35] bg-noct-precaucion/[.08] px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[13px] leading-normal text-noct-neutral-300">
                <Warning size={14} className="shrink-0 text-noct-precaucion" aria-hidden />
                También quedarían sin servicio{' '}
                <strong className="font-medium">
                  {totalDependientes} {totalDependientes === 1 ? 'equipo' : 'equipos'}
                </strong>
                :
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {chipsImpacto.map((chip) => (
                  <span
                    key={chip.categoriaId}
                    className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-noct-divider px-2.5 text-[12px] text-noct-neutral-300"
                  >
                    <IconoNodo
                      tipo={tipoDeNodoVisual(chip.categoria)}
                      className="h-[13px] w-[13px] text-noct-neutral-400"
                    />
                    {chip.texto}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Dependen de este equipo: árbol expandible de descendientes. */}
        {arbol.hijos.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <TituloSeccion>Dependen de este equipo</TituloSeccion>
              <span className="text-[11px] text-noct-neutral-600">
                {totalDependientes} {totalDependientes === 1 ? 'equipo depende' : 'equipos dependen'}
              </span>
            </div>
            <ArbolDependientes nodo={arbol} nombreCategoria={nombreCategoria} />
          </section>
        )}

        {/* Conexiones: lista agrupada editable + alta de conexión. */}
        <ConexionesSeccion
          equipo={equipo}
          grupos={grupos}
          nombrePorId={nombrePorId}
          agregando={agregando}
          onToggleAgregar={() => setAgregando((v) => !v)}
        />
      </main>
    </ShellNocturne>
  )
}

// Árbol de descendientes: filas indentadas con caret para expandir o
// contraer, icono por tipo de equipo, detalle de cómo conecta con su
// padre y punto de estado. Todas las ramas arrancan abiertas; el
// técnico contrae lo que no necesita. Se clavea por camino (no por id)
// porque el mismo equipo puede aparecer en dos ramas.
function ArbolDependientes({
  nodo,
  nombreCategoria,
}: {
  nodo: NodoTopologia
  nombreCategoria: Map<string, string>
}) {
  const [contraidos, setContraidos] = useState<ReadonlySet<string>>(new Set())

  function alternar(clave: string) {
    setContraidos((previos) => {
      const siguientes = new Set(previos)
      if (siguientes.has(clave)) siguientes.delete(clave)
      else siguientes.add(clave)
      return siguientes
    })
  }

  return (
    <div className="flex flex-col">
      {nodo.hijos.map((hijo) => (
        <FilaArbol
          key={`${hijo.dispositivoId}·${hijo.via}`}
          nodo={hijo}
          nivel={0}
          clave={`${hijo.dispositivoId}·${hijo.via}`}
          contraidos={contraidos}
          alternar={alternar}
          nombreCategoria={nombreCategoria}
        />
      ))}
    </div>
  )
}

function FilaArbol({
  nodo,
  nivel,
  clave,
  contraidos,
  alternar,
  nombreCategoria,
}: {
  nodo: NodoTopologia
  nivel: number
  clave: string
  contraidos: ReadonlySet<string>
  alternar: (clave: string) => void
  nombreCategoria: Map<string, string>
}) {
  const tieneHijos = nodo.hijos.length > 0
  const abierto = tieneHijos && !contraidos.has(clave)
  const categoria = nombreCategoria.get(nodo.categoriaId) ?? ''
  const detalle = detalleDeNodo({ via: nodo.via, medio: nodo.medio })
  const estado = estadoConEtiqueta(nodo.estado)

  return (
    <>
      <div
        className="flex min-h-[50px] items-center gap-2 rounded-md py-1.5 pr-1"
        style={{ paddingLeft: `${4 + nivel * 20}px` }}
      >
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => alternar(clave)}
            aria-expanded={abierto}
            aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${nodo.nombre}`}
            className="flex min-h-11 w-[34px] shrink-0 items-center justify-center rounded-md text-noct-neutral-400 hover:bg-noct-text/[.06] hover:text-noct-text"
          >
            {abierto ? <CaretDown size={15} aria-hidden /> : <CaretRight size={15} aria-hidden />}
          </button>
        ) : (
          <span className="flex w-[34px] shrink-0 justify-center" aria-hidden>
            <span className="h-[5px] w-[5px] rounded-full bg-noct-neutral-700" />
          </span>
        )}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400">
          <IconoNodo tipo={tipoDeNodoVisual(categoria)} className="h-4 w-4" />
        </span>
        <Link to={`/dispositivos/${nodo.dispositivoId}`} className="min-w-0 flex-1 text-noct-text">
          <span className="block truncate text-[13.5px] font-medium leading-[1.3]">
            {nodo.nombre}
            {nodo.truncado && (
              <span className="ml-1 text-noct-precaucion" title="Ya aparece más arriba">
                ↺
              </span>
            )}
          </span>
          {detalle && <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">{detalle}</span>}
        </Link>
        <span
          title={estado.etiqueta}
          className={`h-[7px] w-[7px] shrink-0 rounded-full bg-current ${claseEstado(estado.etiqueta)}`}
        />
      </div>
      {abierto &&
        nodo.hijos.map((hijo) => (
          <FilaArbol
            key={`${clave}/${hijo.dispositivoId}·${hijo.via}`}
            nodo={hijo}
            nivel={nivel + 1}
            clave={`${clave}/${hijo.dispositivoId}·${hijo.via}`}
            contraidos={contraidos}
            alternar={alternar}
            nombreCategoria={nombreCategoria}
          />
        ))}
    </>
  )
}

function ConexionesSeccion({
  equipo,
  grupos,
  nombrePorId,
  agregando,
  onToggleAgregar,
}: {
  equipo: Dispositivo
  grupos: ReturnType<typeof agruparConexiones>
  nombrePorId: Map<string, string>
  agregando: boolean
  onToggleAgregar: () => void
}) {
  const listas: { titulo: string; items: ExtremoConexion[] }[] = [
    { titulo: 'Instalado en', items: grupos.instaladoEn },
    { titulo: 'Contiene', items: grupos.contiene },
    { titulo: 'Enlaces', items: grupos.enlaces },
    { titulo: 'Relacionados', items: grupos.relacionados },
  ].filter((g) => g.items.length > 0)

  const total =
    grupos.instaladoEn.length + grupos.contiene.length + grupos.enlaces.length + grupos.relacionados.length

  async function quitar(conexion: Conexion) {
    await eliminarRegistro('conexiones', conexion.id)
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <TituloSeccion>Conexiones</TituloSeccion>
        <button type="button" onClick={onToggleAgregar} className={BTN_GHOST}>
          <Plus size={13} aria-hidden />
          Agregar
        </button>
      </div>

      {agregando && <FormularioConexion equipo={equipo} onCerrar={onToggleAgregar} />}

      {total === 0 && !agregando && (
        <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-4 text-center text-sm text-noct-neutral-500">
          Sin conexiones registradas
        </p>
      )}

      {listas.map((grupo) => (
        <div key={grupo.titulo} className="mb-2.5">
          <p className="mb-1 px-0.5 text-[12px] text-noct-neutral-500">{grupo.titulo}</p>
          <div className="flex flex-col gap-1.5">
            {grupo.items.map((extremo) => {
              const nombre = nombreVivo(nombrePorId, extremo.otroId, extremo.otroNombre)
              const detalle = [
                extremo.puertoLocal && `Puerto ${extremo.puertoLocal}`,
                extremo.puertoRemoto && `→ puerto ${extremo.puertoRemoto}`,
                extremo.conexion.medio,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <div
                  key={extremo.conexion.id}
                  className="flex min-h-[50px] items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface py-1.5 pl-3 pr-1.5"
                >
                  <Link to={`/dispositivos/${extremo.otroId}`} className="min-w-0 flex-1 text-noct-text">
                    <span className="block truncate text-[13.5px] font-medium leading-[1.3]">{nombre}</span>
                    {(detalle || extremo.conexion.notas) && (
                      <span className="mt-px block truncate text-[11.5px] text-noct-neutral-500">
                        {detalle || extremo.conexion.notas}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void quitar(extremo.conexion)}
                    aria-label={`Quitar la conexión con ${nombre}`}
                    className="flex min-h-11 w-[38px] shrink-0 items-center justify-center rounded-md text-noct-neutral-600 hover:bg-noct-error/[.08] hover:text-noct-error"
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

function FormularioConexion({ equipo, onCerrar }: { equipo: Dispositivo; onCerrar: () => void }) {
  const todos = useLiveQuery(
    () => db.dispositivos.filter((d) => !d.eliminadoEn && d.id !== equipo.id).toArray(),
    [equipo.id],
    [],
  )

  const [modo, setModo] = useState<ModoConexion>('enlace')
  const [busqueda, setBusqueda] = useState('')
  const [otro, setOtro] = useState<Dispositivo | null>(null)
  const [puertoLocal, setPuertoLocal] = useState('')
  const [puertoRemoto, setPuertoRemoto] = useState('')
  const [medio, setMedio] = useState('UTP')
  const [guardando, setGuardando] = useState(false)

  const coincidencias = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return []
    return (todos ?? [])
      .filter((d) => [d.nombre, d.ubicacion, d.ip].join(' ').toLowerCase().includes(texto))
      .slice(0, 8)
  }, [todos, busqueda])

  const tipoActual = TIPOS_CONEXION.find((t) => t.valor === modo)
  const esEnlace = modo === 'enlace'

  async function guardar() {
    if (!otro || guardando) return
    setGuardando(true)

    const tipo: TipoConexion = modo === 'enlace' ? 'enlace' : modo === 'relacionado' ? 'relacionado' : 'instalacion'
    const conPuertos = modo === 'enlace'
    // En 'contiene', el equipo elegido se instala en ESTE (este es el
    // rack); en el resto, este es el origen.
    const origenEsteEquipo = modo !== 'contiene'
    const origen = origenEsteEquipo ? equipo : otro
    const destino = origenEsteEquipo ? otro : equipo

    await guardarRegistro('conexiones', {
      id: nuevoId(),
      tipo,
      origenId: origen.id,
      origenNombre: origen.nombre,
      origenPuerto: conPuertos ? puertoLocal.trim() : '',
      destinoId: destino.id,
      destinoNombre: destino.nombre,
      destinoPuerto: conPuertos ? puertoRemoto.trim() : '',
      medio: conPuertos ? medio.trim() : '',
      notas: '',
    })

    onCerrar()
  }

  const claseChip = (activo: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium ${
      activo
        ? 'border-noct-accent bg-noct-accent/[.12] text-noct-accent-300'
        : 'border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.05]'
    }`

  const claseCampo =
    'w-full box-border min-h-11 rounded-md border border-noct-divider bg-noct-bg px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3">
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

      {otro ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-noct-accent/30 bg-noct-accent/[.08] px-3 py-2.5">
          <span className="inline-flex min-w-0 items-center gap-2 text-[13.5px] text-noct-text">
            <Monitor size={15} className="shrink-0 text-noct-accent-300" aria-hidden />
            <span className="truncate">{otro.nombre}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setOtro(null)
              setBusqueda('')
            }}
            className="shrink-0 p-1.5 text-[12px] text-noct-neutral-500 hover:text-noct-text"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar el otro equipo por nombre, ubicación o IP"
            className={`${claseCampo} [&::-webkit-search-cancel-button]:hidden`}
          />
          {coincidencias.length > 0 && (
            <div className="flex flex-col gap-1">
              {coincidencias.map((d) => (
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
              ))}
            </div>
          )}
        </div>
      )}

      {esEnlace && (
        <>
          <div className="flex gap-2.5">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12px] text-noct-neutral-500">Puerto aquí</span>
              <input
                type="text"
                value={puertoLocal}
                onChange={(e) => setPuertoLocal(e.target.value)}
                placeholder="3"
                className={`${claseCampo} font-mono`}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12px] text-noct-neutral-500">Puerto en el otro</span>
              <input
                type="text"
                value={puertoRemoto}
                onChange={(e) => setPuertoRemoto(e.target.value)}
                placeholder="Opcional"
                className={`${claseCampo} font-mono`}
              />
            </label>
          </div>
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
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={!otro || guardando}
          className={`${BTN_PRIMARIO} min-h-11 px-4 disabled:opacity-55`}
        >
          {guardando ? 'Guardando...' : 'Guardar conexión'}
        </button>
        <button type="button" onClick={onCerrar} className={`${BTN_GHOST} min-h-11 px-3`}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// Flecha de codo hacia arriba (ph-arrow-elbow-left-up del mockup):
// glifo local decorativo para la sección "Depende de", como los
// chevrons inline de TopologiaPage. No entra al set de iconos de
// dominio (regenerable) por ser exclusivo de esta pantalla.
function FlechaCodoArriba({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <path d="M14 20H9a3 3 0 0 1-3-3V8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3 11 3-4 3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
