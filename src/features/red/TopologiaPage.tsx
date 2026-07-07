import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { BotonVolver } from '../../components/BotonVolver'
import { construirArbol, construirBosque, type NodoTopologia } from './arbol'

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
    if (dispositivoId) {
      const nombres = new Map((dispositivos ?? []).map((d) => [d.id, d.nombre]))
      return [construirArbol(dispositivoId, conexiones ?? [], nombres)]
    }
    return construirBosque(dispositivos ?? [], conexiones ?? [], (categoriaId) => idsRed.has(categoriaId))
  }, [dispositivoId, dispositivos, conexiones, categorias])

  const volverA = dispositivoId ? `/dispositivos/${dispositivoId}` : '/red'
  const hayContenido = arboles.some((a) => a.hijos.length > 0)

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

      {!hayContenido && arboles.length <= 1 && (arboles[0]?.hijos.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Aún no hay conexiones registradas. Agrégalas desde la ficha de cada equipo, en la sección
          Conexiones.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {arboles.map((arbol) => (
            <NodoArbol key={arbol.dispositivoId} nodo={arbol} nivel={0} />
          ))}
        </ul>
      )}
    </div>
  )
}

function NodoArbol({ nodo, nivel }: { nodo: NodoTopologia; nivel: number }) {
  // Los dos primeros niveles arrancan abiertos: se ve el rack y sus
  // switches sin tocar nada; de ahi hacia abajo el usuario expande.
  const [abierto, setAbierto] = useState(nivel < 2)
  const tieneHijos = nodo.hijos.length > 0

  return (
    <li>
      <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: `${nivel * 16}px` }}>
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
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
          to={`/dispositivos/${nodo.dispositivoId}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
        >
          <span className="min-w-0 truncate text-sm text-slate-100">{nodo.nombre}</span>
          {nodo.truncado && (
            <span className="shrink-0 text-xs text-amber-400/80" title="Ya aparece más arriba">
              ↺
            </span>
          )}
          {nodo.via && (
            <span className="ml-auto shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
              {nodo.via}
            </span>
          )}
        </Link>
      </div>

      {tieneHijos && abierto && (
        <ul className="flex flex-col gap-1">
          {nodo.hijos.map((hijo) => (
            <NodoArbol key={`${hijo.dispositivoId}-${hijo.via}`} nodo={hijo} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
