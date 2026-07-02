import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { Adjuntos } from '../../components/Adjuntos'

export function DispositivoPage() {
  const { dispositivoId = '' } = useParams()
  const navigate = useNavigate()

  const dispositivo = useLiveQuery(() => db.dispositivos.get(dispositivoId), [dispositivoId])
  const categoria = useLiveQuery(
    () => (dispositivo ? db.categorias.get(dispositivo.categoriaId) : undefined),
    [dispositivo],
  )

  if (dispositivo === null) return <Navigate to="/dispositivos" replace />
  if (!dispositivo) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>

  async function eliminar() {
    if (!window.confirm(`¿Eliminar "${dispositivo!.nombre}"?`)) return
    await eliminarRegistro('dispositivos', dispositivoId)
    navigate('/dispositivos')
  }

  const campos: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Marca', valor: dispositivo.marca },
    { etiqueta: 'Modelo', valor: dispositivo.modelo },
    { etiqueta: 'Número de serie', valor: dispositivo.serial },
    { etiqueta: 'Placa de inventario', valor: dispositivo.placaInventario },
    { etiqueta: 'Ubicación', valor: dispositivo.ubicacion },
    { etiqueta: 'Dirección IP', valor: dispositivo.ip },
  ].filter((c) => c.valor)

  const detalles = Object.entries(dispositivo.detalles).filter(([, valor]) => valor)

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <Link to="/dispositivos" className="text-xs text-slate-400">
            ← Dispositivos
          </Link>
          <h1 className="text-xl font-semibold">{dispositivo.nombre}</h1>
          {categoria && <p className="text-xs text-slate-500">{categoria.nombre}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to={`/dispositivos/${dispositivoId}/editar`}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={() => void eliminar()}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
          >
            Eliminar
          </button>
        </div>
      </header>

      {dispositivo.estado && (
        <span className="w-fit rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
          {dispositivo.estado}
        </span>
      )}

      {(campos.length > 0 || detalles.length > 0) && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
          {campos.map((campo) => (
            <div key={campo.etiqueta}>
              <dt className="text-xs text-slate-500">{campo.etiqueta}</dt>
              <dd className="text-sm text-slate-100">{campo.valor}</dd>
            </div>
          ))}
          {detalles.map(([clave, valor]) => (
            <div key={clave}>
              <dt className="text-xs text-slate-500">{clave}</dt>
              <dd className="text-sm text-slate-100">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {dispositivo.observaciones && (
        <div>
          <h2 className="mb-1 text-sm font-medium text-slate-400">Observaciones</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{dispositivo.observaciones}</p>
        </div>
      )}

      {categoria && (
        <Link
          to={`/soluciones/${categoria.id}`}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-sky-400"
        >
          Ver procedimientos de {categoria.nombre} →
        </Link>
      )}

      <Adjuntos entidadTipo="dispositivo" entidadId={dispositivoId} />
    </div>
  )
}
