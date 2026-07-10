import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { BotonVolver } from '../../components/BotonVolver'
import { infoDeEstado } from '../dispositivos/estados'
import { construirArbol, construirBosque, infoDeDispositivos, type NodoTopologia } from './arbol'
import { iconoDeVia } from './medios'

// Vista visual de la topologia: un arbol de nodos expandibles. Sin la
// raiz en la URL muestra todo el bosque (racks y switches de nucleo);
// con :dispositivoId arranca desde ese equipo hacia abajo.
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

  const volverA = dispositivoId ? `/dispositivos/${dispositivoId}` : '/red'
  const hayContenido = arboles.some((a) => a.hijos.length > 0)

  // Buscador de la topologia (fase R1, punto 8): en vez de recorrer el
  // arbol manualmente, escribir el nombre expande automaticamente las
  // ramas necesarias, resalta los equipos que coinciden y hace scroll
  // al primero. Al vaciar el campo, el arbol vuelve a su apertura
  // normal (los dos primeros niveles).
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
  // primer resultado cuando la busqueda cambia.
  const referencias = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (idsCoincidentes.size === 0) return
    const primero = referencias.current.get([...idsCoincidentes][0])
    primero?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [idsCoincidentes])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to={volverA}>{dispositivoId ? 'Volver a la ficha' : 'Red'}</BotonVolver>
        <h1 className="text-xl font-semibold">
          {raiz ? `Topología desde ${raiz.nombre}` : 'Topología de la red'}
        </h1>
        <p className="text-sm text-slate-400">
          Toca un equipo para abrir su ficha, o el triángulo para ver de qué depende.
        </p>
      </header>

      {hayContenido && (
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar un equipo en el mapa..."
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      )}

      {textoBuscado && idsCoincidentes.size === 0 && (
        <p className="text-xs text-slate-500">Ningún equipo coincide con "{busqueda.trim()}".</p>
      )}

      {!hayContenido && arboles.length <= 1 && (arboles[0]?.hijos.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Aún no hay conexiones registradas. Agrégalas desde la ficha de cada equipo, en la sección
          Conexiones.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {arboles.map((arbol) => (
            <NodoArbol
              key={arbol.dispositivoId}
              nodo={arbol}
              nivel={0}
              idsAAbrir={idsAAbrir}
              idsResaltados={idsCoincidentes}
              registrarRef={(id, el) => {
                if (el) referencias.current.set(id, el)
                else referencias.current.delete(id)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function NodoArbol({
  nodo,
  nivel,
  idsAAbrir,
  idsResaltados,
  registrarRef,
}: {
  nodo: NodoTopologia
  nivel: number
  // Ids que la búsqueda obliga a expandir (son ancestros de un
  // resultado) o a resaltar (son el resultado en sí).
  idsAAbrir: Set<string>
  idsResaltados: Set<string>
  registrarRef: (dispositivoId: string, el: HTMLElement | null) => void
}) {
  // Los dos primeros niveles arrancan abiertos: se ve el rack y sus
  // switches sin tocar nada; de ahi hacia abajo el usuario expande.
  const [abiertoManual, setAbiertoManual] = useState(nivel < 2)
  const forzadoPorBusqueda = idsAAbrir.has(nodo.dispositivoId)
  const abierto = abiertoManual || forzadoPorBusqueda
  const tieneHijos = nodo.hijos.length > 0
  const resaltado = idsResaltados.has(nodo.dispositivoId)
  const infoEstado = nodo.estado ? infoDeEstado(nodo.estado) : null

  return (
    <li>
      <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: `${nivel * 16}px` }}>
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => setAbiertoManual((v) => !v)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Contraer' : 'Expandir'}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-200"
          >
            <span className={`transition-transform ${abierto ? 'rotate-90' : ''}`}>▸</span>
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden />
        )}

        <Link
          ref={(el) => registrarRef(nodo.dispositivoId, el)}
          to={`/dispositivos/${nodo.dispositivoId}`}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 ${
            resaltado ? 'border-sky-600 bg-sky-950/40 ring-1 ring-sky-600' : 'border-slate-800 bg-slate-900'
          }`}
        >
          {infoEstado && (
            <span aria-hidden className="shrink-0" title={nodo.estado}>
              {infoEstado.icono}
            </span>
          )}
          <span className="min-w-0 truncate text-sm text-slate-100">{nodo.nombre}</span>
          {nodo.truncado && (
            <span className="shrink-0 text-xs text-amber-400/80" title="Ya aparece más arriba">
              ↺
            </span>
          )}
          {nodo.via && (
            <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
              {nodo.tipoConexion && <span aria-hidden>{iconoDeVia(nodo.tipoConexion, nodo.medio)}</span>}
              {nodo.via}
            </span>
          )}
        </Link>
      </div>

      {tieneHijos && abierto && (
        <ul className="flex flex-col gap-1">
          {nodo.hijos.map((hijo) => (
            <NodoArbol
              key={`${hijo.dispositivoId}-${hijo.via}`}
              nodo={hijo}
              nivel={nivel + 1}
              idsAAbrir={idsAAbrir}
              idsResaltados={idsResaltados}
              registrarRef={registrarRef}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
