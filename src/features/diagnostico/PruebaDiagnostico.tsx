import { useMemo, useState } from 'react'
import type { NodoDiagnostico } from '../../lib/db'
import {
  avanceAlResponder,
  avanceAlRetroceder,
  avanceInicial,
  avanceTrasArticulo,
  porcentajeDiagnostico,
  type AvanceDiagnostico,
} from '../../lib/diagnostico'

interface Props {
  // Nodos EN MEMORIA del formulario (aún sin guardar), ya preparados
  // (recortados). El recorrido de prueba nunca toca la base.
  nodos: NodoDiagnostico[]
  titulo: string
  // Ids de artículos que siguen siendo ejecutables (existen, no
  // eliminados y con procedimiento). Un destino fuera de este conjunto
  // se marca como vínculo roto en vez de "ejecutarse".
  ejecutables: Set<string>
  onCerrar: () => void
}

// Modo prueba del editor de diagnósticos (fase D2): recorre el árbol
// EN MEMORIA, sin guardar, sin registrar la ejecución y sin ejecutar
// de verdad los procedimientos vinculados (los representa con una
// tarjeta). Comparte las transiciones puras con el asistente real
// (src/lib/diagnostico.ts), así que "qué respuesta lleva a dónde" es
// idéntico a lo que verá el técnico. Se muestra como capa sobre el
// formulario para conservar el estado sin editar y sin navegar.
export function PruebaDiagnostico({ nodos, titulo, ejecutables, onCerrar }: Props) {
  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos])
  const [avance, setAvance] = useState<AvanceDiagnostico>(() =>
    nodos.length > 0
      ? avanceInicial(nodos[0].id)
      : { camino: [], estado: { tipo: 'final', mensajeFinal: '', articuloId: null, articuloTitulo: '' }, articulosEjecutados: [] },
  )

  const reiniciar = () => setAvance(avanceInicial(nodos[0].id))
  const porcentaje = porcentajeDiagnostico(nodos, avance.camino, avance.estado)
  const { estado, camino } = avance

  const nodoActual = estado.tipo === 'pregunta' ? porId.get(estado.nodoId) ?? null : null

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <p className="text-sm font-medium text-slate-200">
          Probar diagnóstico
          <span className="ml-2 rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-400">
            Modo prueba
          </span>
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
        >
          Cerrar
        </button>
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-5 pb-10">
        <p className="text-xs text-slate-500">{titulo || 'Diagnóstico sin título'}</p>

        <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300/90">
          Es un recorrido de prueba: no se guarda nada y los procedimientos vinculados no se ejecutan de
          verdad. Sirve para revisar que cada respuesta lleve a donde debe.
        </p>

        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${estado.tipo === 'final' ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>

        {nodos.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
            Agrega al menos una pregunta para probar el diagnóstico.
          </p>
        )}

        {estado.tipo === 'pregunta' && !nodoActual && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3">
            <p className="text-sm text-amber-200">
              Esta respuesta apunta a una pregunta que ya no existe. En el diagnóstico real dejaría al
              técnico sin salida: revisa el destino de esa respuesta.
            </p>
            <button
              type="button"
              onClick={reiniciar}
              className="self-start rounded-lg border border-amber-800 px-3 py-1.5 text-xs text-amber-300"
            >
              Empezar de nuevo
            </button>
          </div>
        )}

        {estado.tipo === 'pregunta' && nodoActual && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{nodoActual.pregunta || '(pregunta sin texto)'}</h2>
              {nodoActual.descripcion && <p className="mt-1 text-sm text-slate-400">{nodoActual.descripcion}</p>}
            </div>

            {nodoActual.opciones.length === 0 ? (
              <p className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
                Esta pregunta no tiene respuestas: agrégalas para que el técnico pueda continuar.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {nodoActual.opciones.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setAvance(avanceAlResponder(avance, nodoActual, opcion))}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-medium text-slate-100 active:bg-slate-800"
                  >
                    {opcion.etiqueta || '(respuesta sin texto)'}
                    {opcion.articuloId && (
                      <span className="mt-0.5 block text-xs font-normal text-sky-300">
                        Ejecuta: {opcion.articuloTitulo || 'un procedimiento'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {estado.tipo === 'articulo' &&
          (ejecutables.has(estado.articuloId) ? (
            <div className="flex flex-col gap-3 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-3">
              <div>
                <p className="text-xs text-sky-300">Aquí se ejecutaría el procedimiento</p>
                <p className="text-sm font-medium text-sky-100">{estado.articuloTitulo || 'Procedimiento vinculado'}</p>
              </div>
              <p className="text-xs text-sky-300/80">
                En el diagnóstico real, el técnico completa el procedimiento y luego el diagnóstico continúa.
              </p>
              <button
                type="button"
                onClick={() => setAvance(avanceTrasArticulo(avance))}
                className="self-start rounded-lg bg-sky-500 px-4 py-2 text-xs font-medium text-slate-950"
              >
                Continuar (como si estuviera completo)
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3">
              <p className="text-sm text-red-200">
                ⚠ El procedimiento «{estado.articuloTitulo || 'vinculado'}» ya no está disponible (se eliminó o
                perdió sus pasos). Revisa el vínculo de esa respuesta.
              </p>
              <button
                type="button"
                onClick={() => setAvance(avanceTrasArticulo(avance))}
                className="self-start rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-300"
              >
                Continuar de todos modos
              </button>
            </div>
          ))}

        {estado.tipo === 'final' && nodos.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">Fin del recorrido</p>
              <p className="mt-1 text-sm text-emerald-100">
                {estado.mensajeFinal ||
                  (estado.articuloTitulo
                    ? `Se ejecutó "${estado.articuloTitulo}".`
                    : 'Se recorrieron todas las preguntas.')}
              </p>
            </div>

            {camino.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                <h3 className="text-xs font-medium text-slate-400">Camino recorrido</h3>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {camino.map((paso, indice) => (
                    <li key={indice} className="text-xs text-slate-300">
                      {paso.pregunta} <span className="text-sky-300">→ {paso.etiqueta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={reiniciar}
              className="self-start rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-950"
            >
              Volver a empezar
            </button>
          </div>
        )}

        {nodos.length > 0 && estado.tipo !== 'final' && (nodoActual || estado.tipo === 'articulo') && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {camino.length > 0 ? (
              <button
                type="button"
                onClick={() => setAvance(avanceAlRetroceder(avance))}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
              >
                ← Volver
              </button>
            ) : (
              <span />
            )}
            {camino.length > 0 && (
              <button
                type="button"
                onClick={reiniciar}
                className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400"
              >
                Reiniciar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
