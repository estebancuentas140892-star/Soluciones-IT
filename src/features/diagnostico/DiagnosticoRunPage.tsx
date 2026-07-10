import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db, type MotivoNoResuelto, type NodoDiagnostico, type ProgresoDiagnostico } from '../../lib/db'
import { normalizarNodos, porcentajeDiagnostico } from '../../lib/diagnostico'
import { normalizarProcedimiento, tareasDe } from '../../lib/procedimiento'
import {
  duracionSegundos,
  eliminarProgresoDiagnostico,
  iniciarDiagnostico,
  responderOpcion,
  terminarEjecucionArticulo,
  volverAtras,
} from '../../lib/progresoDiagnostico'
import { contarHechos, verificacionFinalCompleta } from '../../lib/progresoPasos'
import { registrarEjecucionDiagnostico } from '../../lib/repositorio'
import { BotonVolver } from '../../components/BotonVolver'
import { AsistenteVista } from '../soluciones/AsistenteVista'

// Asistente del Modo Diagnostico Inteligente: guia al tecnico desde el
// problema hasta la solucion con una pregunta a la vez. Vive fuera del
// Layout (sin barra inferior), como el modo asistente de los
// procedimientos, para mostrar solo lo necesario en el momento exacto.
// El avance vive en la base local (progresoDiagnostico): salir, quedar
// sin señal o ejecutar un procedimiento vinculado nunca lo pierde.
export function DiagnosticoRunPage() {
  const { diagnosticoId = '' } = useParams()
  const navigate = useNavigate()
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  const diagnostico = useLiveQuery(() => db.diagnosticos.get(diagnosticoId), [diagnosticoId])
  // `?? null` distingue "todavia cargando" (undefined) de "no hay
  // sesion en curso" (null): sin esto la pantalla de inicio del
  // diagnostico jamas apareceria.
  const progreso = useLiveQuery(
    async () => (await db.progresoDiagnostico.get(diagnosticoId)) ?? null,
    [diagnosticoId],
  )
  const nodos = useMemo(
    () => normalizarNodos(diagnostico && !diagnostico.eliminadoEn ? diagnostico.nodos : []),
    [diagnostico],
  )

  if (diagnostico === null || diagnostico?.eliminadoEn) return <Navigate to="/diagnostico" replace />
  if (diagnostico === undefined || progreso === undefined) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  // Cierra la sesion registrando la ejecucion. El registro es la base
  // de las estadisticas: problemas frecuentes, tasa de exito, tiempo.
  // motivo y solucionPropuesta (fase D3) solo tienen sentido cuando
  // resuelto es 'no': se piden en la pantalla de resultado.
  async function cerrar(
    resuelto: 'si' | 'no' | 'abandonado',
    sesion: ProgresoDiagnostico,
    motivo: MotivoNoResuelto = '',
    solucionPropuesta = '',
  ) {
    if (cerrando) return
    setCerrando(true)
    // Un abandono sin ninguna respuesta no aporta nada a las
    // estadisticas: se descarta sin registrar.
    if (resuelto !== 'abandonado' || sesion.camino.length > 0) {
      await registrarEjecucionDiagnostico({
        diagnosticoId,
        diagnosticoTitulo: diagnostico?.titulo ?? '',
        camino: sesion.camino,
        articulosEjecutados: sesion.articulosEjecutados,
        resuelto,
        duracionSegundos: duracionSegundos(sesion),
        motivo,
        solucionPropuesta,
      })
    }
    await eliminarProgresoDiagnostico(diagnosticoId)
    navigate('/diagnostico')
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-4 pb-10 pt-6">
      <header className="flex items-center justify-between gap-2">
        <BotonVolver to="/diagnostico">Salir</BotonVolver>
        <div className="flex min-w-0 items-center gap-3">
          <p className="min-w-0 truncate text-xs text-slate-500">{diagnostico.titulo}</p>
          <Link
            to={`/diagnostico/${diagnosticoId}/editar`}
            className="shrink-0 text-xs text-slate-400 underline underline-offset-2"
          >
            Editar
          </Link>
        </div>
      </header>

      {!progreso ? (
        <Intro
          titulo={diagnostico.titulo}
          descripcion={diagnostico.descripcion}
          sinPreguntas={nodos.length === 0}
          diagnosticoId={diagnosticoId}
          onComenzar={() => void iniciarDiagnostico(diagnosticoId, nodos[0].id)}
        />
      ) : (
        <Sesion
          nodos={nodos}
          progreso={progreso}
          diagnosticoId={diagnosticoId}
          confirmandoCancelar={confirmandoCancelar}
          onConfirmarCancelar={setConfirmandoCancelar}
          onCerrar={(resuelto, motivo, solucionPropuesta) =>
            void cerrar(resuelto, progreso, motivo, solucionPropuesta)
          }
        />
      )}
    </div>
  )
}

