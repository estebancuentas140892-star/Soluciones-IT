import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { db, type Articulo, type NodoDiagnostico } from '../../lib/db'
import {
  crearNodo,
  crearOpcion,
  normalizarNodos,
  prepararNodosParaGuardar,
  validarNodos,
} from '../../lib/diagnostico'
import { normalizarProcedimiento } from '../../lib/procedimiento'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { Historial } from '../historial/Historial'

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Editor de un diagnostico guiado: el problema (titulo y categoria) y
// su arbol de preguntas. Nada de editor grafico de grafos: una lista
// plana de preguntas donde cada respuesta elige con un select a que
// pregunta continuar, que procedimiento ejecutar o con que mensaje
// terminar. La validacion al guardar garantiza que ninguna rama quede
// suelta, sin ciclos y sin preguntas inalcanzables.
export function DiagnosticoForm() {
  const { diagnosticoId } = useParams()
  const navigate = useNavigate()
  const esEdicion = Boolean(diagnosticoId)

  const [id] = useState(() => diagnosticoId ?? nuevoId())
  const diagnostico = useLiveQuery(
    () => (diagnosticoId ? db.diagnosticos.get(diagnosticoId) : undefined),
    [diagnosticoId],
  )

  const [titulo, setTitulo] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [nodos, setNodos] = useState<NodoDiagnostico[]>(() => [crearNodo()])
  const [motivo, setMotivo] = useState('')
  const [problemas, setProblemas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [mostrarEliminar, setMostrarEliminar] = useState(false)
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)

  const categorias = useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], [])

  // Articulos con procedimiento: los bloques reutilizables que una
  // respuesta puede ejecutar. El diagnostico nunca duplica pasos.
  const vinculables = useLiveQuery(
    () =>
      db.articulos
        .filter((a) => !a.eliminadoEn && normalizarProcedimiento(a.procedimiento) !== null)
        .toArray(),
    [],
    [],
  )
  const vinculablesOrdenados = useMemo(
    () => [...vinculables].sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [vinculables],
  )

  useEffect(() => {
    if (!diagnostico || cargadoInicial) return
    setTitulo(diagnostico.titulo)
    setCategoriaId(diagnostico.categoriaId)
    setDescripcion(diagnostico.descripcion)
    const normalizados = normalizarNodos(diagnostico.nodos)
    setNodos(normalizados.length > 0 ? normalizados : [crearNodo()])
    setCargadoInicial(true)
  }, [diagnostico, cargadoInicial])

  if (esEdicion && diagnostico === null) return <Navigate to="/diagnostico" replace />
  if (esEdicion && !cargadoInicial) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()

    const preparados = prepararNodosParaGuardar(nodos)
    const encontrados = validarNodos(preparados)
    setProblemas(encontrados)
    if (encontrados.length > 0) return

    setGuardando(true)
    await guardarRegistro(
      'diagnosticos',
      { id, categoriaId, titulo: titulo.trim(), descripcion: descripcion.trim(), nodos: preparados },
      motivo.trim(),
    )
    navigate('/diagnostico')
  }

  async function eliminar() {
    await eliminarRegistro('diagnosticos', id)
    navigate('/diagnostico')
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver to="/diagnostico">Diagnósticos</BotonVolver>
        <h1 className="text-xl font-semibold">{esEdicion ? 'Editar diagnóstico' : 'Nuevo diagnóstico'}</h1>
      </header>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Problema
          <input
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Como lo diría el técnico: La impresora no imprime"
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Categoría
          <select
            required
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Elegir categoría...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Descripción (opcional)
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Una línea que ayude a reconocer el problema"
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <NodosEditor nodos={nodos} onChange={setNodos} articulos={vinculablesOrdenados} />

        {problemas.length > 0 && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3">
            <p className="text-xs font-medium text-red-300">Antes de guardar, revisa esto:</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {problemas.map((problema, indice) => (
                <li key={indice} className="text-xs text-red-200">
                  • {problema}
                </li>
              ))}
            </ul>
          </div>
        )}

        {esEdicion && (
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Motivo del cambio (opcional)
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Por qué se actualizó este diagnóstico?"
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>

        {esEdicion && (
          <button
            type="button"
            onClick={() => setMostrarEliminar(true)}
            className="rounded-xl border border-red-900 px-6 py-2.5 text-sm text-red-400"
          >
            Eliminar diagnóstico
          </button>
        )}
      </form>

      <DialogoEliminar
        abierto={mostrarEliminar}
        sensible
        titulo={`¿Eliminar el diagnóstico "${titulo}"?`}
        descripcion="Se eliminará el árbol de preguntas completo. Los procedimientos vinculados no se tocan."
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />

      {esEdicion && <Historial entidadTipo="diagnostico" entidadId={id} />}
    </div>
  )
}

