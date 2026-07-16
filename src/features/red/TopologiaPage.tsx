import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { AppShell } from '../../app/AppShell'
import { construirArbol, construirBosque, infoDeDispositivos, type NodoTopologia } from './arbol'
import { detalleDeNodo, puntoDeEstado, tipoDeNodoVisual, type TipoNodoVisual } from './topologiaVisual'

// Vista de la topología rediseñada en tema claro (handoff de Claude
// Design, Topologia.dc.html): breadcrumb, leyenda de estados, botones
// Expandir todo / Contraer y árbol de filas con icono por tipo de
// equipo, línea de detalle y punto de estado. Sin la raíz en la URL
// muestra todo el bosque (racks y switches de núcleo); con
// :dispositivoId arranca desde ese equipo hacia abajo. Conserva el
// buscador con expansión automática y resaltado (fase R1, punto 8).

// Cómo arranca el árbol antes de tocar los botones: los dos primeros
// niveles abiertos (rack y switches a la vista, el resto se expande a
// mano). "Expandir todo" y "Contraer" cambian la base; los toggles
// individuales se guardan como inversiones sobre esa base, así los
// botones no pelean con lo que el técnico ya abrió o cerró.
type ModoExpansion = 'inicial' | 'todo' | 'nada'

export function TopologiaPage() {
  const { dispositivoId } = useParams()

  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  const raiz = dispositivoId ? (dispositivos ?? []).find((d) => d.id === dispositivoId) : undefined

  const arboles = useMemo(() => {
    const idsRed = new Set((categorias ?? []).filter((c) => c.esRed).map((c) => c.id))
    const infoPorId = infoDeDispositivos(dispositivos ?? [])
    if (dispositivoId) {
      return [construirArbol(dispositivoId, conexiones ?? [], infoPorId)]
    }
    return construirBosque(dispositivos ?? [], conexiones ?? [], (categoriaId) => idsRed.has(categoriaId))
  }, [dispositivoId, dispositivos, conexiones, categorias])

  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )
  const marcaModeloPorId = useMemo(
    () => new Map((dispositivos ?? []).map((d) => [d.id, `${d.marca} ${d.modelo}`.trim()])),
    [dispositivos],
  )

  const hayContenido = arboles.some((a) => a.hijos.length > 0)

  const [modoExpansion, setModoExpansion] = useState<ModoExpansion>('inicial')
  const [invertidos, setInvertidos] = useState<ReadonlySet<string>>(new Set())

  function alternar(clave: string) {
    setInvertidos((previos) => {
      const siguientes = new Set(previos)
      if (siguientes.has(clave)) siguientes.delete(clave)
      else siguientes.add(clave)
      return siguientes
    })
  }

  function expandirTodo() {
    setModoExpansion('todo')
    setInvertidos(new Set())
  }

  function contraerTodo() {
    setModoExpansion('nada')
    setInvertidos(new Set())
  }

  // Buscador de la topología (fase R1, punto 8): escribir el nombre
  // expande automáticamente las ramas necesarias, resalta los equipos
  // que coinciden y hace scroll al primero. Al vaciar el campo, el
  // árbol vuelve a su apertura normal.
  const [busqueda, setBusqueda] = useState('')
  const textoBuscado = busqueda.trim().toLowerCase()

  const { idsCoincidentes, idsAAbrir } = useMemo(() => {
    if (!textoBuscado) return { idsCoincidentes: new Set<string>(), idsAAbrir: new Set<string>() }
    const coincidentes = new Set<string>()
    const aAbrir = new Set<string>()
    function visitar(nodo: NodoTopologia, ancestros: string[]) {
      const coincide = nodo.nombre.toLowerCase().includes(textoBuscado)
      if (coincide) {
        coincidentes.add(nodo.dispositivoId)
        for (const id of ancestros) aAbrir.add(id)
      }
      for (const hijo of nodo.hijos) visitar(hijo, [...ancestros, nodo.dispositivoId])
    }
    for (const arbol of arboles) visitar(arbol, [])
    return { idsCoincidentes: coincidentes, idsAAbrir: aAbrir }
  }, [arboles, textoBuscado])

  // Referencias de los nodos ya renderizados, para hacer scroll al
  // primer resultado cuando la búsqueda cambia.
  const referencias = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (idsCoincidentes.size === 0) return
    const primero = referencias.current.get([...idsCoincidentes][0])
    primero?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [idsCoincidentes])

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[760px] flex-col gap-5">
        <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-zinc-500">
          <Link to="/red" className="hover:underline">
            Red
          </Link>
          <ChevronDerecha className="h-[13px] w-[13px] text-zinc-300" />
          {raiz ? (
            <>
              <Link to="/red/topologia" className="hover:underline">
                Topología
              </Link>
              <ChevronDerecha className="h-[13px] w-[13px] text-zinc-300" />
              <span className="font-medium text-zinc-900">{raiz.nombre}</span>
            </>
          ) : (
            <span className="font-medium text-zinc-900">Topología</span>
          )}
        </nav>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-semibold">
              {raiz ? `Topología desde ${raiz.nombre}` : 'Topología de red'}
            </h1>
            <p className="text-sm text-zinc-600">
              {raiz
                ? 'Sigue las conexiones desde este equipo hasta cada dependiente'
                : 'Sigue las conexiones desde el enlace principal hasta cada equipo'}
            </p>
          </div>
          {hayContenido && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={expandirTodo}
                className="rounded-md border border-zinc-300 bg-white px-[13px] py-2 text-[12.5px] font-semibold text-zinc-900 hover:bg-zinc-100 cursor-pointer"
              >
                Expandir todo
              </button>
              <button
                type="button"
                onClick={contraerTodo}
                className="rounded-md border border-zinc-300 bg-white px-[13px] py-2 text-[12.5px] font-semibold text-zinc-900 hover:bg-zinc-100 cursor-pointer"
              >
                Contraer
              </button>
            </div>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-4">
          <LeyendaEstado clase="bg-green-600" etiqueta="Operativo" />
          <LeyendaEstado clase="bg-amber-600" etiqueta="Mantenimiento" />
          <LeyendaEstado clase="bg-red-600" etiqueta="Fuera de servicio" />
        </div>

        {hayContenido && (
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un equipo en el mapa..."
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        )}

        {textoBuscado && idsCoincidentes.size === 0 && (
          <p className="text-xs text-zinc-500">Ningún equipo coincide con "{busqueda.trim()}".</p>
        )}

        {!hayContenido && arboles.length <= 1 && (arboles[0]?.hijos.length ?? 0) === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
            Aún no hay conexiones registradas. Agrégalas desde la ficha de cada equipo, en la sección
            Conexiones.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white p-2">
            <ul className="flex min-w-[480px] flex-col">
              {arboles.map((arbol) => (
                <NodoFila
                  key={arbol.dispositivoId}
                  nodo={arbol}
                  nivel={0}
                  clave={arbol.dispositivoId}
                  modoExpansion={modoExpansion}
                  invertidos={invertidos}
                  alternar={alternar}
                  idsAAbrir={idsAAbrir}
                  idsResaltados={idsCoincidentes}
                  nombreCategoria={nombreCategoria}
                  marcaModeloPorId={marcaModeloPorId}
                  registrarRef={(id, el) => {
                    if (el) referencias.current.set(id, el)
                    else referencias.current.delete(id)
                  }}
                />
              ))}
            </ul>
          </div>
        )}

        <p className="text-[12.5px] text-zinc-400">
          Haz clic en un equipo para abrir su ficha. Las flechas expanden lo que depende de él.
        </p>
      </div>
    </AppShell>
  )
}

