import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, type HistorialEntrada, type TipoEntidadHistorial } from '../../lib/db'
import { Adjuntos } from '../../components/Adjuntos'
import { resumenDetalles } from './resumenDetalles'
import { resumenProcedimiento, textoContexto } from './resumenProcedimiento'
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
      {entrada.campo === 'procedimiento' ? (
        <CambioProcedimiento entrada={entrada} />
      ) : entrada.campo === 'detalles' ? (
        <CambioDetalles entrada={entrada} />
      ) : (
        <p className="mt-1 text-sm text-slate-200">{descripcionEntrada(entrada)}</p>
      )}
      {entrada.campo === 'intervencion' && (
        <div className="mt-2">
          <Adjuntos entidadTipo="historial" entidadId={entrada.id} />
        </div>
      )}
      {entrada.motivo && <p className="mt-1 text-xs text-slate-400">Motivo: {entrada.motivo}</p>}
    </li>
  )
}

// Cambio de un procedimiento: en vez del JSON completo, un resumen en
// lenguaje natural de que cambio y en que paso. El JSON crudo queda a
// mano en "Detalle técnico" (plegado) por si un desarrollador lo
// necesita para depurar.
function CambioProcedimiento({ entrada }: { entrada: HistorialEntrada }) {
  const resumen = useMemo(
    () => resumenProcedimiento(entrada.valorAnterior, entrada.valorNuevo),
    [entrada.valorAnterior, entrada.valorNuevo],
  )

  return (
    <ResumenCambios
      titulo="Cambios en el procedimiento"
      contexto={resumen.contexto ? `Antes: ${textoContexto(resumen.contexto)}` : null}
      cambios={resumen.cambios}
      entrada={entrada}
      valorVacio="(sin procedimiento)"
    />
  )
}

// Cambio de los "Campos adicionales" de un dispositivo: mismo patron
// que el procedimiento, pero comparando clave por clave del objeto.
function CambioDetalles({ entrada }: { entrada: HistorialEntrada }) {
  const resumen = useMemo(
    () => resumenDetalles(entrada.valorAnterior, entrada.valorNuevo),
    [entrada.valorAnterior, entrada.valorNuevo],
  )

  return (
    <ResumenCambios
      titulo="Cambios en los campos adicionales"
      contexto={null}
      cambios={resumen.cambios}
      entrada={entrada}
      valorVacio="(sin campos adicionales)"
    />
  )
}

function ResumenCambios({
  titulo,
  contexto,
  cambios,
  entrada,
  valorVacio,
}: {
  titulo: string
  contexto: string | null
  cambios: string[]
  entrada: HistorialEntrada
  valorVacio: string
}) {
  return (
    <div className="mt-1 flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-200">{titulo}</p>
      {contexto && <p className="text-xs text-slate-500">{contexto}</p>}
      <ul className="flex flex-col gap-1">
        {cambios.map((cambio, indice) => (
          <li key={indice} className="flex gap-2 text-sm text-slate-200">
            <span aria-hidden className="text-slate-500">
              •
            </span>
            <span>{cambio}</span>
          </li>
        ))}
      </ul>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer select-none">Detalle técnico</summary>
        <div className="mt-2 flex flex-col gap-2">
          <BloqueJson titulo="Antes" valor={entrada.valorAnterior} valorVacio={valorVacio} />
          <BloqueJson titulo="Después" valor={entrada.valorNuevo} valorVacio={valorVacio} />
        </div>
      </details>
    </div>
  )
}

function BloqueJson({
  titulo,
  valor,
  valorVacio,
}: {
  titulo: string
  valor: string
  valorVacio: string
}) {
  return (
    <div>
      <p className="mb-1 font-medium text-slate-400">{titulo}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-2 text-[11px] text-slate-400">
        {jsonBonito(valor, valorVacio)}
      </pre>
    </div>
  )
}

function jsonBonito(valor: string, valorVacio: string): string {
  if (!valor) return valorVacio
  try {
    return JSON.stringify(JSON.parse(valor), null, 2)
  } catch {
    return valor
  }
}
