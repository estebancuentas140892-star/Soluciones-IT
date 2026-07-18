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

// Modo prueba del editor de diagnósticos (fase D2, recoloreado a
// Nocturne en la tarea 83): recorre el árbol EN MEMORIA, sin guardar,
// sin registrar la ejecución y sin ejecutar de verdad los
// procedimientos vinculados (los representa con una tarjeta). Comparte
// las transiciones puras con el asistente real (src/lib/diagnostico.ts),
// así que "qué respuesta lleva a dónde" es idéntico a lo que verá el
// técnico. Se muestra como capa sobre el formulario para conservar el
// estado sin editar y sin navegar.
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
    <div className="nocturne fixed inset-0 z-[70] overflow-y-auto bg-noct-bg font-inter text-noct-text">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-noct-divider bg-noct-bg/[.92] px-4 py-3 backdrop-blur-[12px]">
        <p className="flex items-center gap-2 text-sm font-medium text-noct-text">
          Probar diagnóstico
          <span className="rounded-full border border-noct-precaucion/50 bg-noct-precaucion/[.14] px-2 py-0.5 text-[10px] text-noct-precaucion">
            Modo prueba
          </span>
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-md border border-noct-divider px-3 py-1.5 text-xs text-noct-neutral-300 hover:bg-noct-text/5 hover:text-noct-text"
        >
          Cerrar
        </button>
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-5">
        <p className="text-xs text-noct-neutral-500">{titulo || 'Diagnóstico sin título'}</p>

        <p className="rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/[.09] px-3 py-2 text-xs text-noct-precaucion">
          Es un recorrido de prueba: no se guarda nada y los procedimientos vinculados no se ejecutan de verdad.
          Sirve para revisar que cada respuesta lleve a donde debe.
        </p>

        <div className="h-1.5 overflow-hidden rounded-full bg-noct-neutral-800">
          <div
            className={`h-full rounded-full transition-all ${estado.tipo === 'final' ? 'bg-noct-exito' : 'bg-noct-accent'}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>

        {nodos.length === 0 && (
          <p className="rounded-lg border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-sm text-noct-neutral-500">
            Agrega al menos una pregunta para probar el diagnóstico.
          </p>
        )}

        {estado.tipo === 'pregunta' && !nodoActual && (
          <div className="flex flex-col gap-3 rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/[.12] px-4 py-3">
            <p className="text-sm text-noct-precaucion">
              Esta respuesta apunta a una pregunta que ya no existe. En el diagnóstico real dejaría al técnico sin
              salida: revisa el destino de esa respuesta.
            </p>
            <button
              type="button"
              onClick={reiniciar}
              className="self-start rounded-md border border-noct-precaucion/50 px-3 py-1.5 text-xs text-noct-precaucion hover:bg-noct-precaucion/10"
            >
              Empezar de nuevo
            </button>
          </div>
        )}

        {estado.tipo === 'pregunta' && nodoActual && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-noct-text">{nodoActual.pregunta || '(pregunta sin texto)'}</h2>
              {nodoActual.descripcion && <p className="mt-1 text-sm text-noct-neutral-400">{nodoActual.descripcion}</p>}
            </div>

            {nodoActual.opciones.length === 0 ? (
              <p className="rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/[.12] px-4 py-3 text-sm text-noct-precaucion">
                Esta pregunta no tiene respuestas: agrégalas para que el técnico pueda continuar.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {nodoActual.opciones.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setAvance(avanceAlResponder(avance, nodoActual, opcion))}
                    className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-3 text-left text-sm font-medium text-noct-text hover:border-noct-accent"
                  >
                    {opcion.etiqueta || '(respuesta sin texto)'}
                    {opcion.articuloId && (
                      <span className="mt-0.5 block text-xs font-normal text-noct-accent-300">
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
            <div className="flex flex-col gap-3 rounded-lg border border-noct-accent/40 bg-noct-accent/10 px-4 py-3">
              <div>
                <p className="text-xs text-noct-accent-300">Aquí se ejecutaría el procedimiento</p>
                <p className="text-sm font-medium text-noct-text">{estado.articuloTitulo || 'Procedimiento vinculado'}</p>
              </div>
              <p className="text-xs text-noct-neutral-400">
                En el diagnóstico real, el técnico completa el procedimiento y luego el diagnóstico continúa.
              </p>
              <button
                type="button"
                onClick={() => setAvance(avanceTrasArticulo(avance))}
                className="self-start rounded-md border border-noct-accent px-4 py-2 text-xs font-medium text-noct-accent hover:bg-noct-accent/10"
              >
                Continuar (como si estuviera completo)
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-noct-error/40 bg-noct-error/[.12] px-4 py-3">
              <p className="text-sm text-noct-error">
                El procedimiento «{estado.articuloTitulo || 'vinculado'}» ya no está disponible (se eliminó o perdió
                sus pasos). Revisa el vínculo de esa respuesta.
              </p>
              <button
                type="button"
                onClick={() => setAvance(avanceTrasArticulo(avance))}
                className="self-start rounded-md border border-noct-error/50 px-3 py-1.5 text-xs text-noct-error hover:bg-noct-error/10"
              >
                Continuar de todos modos
              </button>
            </div>
          ))}

        {estado.tipo === 'final' && nodos.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-noct-exito/50 bg-noct-exito/10 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-noct-exito">Fin del recorrido</p>
              <p className="mt-1 text-sm text-noct-text">
                {estado.mensajeFinal ||
                  (estado.articuloTitulo
                    ? `Se ejecutó "${estado.articuloTitulo}".`
                    : 'Se recorrieron todas las preguntas.')}
              </p>
            </div>

            {camino.length > 0 && (
              <div className="rounded-lg border border-noct-divider bg-noct-surface px-4 py-3">
                <h3 className="text-xs font-medium text-noct-neutral-400">Camino recorrido</h3>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {camino.map((paso, indice) => (
                    <li key={indice} className="text-xs text-noct-neutral-300">
                      {paso.pregunta} <span className="text-noct-accent-300">→ {paso.etiqueta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={reiniciar}
              className="self-start rounded-md border border-noct-accent px-6 py-2.5 text-sm font-medium text-noct-accent hover:bg-noct-accent/10"
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
                className="rounded-md border border-noct-divider px-3 py-1.5 text-xs text-noct-neutral-300 hover:bg-noct-text/5 hover:text-noct-text"
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
                className="rounded-md border border-noct-divider px-3 py-1.5 text-xs text-noct-neutral-500 hover:text-noct-text"
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