function NodoFila({
  nodo,
  nivel,
  clave,
  modoExpansion,
  invertidos,
  alternar,
  idsAAbrir,
  idsResaltados,
  nombreCategoria,
  marcaModeloPorId,
  registrarRef,
}: {
  nodo: NodoTopologia
  nivel: number
  // Clave de camino, única por instancia del nodo en el árbol (el
  // mismo dispositivo puede aparecer en dos ramas): identifica el
  // toggle de ESTA fila en el conjunto de inversiones.
  clave: string
  modoExpansion: ModoExpansion
  invertidos: ReadonlySet<string>
  alternar: (clave: string) => void
  // Ids que la búsqueda obliga a expandir (son ancestros de un
  // resultado) o a resaltar (son el resultado en sí).
  idsAAbrir: Set<string>
  idsResaltados: Set<string>
  nombreCategoria: Map<string, string>
  marcaModeloPorId: Map<string, string>
  registrarRef: (dispositivoId: string, el: HTMLElement | null) => void
}) {
  const tieneHijos = nodo.hijos.length > 0
  const abiertoBase = modoExpansion === 'todo' ? true : modoExpansion === 'nada' ? false : nivel < 2
  const abierto = (abiertoBase !== invertidos.has(clave) || idsAAbrir.has(nodo.dispositivoId)) && tieneHijos
  const resaltado = idsResaltados.has(nodo.dispositivoId)

  const categoria = nombreCategoria.get(nodo.categoriaId) ?? ''
  const punto = puntoDeEstado(nodo.estado)
  const detalle = detalleDeNodo({
    categoria,
    marcaModelo: marcaModeloPorId.get(nodo.dispositivoId) ?? '',
    via: nodo.via,
    medio: nodo.medio,
  })

  return (
    <li>
      <div
        className={`flex items-center gap-2 rounded-md px-2 py-[7px] ${
          resaltado ? 'bg-blue-50' : 'hover:bg-zinc-100'
        }`}
        style={{ marginLeft: `${nivel * 24}px` }}
      >
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => alternar(clave)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Contraer' : 'Expandir'}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center text-zinc-500"
          >
            {abierto ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ) : (
          <span aria-hidden className="flex w-6 shrink-0 justify-center">
            <span className="h-[5px] w-[5px] rounded-full bg-zinc-300" />
          </span>
        )}

        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
          <IconoNodo tipo={tipoDeNodoVisual(categoria)} />
        </span>

        <Link
          ref={(el) => registrarRef(nodo.dispositivoId, el)}
          to={`/dispositivos/${nodo.dispositivoId}`}
          className="flex min-w-0 flex-1 items-baseline gap-2"
        >
          <span className="whitespace-nowrap text-[13.5px] font-semibold text-zinc-900">{nodo.nombre}</span>
          {detalle && (
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-400">
              {detalle}
            </span>
          )}
          {nodo.truncado && (
            <span className="shrink-0 text-xs text-amber-600" title="Ya aparece más arriba">
              ↺
            </span>
          )}
        </Link>

        <span title={punto.titulo} className={`h-[7px] w-[7px] shrink-0 rounded-full ${punto.clase}`} />
        <ChevronDerecha className="h-[15px] w-[15px] shrink-0 text-zinc-300" />
      </div>

      {tieneHijos && abierto && (
        <ul className="flex flex-col">
          {nodo.hijos.map((hijo) => (
            <NodoFila
              key={`${hijo.dispositivoId}-${hijo.via}`}
              nodo={hijo}
              nivel={nivel + 1}
              clave={`${clave}/${hijo.dispositivoId}·${hijo.via}`}
              modoExpansion={modoExpansion}
              invertidos={invertidos}
              alternar={alternar}
              idsAAbrir={idsAAbrir}
              idsResaltados={idsResaltados}
              nombreCategoria={nombreCategoria}
              marcaModeloPorId={marcaModeloPorId}
              registrarRef={registrarRef}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function LeyendaEstado({ clase, etiqueta }: { clase: string; etiqueta: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-[7px] w-[7px] rounded-full ${clase}`} />
      <span className="text-[12.5px] text-zinc-600">{etiqueta}</span>
    </div>
  )
}

function ChevronDerecha(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Icono del tipo de equipo en la fila (trazo 1.8 estilo Lucide, como
// el resto de la app). Los siete primeros vienen del diseño; rack,
// cámara, servidor y genérico se agregan porque las categorías reales
// los necesitan.
function IconoNodo({ tipo }: { tipo: TipoNodoVisual }) {
  const comunes = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    className: 'h-4 w-4',
  } as const

  switch (tipo) {
    case 'router':
      return (
        <svg {...comunes}>
          <rect x="3" y="12" width="18" height="8" rx="1.5" />
          <path d="M7 16h.1M10 16h.1" strokeLinecap="round" />
          <path d="M17 12V7" strokeLinecap="round" />
          <circle cx="17" cy="5.5" r="1.2" />
        </svg>
      )
    case 'switch':
      return (
        <svg {...comunes}>
          <rect x="3" y="8" width="18" height="8" rx="1.5" />
          <path d="M6.5 12h.1M9.5 12h.1M12.5 12h.1M15.5 12h.1" strokeLinecap="round" />
        </svg>
      )
    case 'ap':
      return (
        <svg {...comunes}>
          <path d="M5 12.5a10 10 0 0 1 14 0" strokeLinecap="round" />
          <path d="M8 15.5a6 6 0 0 1 8 0" strokeLinecap="round" />
          <circle cx="12" cy="18.5" r="1.2" />
        </svg>
      )
    case 'punto':
      return (
        <svg {...comunes}>
          <rect x="5" y="5" width="14" height="14" rx="1.5" />
          <rect x="9.5" y="9" width="5" height="6" />
        </svg>
      )
    case 'pc':
      return (
        <svg {...comunes}>
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M8 20h8M12 16v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'impresora':
      return (
        <svg {...comunes}>
          <path d="M6 9V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="4" y="9" width="16" height="7" rx="1.5" />
          <path d="M7 16v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'pos':
      return (
        <svg {...comunes}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" strokeLinecap="round" />
          <path d="M7 15h4" strokeLinecap="round" />
        </svg>
      )
    case 'rack':
      return (
        <svg {...comunes}>
          <rect x="5" y="3" width="14" height="18" rx="1.5" />
          <path d="M5 9h14M5 15h14" />
          <path d="M8 6h.1M8 12h.1M8 18h.1" strokeLinecap="round" />
        </svg>
      )
    case 'camara':
      return (
        <svg {...comunes}>
          <rect x="3" y="7" width="12" height="10" rx="2" />
          <path d="m15 10.5 6-3v9l-6-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'servidor':
      return (
        <svg {...comunes}>
          <rect x="3" y="4" width="18" height="7" rx="1.5" />
          <rect x="3" y="13" width="18" height="7" rx="1.5" />
          <path d="M7 7.5h.1M7 16.5h.1" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg {...comunes}>
          <rect x="3" y="10" width="18" height="9" rx="1.5" />
          <path d="M7 14.5h.1M10 14.5h.1" strokeLinecap="round" />
        </svg>
      )
  }
}