// Editor del arbol: lista plana de preguntas numeradas. La primera es
// siempre el inicio del diagnostico.
function NodosEditor({
  nodos,
  onChange,
  articulos,
}: {
  nodos: NodoDiagnostico[]
  onChange: (nodos: NodoDiagnostico[]) => void
  articulos: Articulo[]
}) {
  function actualizarNodo(indice: number, cambios: Partial<NodoDiagnostico>) {
    onChange(nodos.map((nodo, i) => (i === indice ? { ...nodo, ...cambios } : nodo)))
  }

  function moverNodo(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion
    if (destino < 0 || destino >= nodos.length) return
    const copia = [...nodos]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    onChange(copia)
  }

  // Al eliminar una pregunta, las respuestas que apuntaban a ella
  // quedan sin destino (en vez de romperse): la validacion al guardar
  // pedira elegirles uno nuevo.
  function eliminarNodo(indice: number) {
    const eliminado = nodos[indice]
    onChange(
      nodos
        .filter((_, i) => i !== indice)
        .map((nodo) => ({
          ...nodo,
          opciones: nodo.opciones.map((opcion) =>
            opcion.siguienteNodoId === eliminado.id ? { ...opcion, siguienteNodoId: null } : opcion,
          ),
        })),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {nodos.map((nodo, indice) => (
        <div key={nodo.id} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              Pregunta {indice + 1}
              {indice === 0 ? ' (inicio)' : ''}
            </span>
            <div className="flex gap-1.5">
              <BotonMini etiqueta={`Subir la pregunta ${indice + 1}`} deshabilitado={indice === 0} onClick={() => moverNodo(indice, -1)}>
                ↑
              </BotonMini>
              <BotonMini
                etiqueta={`Bajar la pregunta ${indice + 1}`}
                deshabilitado={indice === nodos.length - 1}
                onClick={() => moverNodo(indice, 1)}
              >
                ↓
              </BotonMini>
              <BotonMini
                etiqueta={`Eliminar la pregunta ${indice + 1}`}
                deshabilitado={nodos.length === 1}
                onClick={() => eliminarNodo(indice)}
              >
                ✕
              </BotonMini>
            </div>
          </div>

          <input
            type="text"
            value={nodo.pregunta}
            onChange={(e) => actualizarNodo(indice, { pregunta: e.target.value })}
            placeholder="La pregunta (por ejemplo: ¿La impresora está encendida?)"
            className={CLASE_INPUT}
          />

          <input
            type="text"
            value={nodo.descripcion}
            onChange={(e) => actualizarNodo(indice, { descripcion: e.target.value })}
            placeholder="Cómo comprobarlo (opcional)"
            className={`${CLASE_INPUT} text-sm`}
          />

          <div className="flex flex-col gap-2">
            {nodo.opciones.map((opcion, indiceOpcion) => (
              <div key={opcion.id} className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opcion.etiqueta}
                    onChange={(e) =>
                      actualizarNodo(indice, {
                        opciones: nodo.opciones.map((o, i) =>
                          i === indiceOpcion ? { ...o, etiqueta: e.target.value } : o,
                        ),
                      })
                    }
                    placeholder="Respuesta (Sí, No, otra...)"
                    className={`${CLASE_INPUT} w-full`}
                  />
                  <BotonMini
                    etiqueta="Quitar esta respuesta"
                    onClick={() =>
                      actualizarNodo(indice, {
                        opciones: nodo.opciones.filter((_, i) => i !== indiceOpcion),
                      })
                    }
                  >
                    ✕
                  </BotonMini>
                </div>

                <select
                  value={opcion.siguienteNodoId ?? ''}
                  aria-label="A dónde lleva esta respuesta"
                  onChange={(e) =>
                    actualizarNodo(indice, {
                      opciones: nodo.opciones.map((o, i) =>
                        i === indiceOpcion ? { ...o, siguienteNodoId: e.target.value || null } : o,
                      ),
                    })
                  }
                  className={`${CLASE_INPUT} text-slate-300`}
                >
                  <option value="">Termina aquí (mensaje o procedimiento final)</option>
                  {nodos.map(
                    (destino, indiceDestino) =>
                      destino.id !== nodo.id && (
                        <option key={destino.id} value={destino.id}>
                          Continúa en la pregunta {indiceDestino + 1}
                          {destino.pregunta ? `: ${destino.pregunta.slice(0, 40)}` : ''}
                        </option>
                      ),
                  )}
                </select>

                <select
                  value={opcion.articuloId ?? ''}
                  aria-label="Procedimiento que ejecuta esta respuesta"
                  onChange={(e) => {
                    const articulo = articulos.find((a) => a.id === e.target.value) ?? null
                    actualizarNodo(indice, {
                      opciones: nodo.opciones.map((o, i) =>
                        i === indiceOpcion
                          ? { ...o, articuloId: articulo?.id ?? null, articuloTitulo: articulo?.titulo ?? '' }
                          : o,
                      ),
                    })
                  }}
                  className={`${CLASE_INPUT} text-slate-300`}
                >
                  <option value="">Sin procedimiento</option>
                  {articulos.map((a) => (
                    <option key={a.id} value={a.id}>
                      Ejecuta: {a.titulo}
                    </option>
                  ))}
                </select>

                {opcion.siguienteNodoId === null && (
                  <input
                    type="text"
                    value={opcion.mensajeFinal}
                    onChange={(e) =>
                      actualizarNodo(indice, {
                        opciones: nodo.opciones.map((o, i) =>
                          i === indiceOpcion ? { ...o, mensajeFinal: e.target.value } : o,
                        ),
                      })
                    }
                    placeholder="Mensaje final (por ejemplo: Enciéndela y prueba de nuevo)"
                    className={`${CLASE_INPUT} text-sm`}
                  />
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => actualizarNodo(indice, { opciones: [...nodo.opciones, crearOpcion()] })}
              className="self-start rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
            >
              + Respuesta
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...nodos, crearNodo()])}
        className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300"
      >
        + Pregunta
      </button>
    </div>
  )
}

function BotonMini({
  etiqueta,
  onClick,
  deshabilitado = false,
  children,
}: {
  etiqueta: string
  onClick: () => void
  deshabilitado?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-xs text-slate-400 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
