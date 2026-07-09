import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { registrarVisita } from '../../lib/recientes'
import { Adjuntos } from '../../components/Adjuntos'
import { BotonCompartir } from '../../components/BotonCompartir'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { ValorCopiable } from '../../components/ValorCopiable'
import { ConexionesFicha } from '../red/ConexionesFicha'
import { Historial } from '../historial/Historial'
import { IndicadorEstado } from './IndicadorEstado'
import { RegistrarIntervencion } from './RegistrarIntervencion'

export function DispositivoPage() {
  const { dispositivoId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  const dispositivo = useLiveQuery(() => db.dispositivos.get(dispositivoId), [dispositivoId])
  const categoria = useLiveQuery(
    () => (dispositivo ? db.categorias.get(dispositivo.categoriaId) : undefined),
    [dispositivo],
  )

  const idVisitado = dispositivo && !dispositivo.eliminadoEn ? dispositivo.id : null
  useEffect(() => {
    if (idVisitado) void registrarVisita('dispositivo', idVisitado)
  }, [idVisitado])

  if (dispositivo === null) return <Navigate to="/dispositivos" replace />
  if (!dispositivo) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>

  // Los dispositivos de red se listan en la seccion Red: la navegacion
  // de vuelta y la eliminacion regresan alli.
  const esRed = Boolean(categoria?.esRed)
  const volverA = esRed ? '/red' : '/dispositivos'

  async function eliminar() {
    await eliminarRegistro('dispositivos', dispositivoId)
    navigate(volverA)
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
      <header className="flex flex-col gap-2">
        <BotonVolver to={volverA}>{esRed ? 'Red' : 'Dispositivos'}</BotonVolver>
        <div>
          <h1 className="text-xl font-semibold">{dispositivo.nombre}</h1>
          {categoria && <p className="text-xs text-slate-500">{categoria.nombre}</p>}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <BotonCompartir titulo={dispositivo.nombre} />
        <Link
          to={`/dispositivos/nuevo?copiarDe=${dispositivoId}`}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          Duplicar
        </Link>
        <Link
          to={`/dispositivos/${dispositivoId}/editar`}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
        >
          Editar
        </Link>
        <button
          type="button"
          onClick={() => setMostrarEliminar(true)}
          className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
        >
          Eliminar
        </button>
      </div>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={`¿Eliminar el dispositivo "${dispositivo.nombre}"?`}
        descripcion="Esta acción eliminará la ficha del dispositivo, sus campos y sus conexiones registradas."
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />

      <IndicadorEstado estado={dispositivo.estado} />

      {(campos.length > 0 || detalles.length > 0) && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-4">
          {campos.map((campo) => (
            <div key={campo.etiqueta}>
              <dt className="text-xs text-slate-500">{campo.etiqueta}</dt>
              <dd>
                <ValorCopiable valor={campo.valor} esIp={campo.etiqueta === 'Dirección IP'} />
              </dd>
            </div>
          ))}
          {detalles.map(([clave, valor]) => (
            <div key={clave}>
              <dt className="text-xs text-slate-500">{clave}</dt>
              <dd>
                <ValorCopiable valor={valor} />
              </dd>
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

      <ConexionesFicha dispositivo={dispositivo} />

      <Adjuntos entidadTipo="dispositivo" entidadId={dispositivoId} />

      <RegistrarIntervencion dispositivoId={dispositivoId} />

      <Historial entidadTipo="dispositivo" entidadId={dispositivoId} />
    </div>
  )
}
