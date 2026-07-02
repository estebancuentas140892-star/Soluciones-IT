import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type HistorialEntrada, type TipoEntidadHistorial } from '../../lib/db'
import { descripcionEntrada } from './textoHistorial'

interface Props {
  entidadTipo: TipoEntidadHistorial
  entidadId: string
}

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

export function Historial({ entidadTipo, entidadId }: Props) {
  const [abierto, setAbierto] = useState(false)

  const entradas = useLiveQuery(
    () =>
      db.historial
        .where('[entidadTipo+entidadId]')
        .equals([entidadTipo, entidadId])
        .sortBy('fechaHora')
        .then((lista) => lista.reverse()),
    [entidadTipo, entidadId],
    [],
  )

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center justify-between text-sm font-medium text-slate-400"
      >
        <span>Historial{entradas.length > 0 ? ` (${entradas.length})` : ''}</span>
        <span className="text-xs text-slate-500">{abierto ? 'Ocultar' : 'Ver historial'}</span>
      </button>

      {abierto &&
        (entradas.length === 0 ? (
          <p className="text-xs text-slate-500">Sin cambios registrados</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entradas.map((entrada) => (
              <EntradaItem key={entrada.id} entrada={entrada} />
            ))}
          </ul>
        ))}
    </div>
  )
}

function EntradaItem({ entrada }: { entrada: HistorialEntrada }) {
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{entrada.usuarioNombre || 'Usuario desconocido'}</span>
        <span>{formateadorFecha.format(new Date(entrada.fechaHora))}</span>
      </div>
      <p className="mt-1 text-sm text-slate-200">{descripcionEntrada(entrada)}</p>
      {entrada.motivo && <p className="mt-1 text-xs text-slate-400">Motivo: {entrada.motivo}</p>}
    </li>
  )
}
