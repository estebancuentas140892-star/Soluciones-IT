import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { BotonVolver } from '../../components/BotonVolver'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

// Vista simple de las propuestas del equipo (fase D3): cuando un
// diagnostico no resuelve el problema y el tecnico marca "Encontré
// otra solución", su texto libre queda aqui para que quien mantiene
// la base de conocimiento lo revise y lo convierta en un articulo si
// aplica. Sin flujo de aprobacion formal todavia: es solo una lista.
export function SugerenciasEquipoPage() {
  const sugerencias = useLiveQuery(
    () =>
      db.ejecuciones_diagnostico
        .filter((e) => e.motivo === 'encontro_otra_solucion' && e.solucionPropuesta.trim() !== '')
        .toArray()
        .then((lista) => lista.sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))),
    [],
    [],
  )

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to="/diagnostico">Diagnósticos</BotonVolver>
        <div>
          <h1 className="text-xl font-semibold">Sugerencias del equipo</h1>
          <p className="text-sm text-slate-400">
            Soluciones que un técnico encontró por su cuenta cuando un diagnóstico no resolvió el problema.
          </p>
        </div>
      </header>

      {sugerencias.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Todavía no hay sugerencias del equipo.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sugerencias.map((sugerencia) => (
          <li key={sugerencia.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>{sugerencia.diagnosticoTitulo}</span>
              <span>{formateadorFecha.format(new Date(sugerencia.fechaHora))}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{sugerencia.solucionPropuesta}</p>
            {sugerencia.usuarioNombre && (
              <p className="mt-1 text-xs text-slate-500">Reportado por {sugerencia.usuarioNombre}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
