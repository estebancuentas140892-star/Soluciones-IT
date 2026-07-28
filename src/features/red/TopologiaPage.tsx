import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { Chasis } from '../../app/Chasis'
import { idsDeRed } from '../../lib/categorias'
import { CaretDown, CaretRight, MagnifyingGlass, TreeStructure, XCircleFill } from '../../components/iconos'
import { BTN_GHOST } from '../../components/nocturne'
import { construirBosque, contarDescendientes, type NodoTopologia } from './arbol'
import { IconoNodo } from './IconoNodo'
import { claseEstado, detalleDeNodo, estadoConEtiqueta, tipoDeNodoVisual } from './topologiaVisual'

// Mapa general de la topología re-autorizado en el sistema Nocturne
// (handoff "Rediseño de aplicación empresarial", Topología.dc.html,
// tarea 92): el bosque completo de la red (racks y switches de núcleo
// como raíces) en un árbol expandible. Conserva intacta la lógica de
// la versión anterior en tema claro (construirBosque, expansión por
// inversiones sobre una base, buscador con auto-expansión, resaltado y
// scroll al primer resultado) y suma el enlace de impacto "+N" por
// fila, que abre la topología centrada en ese equipo
// (TopologiaEquipoPage). La vista por-equipo ya no vive aquí: la ruta
// /red/topologia/:dispositivoId tiene su propia pantalla.

// Cómo arranca el árbol antes de tocar los botones: los dos primeros
// niveles abiertos (rack y switches a la vista, el resto se expande a
// mano). "Expandir todo" y "Contraer" cambian la base; los toggles
// individuales se guardan como inversiones sobre esa base, así los
// botones no pelean con lo que el técnico ya abrió o cerró.
type ModoExpansion = 'inicial' | 'todo' | 'nada'

export function TopologiaPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  const arboles = useMemo(() => {
    const idsRed = idsDeRed(categorias)
    return construirBosque(dispositivos ?? [], conexiones ?? [], (categoriaId) => idsRed.has(categoriaId))
  }, [dispositivos, conexiones, categorias])

  const marcaModeloPorId = useMemo(
    () => new Map((dispositivos ?? []).map((d) => [d.id, `${d.marca} ${d.modelo}`.trim()])),
    [dispositivos],
  )
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
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
  const buscando = textoBuscado.length > 0

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
    // Nivel 2 del chasis (tarea 185): documento. El chasis pone el
    // bloque pegajoso, el retorno a Red y las pestañas; aquí quedan los
    // botones de expansión, el título, el buscador y la leyenda.
    <Chasis
      modo="documento"
      acciones={
        hayContenido && (
          <>
            <button type="button" onClick={expandirTodo} className={`whitespace-nowrap ${BTN_GHOST}`}>
              Expandir todo
            </button>
            <button type="button" onClick={contraerTodo} className={`whitespace-nowrap ${BTN_GHOST}`}>
              Contraer
            </button>
          </>
        )
      }
      barra={
      <>
        <div className="px-4 pb-2 pt-0.5">
          <h1 className="text-[22px] font-medium leading-tight">Topología de red</h1>
          <p className="mt-0.5 text-[12.5px] text-noct-neutral-500">
            Al expandir un equipo se ve todo lo que depende de él
          </p>
        </div>
        {hayContenido && (
          <div className="px-4 pb-2.5">
            <label
              className={`flex h-[42px] items-center gap-2.5 rounded-lg border bg-noct-surface px-3.5 transition-colors ${
                buscando ? 'border-noct-accent' : 'border-noct-divider'
              }`}
            >
              <MagnifyingGlass
                size={17}
                className={`shrink-0 ${buscando ? 'text-noct-accent' : 'text-noct-neutral-500'}`}
                aria-hidden
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar un equipo en el mapa"
                aria-label="Buscar un equipo en el mapa"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] text-noct-text outline-none placeholder:text-noct-neutral-500 [&::-webkit-search-cancel-button]:hidden"
              />
              {buscando && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  aria-label="Borrar búsqueda"
                  className="-m-1 flex shrink-0 p-1 text-noct-neutral-400 hover:text-noct-text"
                >
                  <XCircleFill size={17} aria-hidden />
                </button>
              )}
            </label>
          </div>
        )}
        <div className="flex items-center gap-3.5 px-4 pb-2.5">
          <LeyendaEstado clase="text-noct-exito" etiqueta="Operativo" />
          <LeyendaEstado clase="text-noct-precaucion" etiqueta="Mantenimiento" />
          <LeyendaEstado clase="text-noct-error" etiqueta="Fuera de servicio" />
        </div>
      </>
      }
    >
      <main className="flex flex-1 flex-col gap-3 px-4 pb-16 pt-3">
        {buscando && idsCoincidentes.size === 0 && (
          <p className="px-0.5 text-[12.5px] text-noct-neutral-500">
            Ningún equipo coincide con "{busqueda.trim()}".
          </p>
        )}

        {!hayContenido ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-noct-neutral-700 px-6 py-11 text-center">
            <TreeStructure size={30} className="text-noct-neutral-600" aria-hidden />
            <div>
              <p className="text-[14.5px] font-medium">Aún no hay conexiones registradas</p>
              <p className="mt-1 text-[13px] leading-relaxed text-noct-neutral-400">
                Agregarlas desde la ficha de cada equipo, en la sección Conexiones.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
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
          </div>
        )}

        <p className="px-0.5 text-[12px] leading-relaxed text-noct-neutral-600">
          Tocar un equipo abre su ficha. El número junto al estado indica cuántos equipos quedarían sin
          servicio si falla.
        </p>
      </main>
    </Chasis>
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
  const estado = estadoConEtiqueta(nodo.estado)
  // Detalle de la fila como en el mockup: cómo conecta con su padre
  // (via · medio); una raíz no tiene via y muestra su marca y modelo.
  const detalle = nodo.via
    ? detalleDeNodo({ via: nodo.via, medio: nodo.medio })
    : (marcaModeloPorId.get(nodo.dispositivoId) ?? '')
  // Enlace de impacto "+N" hacia la topología de este equipo: solo
  // cuando hay algo que ver ahí (2 o más dependientes, como el mockup).
  const impacto = tieneHijos ? contarDescendientes(nodo) : 0

  return (
    <>
      <div
        className={`flex min-h-[50px] items-center gap-2 rounded-md py-1.5 pr-1 ${
          resaltado ? 'bg-noct-accent/[.12]' : ''
        }`}
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

        <Link
          ref={(el) => registrarRef(nodo.dispositivoId, el)}
          to={`/dispositivos/${nodo.dispositivoId}`}
          className="min-w-0 flex-1 text-noct-text"
        >
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

        {impacto >= 2 && (
          <Link
            to={`/red/topologia/${nodo.dispositivoId}`}
            title="Ver la topología desde este equipo"
            className="inline-flex min-h-11 shrink-0 items-center px-1.5 text-[11px] text-noct-neutral-500 hover:text-noct-accent-300"
          >
            +{impacto}
          </Link>
        )}

        <span
          title={estado.etiqueta}
          className={`h-[7px] w-[7px] shrink-0 rounded-full bg-current ${claseEstado(estado.etiqueta)}`}
        />
      </div>

      {tieneHijos &&
        abierto &&
        nodo.hijos.map((hijo) => (
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
    </>
  )
}

function LeyendaEstado({ clase, etiqueta }: { clase: string; etiqueta: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-noct-neutral-400">
      <span className={`h-[7px] w-[7px] rounded-full bg-current ${clase}`} />
      {etiqueta}
    </span>
  )
}
