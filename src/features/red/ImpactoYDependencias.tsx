import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { db, type Dispositivo } from '../../lib/db'
import { caminoAscendente, construirArbol, contarImpacto, infoDeDispositivos, type PasoAscendente } from './arbol'
import { iconoDeVia } from './medios'

// Impacto de una falla y cadena de dependencia de un equipo (fase R1,
// puntos 9 y 10 de PROPUESTA_MODULOS.md), en la ficha del dispositivo.
// Solo se muestra si el equipo participa de alguna conexion; el resto
// del tiempo no aporta nada y no ocupa espacio. Se apoya en el mismo
// arbol de topologia que la vista de mapa (src/features/red/arbol.ts):
// nunca duplica la logica de "que depende de que".
export function ImpactoYDependencias({ dispositivo }: { dispositivo: Dispositivo }) {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const conexiones = useLiveQuery(() => db.conexiones.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], [])

  const infoPorId = useMemo(() => infoDeDispositivos(dispositivos ?? []), [dispositivos])
  const nombreCategoria = useMemo(
    () => new Map((categorias ?? []).map((c) => [c.id, c.nombre])),
    [categorias],
  )

  const impacto = useMemo(() => {
    if (!conexiones) return new Map<string, number>()
    const arbol = construirArbol(dispositivo.id, conexiones, infoPorId)
    return contarImpacto(arbol)
  }, [dispositivo.id, conexiones, infoPorId])

  const camino = useMemo(
    () => (conexiones ? caminoAscendente(dispositivo.id, conexiones, infoPorId) : []),
    [dispositivo.id, conexiones, infoPorId],
  )

  if (impacto.size === 0 && camino.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {impacto.size > 0 && <ImpactoFalla impacto={impacto} nombreCategoria={nombreCategoria} />}
      {camino.length > 0 && <DependeDe camino={camino} />}
    </div>
  )
}

function ImpactoFalla({
  impacto,
  nombreCategoria,
}: {
  impacto: Map<string, number>
  nombreCategoria: Map<string, string>
}) {
  const filas = [...impacto.entries()]
    .map(([categoriaId, cantidad]) => ({ nombre: nombreCategoria.get(categoriaId) ?? categoriaId, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return (
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3">
      <h2 className="text-sm font-medium text-amber-200">⚠ Impacto si este equipo falla</h2>
      <p className="mt-0.5 text-xs text-amber-400/80">También quedarían sin servicio:</p>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {filas.map((fila) => (
          <li key={fila.nombre} className="text-sm text-amber-100">
            • {fila.cantidad} {fila.nombre}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DependeDe({
  camino,
}: {
  camino: PasoAscendente[]
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <h2 className="text-sm font-medium text-slate-400">Depende de</h2>
      <ul className="mt-1.5 flex flex-col gap-1">
        {camino.map((paso) => (
          <li key={paso.dispositivoId}>
            <Link
              to={`/dispositivos/${paso.dispositivoId}`}
              className="flex items-center gap-2 text-sm text-sky-400"
            >
              <span aria-hidden>{iconoDeVia(paso.tipoConexion, paso.medio)}</span>
              <span className="text-slate-500">{paso.via}</span>
              <span>→</span>
              <span className="truncate underline decoration-dotted underline-offset-2">{paso.nombre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