function Intro({
  titulo,
  descripcion,
  sinPreguntas,
  diagnosticoId,
  onComenzar,
}: {
  titulo: string
  descripcion: string
  sinPreguntas: boolean
  diagnosticoId: string
  onComenzar: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-400">{descripcion}</p>}
      </div>

      {sinPreguntas ? (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3">
          <p className="text-sm text-amber-200">
            Este diagnóstico todavía no tiene preguntas.{' '}
            <Link to={`/diagnostico/${diagnosticoId}/editar`} className="underline underline-offset-2">
              Edítalo
            </Link>{' '}
            para agregarlas.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            Responde las preguntas y el diagnóstico te llevará a la solución más probable, ejecutando
            los procedimientos necesarios en el camino.
          </p>
          <button
            type="button"
            onClick={onComenzar}
            className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950"
          >
            Comenzar
          </button>
        </>
      )}
    </div>
  )
}

function Sesion({
  nodos,
  progreso,
  diagnosticoId,
  confirmandoCancelar,
  onConfirmarCancelar,
  onCerrar,
}: {
  nodos: NodoDiagnostico[]
  progreso: ProgresoDiagnostico
  diagnosticoId: string
  confirmandoCancelar: boolean
  onConfirmarCancelar: (valor: boolean) => void
  onCerrar: (resuelto: 'si' | 'no' | 'abandonado', motivo?: MotivoNoResuelto, solucionPropuesta?: string) => void
}) {
  const { estado, camino } = progreso
  const porcentaje = porcentajeDiagnostico(nodos, camino, estado)

  const nodoActual =
    estado.tipo === 'pregunta' ? nodos.find((n) => n.id === estado.nodoId) ?? null : null

  return (
    <div className="flex flex-col gap-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${estado.tipo === 'final' ? 'bg-emerald-500' : 'bg-sky-500'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {estado.tipo === 'pregunta' && !nodoActual && (
        // El diagnostico se edito a mitad de una sesion y la pregunta
        // actual ya no existe: no hay forma segura de continuar.
        <div className="flex flex-col gap-3 rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3">
          <p className="text-sm text-amber-200">
            El diagnóstico cambió y la pregunta actual ya no existe. Hay que empezar de nuevo.
          </p>
          <button
            type="button"
            onClick={() => void eliminarProgresoDiagnostico(diagnosticoId)}
            className="self-start rounded-lg border border-amber-800 px-3 py-1.5 text-xs text-amber-300"
          >
            Empezar de nuevo
          </button>
        </div>
      )}

      {estado.tipo === 'pregunta' && nodoActual && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{nodoActual.pregunta}</h2>
            {nodoActual.descripcion && (
              <p className="mt-1 text-sm text-slate-400">{nodoActual.descripcion}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {nodoActual.opciones.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => void responderOpcion(diagnosticoId, nodoActual, opcion)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-medium text-slate-100 active:bg-slate-800"
              >
                {opcion.etiqueta}
                {opcion.articuloId && (
                  <span className="mt-0.5 block text-xs font-normal text-sky-300">
                    Ejecuta: {opcion.articuloTitulo}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {estado.tipo === 'articulo' && (
        <ArticuloEnDiagnostico
          articuloId={estado.articuloId}
          articuloTitulo={estado.articuloTitulo}
          onCompletado={() => void terminarEjecucionArticulo(diagnosticoId)}
        />
      )}

      {estado.tipo === 'final' && (
        <Resultado progreso={progreso} onCerrar={onCerrar} />
      )}

      {estado.tipo !== 'final' && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {camino.length > 0 ? (
            <button
              type="button"
              onClick={() => void volverAtras(diagnosticoId)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
            >
              ← Volver
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onConfirmarCancelar(true)}
            className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400"
          >
            Cancelar
          </button>
        </div>
      )}

      {confirmandoCancelar && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
          <p className="text-sm text-slate-200">¿Cancelar el diagnóstico?</p>
          <p className="mt-0.5 text-xs text-slate-500">
            El avance se descarta y quedará registrado como abandonado.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onCerrar('abandonado')}
              className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400"
            >
              Sí, cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirmarCancelar(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
            >
              Seguir con el diagnóstico
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Un procedimiento vinculado ejecutandose dentro del diagnostico, en
// modo asistente. Cuando queda completo (todos los pasos y su
// verificacion final), avisa y el diagnostico continua solo desde la
// siguiente pregunta: el tecnico nunca pierde el punto donde estaba.
function ArticuloEnDiagnostico({
  articuloId,
  articuloTitulo,
  onCompletado,
}: {
  articuloId: string
  articuloTitulo: string
  onCompletado: () => void
}) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(articuloId)) ?? null, [articuloId])
  const progresoPasos = useLiveQuery(() => db.progresoPasos.get(articuloId), [articuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )

  const completo = useMemo(() => {
    if (!procedimiento) return false
    const hechos = contarHechos(
      progresoPasos?.pasosHechos ?? [],
      procedimiento.pasos.map((p) => p.id),
    )
    return (
      procedimiento.pasos.length > 0 &&
      hechos === procedimiento.pasos.length &&
      verificacionFinalCompleta(progresoPasos?.verificacionHecha, procedimiento.verificacionFinal.length)
    )
  }, [procedimiento, progresoPasos])

  // Aviso una sola vez: al completarse, el diagnostico avanza y este
  // componente se desmonta; el guardia evita un doble disparo mientras
  // tanto (por ejemplo, por un refresco extra de las live queries).
  const avisado = useRef(false)
  useEffect(() => {
    if (completo && !avisado.current) {
      avisado.current = true
      onCompletado()
    }
  }, [completo, onCompletado])

  if (articulo === undefined) return null

  // El articulo vinculado ya no existe o quedo sin procedimiento: no
  // hay nada que ejecutar. Se avisa y se deja continuar a mano.
  if (articulo === null || articulo.eliminadoEn || !procedimiento) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3">
        <p className="text-sm text-amber-200">
          El procedimiento{articuloTitulo ? ` "${articuloTitulo}"` : ''} ya no está disponible. Edita
          el diagnóstico para actualizar el vínculo.
        </p>
        <button
          type="button"
          onClick={onCompletado}
          className="self-start rounded-lg border border-amber-800 px-3 py-1.5 text-xs text-amber-300"
        >
          Continuar con el diagnóstico
        </button>
      </div>
    )
  }

  const tieneTareas = procedimiento.pasos.some((p) => tareasDe(p.bloques).length > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-2.5">
        <p className="text-xs text-sky-300">Ejecutando el procedimiento</p>
        <p className="text-sm font-medium text-sky-100">{articulo.titulo}</p>
        {!tieneTareas && (
          <p className="mt-0.5 text-xs text-sky-300/80">
            Marca cada paso con su número al completarlo.
          </p>
        )}
      </div>
      <AsistenteVista articuloId={articuloId} procedimiento={procedimiento} nivel={0} />
    </div>
  )
}

const MOTIVOS_NO_RESUELTO: { valor: Exclude<MotivoNoResuelto, ''>; etiqueta: string }[] = [
  { valor: 'no_funciono', etiqueta: 'La solución no funcionó' },
  { valor: 'no_encontro_problema', etiqueta: 'No encontré mi problema' },
  { valor: 'faltan_pasos', etiqueta: 'Faltan pasos' },
  { valor: 'encontro_otra_solucion', etiqueta: 'Encontré otra solución' },
  { valor: 'otro', etiqueta: 'Otro' },
]

// Resultado del diagnostico: que se encontro, que se ejecuto y la
// pregunta que alimenta las estadisticas: ¿quedo resuelto? Si "No",
// pide el motivo (fase D3) antes de cerrar: alimenta las sugerencias
// del equipo cuando el motivo es "encontré otra solución".
function Resultado({
  progreso,
  onCerrar,
}: {
  progreso: ProgresoDiagnostico
  onCerrar: (resuelto: 'si' | 'no', motivo?: MotivoNoResuelto, solucionPropuesta?: string) => void
}) {
  const { estado, camino, articulosEjecutados } = progreso
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)
  const [motivo, setMotivo] = useState<MotivoNoResuelto>('')
  const [solucionPropuesta, setSolucionPropuesta] = useState('')

  if (estado.tipo !== 'final') return null

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">Diagnóstico completado</p>
        <p className="mt-1 text-sm text-emerald-100">
          {estado.mensajeFinal ||
            (estado.articuloTitulo
              ? `Se ejecutó "${estado.articuloTitulo}".`
              : 'Se recorrieron todas las preguntas.')}
        </p>
      </div>

      {camino.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <h2 className="text-xs font-medium text-slate-400">Camino recorrido</h2>
          <ul className="mt-1.5 flex flex-col gap-1">
            {camino.map((paso, indice) => (
              <li key={indice} className="text-xs text-slate-300">
                {paso.pregunta} <span className="text-sky-300">→ {paso.etiqueta}</span>
              </li>
            ))}
          </ul>
          {articulosEjecutados.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Procedimientos ejecutados: {articulosEjecutados.map((a) => a.titulo).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
        <p className="text-sm font-medium text-slate-200">¿Quedó resuelto el problema?</p>

        {!pidiendoMotivo ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onCerrar('si')}
              className="rounded-xl border border-emerald-800 px-4 py-2 text-sm text-emerald-300"
            >
              Sí, resuelto
            </button>
            <button
              type="button"
              onClick={() => setPidiendoMotivo(true)}
              className="rounded-xl border border-amber-800 px-4 py-2 text-sm text-amber-300"
            >
              No
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-xs text-slate-400">¿Por qué no quedó resuelto? (opcional)</p>
            <div className="flex flex-col gap-1.5">
              {MOTIVOS_NO_RESUELTO.map((opcion) => (
                <label key={opcion.valor} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    name="motivo-no-resuelto"
                    checked={motivo === opcion.valor}
                    onChange={() => setMotivo(opcion.valor)}
                  />
                  {opcion.etiqueta}
                </label>
              ))}
            </div>

            {motivo === 'encontro_otra_solucion' && (
              <textarea
                rows={3}
                value={solucionPropuesta}
                onChange={(e) => setSolucionPropuesta(e.target.value)}
                placeholder="Cuéntanos qué funcionó, para revisarlo e incorporarlo a la base de conocimiento"
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            )}

            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onCerrar(
                    'no',
                    motivo,
                    motivo === 'encontro_otra_solucion' ? solucionPropuesta.trim() : '',
                  )
                }
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setPidiendoMotivo(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
