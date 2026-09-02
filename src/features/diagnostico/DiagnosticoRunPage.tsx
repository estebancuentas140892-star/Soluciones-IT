import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { db, type MotivoNoResuelto, type NodoDiagnostico, type ProgresoDiagnostico } from '../../lib/db'
import { normalizarNodos, porcentajeDiagnostico } from '../../lib/diagnostico'
import { normalizarProcedimiento, procedimientoEjecutable, tareasDe } from '../../lib/procedimiento'
import {
  duracionSegundos,
  eliminarProgresoDiagnostico,
  iniciarDiagnostico,
  responderOpcion,
  terminarEjecucionArticulo,
  volverAtras,
} from '../../lib/progresoDiagnostico'
import { contarHechos, verificacionFinalCompleta } from '../../lib/progresoPasos'
import { Chasis } from '../../app/Chasis'
import { registrarEjecucionDiagnostico } from '../../lib/repositorio'
import {
  ArrowLeft,
  BookOpen,
  DotsThreeCircle,
  Lightbulb,
  ListPlus,
  MagnifyingGlass,
  PencilSimple,
  XCircle,
  type IconoProps,
} from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO } from '../../components/nocturne'
import { AsistenteVista } from '../soluciones/AsistenteVista'
import { ETIQUETA_MOTIVO, MOTIVOS_ORDEN, type MotivoConcreto } from './motivos'

// Asistente del Modo Diagnóstico Inteligente re-autorizado en Nocturne
// (handoff "Rediseño de aplicación empresarial", Diagnóstico.dc.html;
// tarea 81). Guía al técnico del problema a la solución con una pregunta
// a la vez. Vive fuera del Layout (sin barra inferior), como el modo
// asistente de los procedimientos: solo lo necesario en el momento
// exacto. El avance vive en la base local (progresoDiagnostico): salir,
// quedar sin señal o ejecutar un procedimiento vinculado nunca lo pierde.
// El diagnóstico arranca directo en la primera pregunta (decisión del
// usuario, 2026-07-18): tocar el problema en la lista entra de una.
export function DiagnosticoRunPage() {
  const { diagnosticoId = '' } = useParams()
  const navigate = useNavigate()
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  const diagnostico = useLiveQuery(() => db.diagnosticos.get(diagnosticoId), [diagnosticoId])
  // `?? null` distingue "todavía cargando" (undefined) de "no hay sesión
  // en curso" (null): sin esto el auto-inicio jamás dispararía.
  const progreso = useLiveQuery(
    async () => (await db.progresoDiagnostico.get(diagnosticoId)) ?? null,
    [diagnosticoId],
  )
  const nodos = useMemo(
    () => normalizarNodos(diagnostico && !diagnostico.eliminadoEn ? diagnostico.nodos : []),
    [diagnostico],
  )

  // Auto-inicio: al abrir un problema sin sesión previa se arranca en la
  // primera pregunta (sin pantalla intermedia). El ref evita un doble
  // disparo mientras la escritura se propaga por las live queries.
  const iniciando = useRef(false)
  useEffect(() => {
    if (progreso === null && nodos.length > 0 && !iniciando.current) {
      iniciando.current = true
      void iniciarDiagnostico(diagnosticoId, nodos[0].id)
    }
  }, [progreso, nodos, diagnosticoId])

  if (diagnostico === null || diagnostico?.eliminadoEn) return <Navigate to="/diagnostico" replace />

  // Salir descarta una sesión recién iniciada sin responder nada (no deja
  // un "en curso" fantasma tras el auto-inicio); si ya hay avance, se
  // conserva para retomarlo desde la lista.
  async function salir() {
    if (progreso && progreso.camino.length === 0) {
      await eliminarProgresoDiagnostico(diagnosticoId)
    }
    navigate('/diagnostico')
  }

  // Cierra la sesión registrando la ejecución. El registro es la base de
  // las estadísticas: problemas frecuentes, tasa de éxito, tiempo. motivo
  // y solucionPropuesta (fase D3) solo tienen sentido cuando resuelto es
  // 'no': se piden en la pantalla de resultado.
  async function cerrar(
    resuelto: 'si' | 'no' | 'abandonado',
    sesion: ProgresoDiagnostico,
    motivo: MotivoNoResuelto = '',
    solucionPropuesta = '',
  ) {
    if (cerrando) return
    setCerrando(true)
    // Un abandono sin ninguna respuesta no aporta nada a las estadísticas:
    // se descarta sin registrar.
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

  const titulo = diagnostico?.titulo ?? ''
  const cargando = diagnostico === undefined || progreso === undefined
  const sinPreguntas = !cargando && progreso === null && nodos.length === 0
  const esFinal = progreso?.estado.tipo === 'final'
  const porcentaje = progreso ? porcentajeDiagnostico(nodos, progreso.camino, progreso.estado) : 0
  const etiquetaProgreso = esFinal ? 'Completado' : `Pregunta ${(progreso?.camino.length ?? 0) + 1}`
  // Última respuesta dada, para la línea que la muestra y permite
  // volver a ella. En el resultado final no se ofrece: ahí el camino
  // completo ya está escrito, y retroceder no tendría sentido.
  const ultimaRespuesta = esFinal ? null : (progreso?.camino.at(-1) ?? null)

  return (
    // Nivel 3 del chasis (tarea 185): tarea con salida. La X guarda el
    // avance antes de salir (`salir`), como hacía el botón "Salir" que
    // reemplaza. Debajo, la barra de progreso pegajosa (08_ESTILO).
    <Chasis
      modo="tarea"
      rotulo="Diagnosticando"
      titulo={titulo}
      vuelta="Diagnósticos"
      salidaEtiqueta="Guardar el avance y salir"
      alSalir={() => void salir()}
      barra={
        <>
          {/* SIN LÁPIZ AQUÍ (tarea 207, hallazgo M-028, regla M-R10). El
              "Editar diagnóstico" vivía dentro del modo ejecución con un
              objetivo de unos 27 px: autoría en mitad de una ejecución,
              y por debajo del mínimo de toque. Editar se ofrece donde
              tiene sentido: en la lista de diagnósticos y en la pantalla
              de resultado, con el camino recorrido delante. */}
          {progreso && (
            <div className="flex items-center gap-2.5 px-4 pb-2">
              <span className="block h-[3px] flex-1 overflow-hidden rounded-full bg-noct-neutral-900">
                <span
                  className={`block h-full rounded-full transition-[width] duration-200 ease-out ${
                    esFinal ? 'bg-noct-exito' : 'bg-noct-accent'
                  }`}
                  style={{ width: `${porcentaje}%` }}
                />
              </span>
              <span className="shrink-0 text-[11.5px] text-noct-neutral-500">{etiquetaProgreso}</span>
            </div>
          )}
          {/* LO QUE RESPONDISTE ANTES, A LA VISTA (tarea 207, hallazgo
              M-027). Durante la sesión el camino recorrido no se veía:
              aparecía solo al final, así que al dudar de una respuesta
              anterior había que retroceder A CIEGAS. Esta línea dice la
              última pregunta con su respuesta y lleva de vuelta a ella.

              SUSTITUYE al icono "Atrás" que la tarea 205 puso junto a la
              pregunta: hacían exactamente lo mismo y tener dos formas
              para la misma acción es lo que prohíbe R61. La separación
              que pedía M-R12 se conserva, y mejor: lo reversible vive
              arriba, pegado al progreso y NOMBRANDO su destino; lo
              irreversible sigue al pie, en texto y fuera del pulgar. */}
          {ultimaRespuesta && (
            <button
              type="button"
              onClick={() => void volverAtras(diagnosticoId)}
              aria-label={`Volver a la pregunta anterior: ${ultimaRespuesta.pregunta}. Respondiste: ${ultimaRespuesta.etiqueta}`}
              className="flex min-h-11 w-full items-center gap-2 px-4 pb-2.5 text-left hover:bg-noct-text/[.04]"
            >
              <ArrowLeft size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[12.5px] leading-normal">
                <span className="text-noct-neutral-500">{ultimaRespuesta.pregunta}: </span>
                <span className="font-medium text-noct-neutral-300">{ultimaRespuesta.etiqueta}</span>
              </span>
            </button>
          )}
        </>
      }
    >
      <main className="flex flex-1 flex-col gap-[18px] px-4 pb-10 pt-[22px]">
        {cargando && <p className="text-sm text-noct-neutral-400">Cargando...</p>}

        {sinPreguntas && (
          <div className="flex flex-col gap-3 rounded-lg border border-noct-precaucion/30 bg-noct-precaucion/10 px-4 py-3.5">
            <p className="text-[13px] leading-relaxed text-noct-text">
              Este diagnóstico todavía no tiene preguntas.
            </p>
            <Link
              to={`/diagnostico/${diagnosticoId}/editar`}
              className="self-start rounded-lg border border-noct-precaucion/45 px-3 py-1.5 text-[13px] font-medium text-noct-precaucion hover:bg-noct-precaucion/10"
            >
              Editar para agregarlas
            </Link>
          </div>
        )}

        {progreso && (
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
      </main>
    </Chasis>
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
  const { estado } = progreso

  const nodoActual =
    estado.tipo === 'pregunta' ? nodos.find((n) => n.id === estado.nodoId) ?? null : null

  return (
    <div className="flex flex-col gap-[18px]">
      {/* El "Atrás" de la tarea 205 (hallazgo M-026) subió a la banda
          de progreso en la tarea 207, convertido en la línea que dice a
          qué respuesta se vuelve (hallazgo M-027). Aquí no queda nada:
          dos controles para la misma acción es lo que prohíbe R61. */}

      {estado.tipo === 'pregunta' && !nodoActual && (
        // El diagnóstico se editó a mitad de una sesión y la pregunta
        // actual ya no existe: no hay forma segura de continuar.
        <div className="flex flex-col gap-3 rounded-lg border border-noct-precaucion/30 bg-noct-precaucion/10 px-4 py-3.5">
          <p className="text-[13px] leading-relaxed text-noct-text">
            El diagnóstico cambió y la pregunta actual ya no existe. Hay que empezar de nuevo.
          </p>
          <button
            type="button"
            onClick={() => void eliminarProgresoDiagnostico(diagnosticoId)}
            className="self-start rounded-lg border border-noct-precaucion/45 px-3 py-1.5 text-[13px] font-medium text-noct-precaucion hover:bg-noct-precaucion/10"
          >
            Empezar de nuevo
          </button>
        </div>
      )}

      {estado.tipo === 'pregunta' && nodoActual && (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-[20px] font-medium leading-[1.3] [text-wrap:pretty]">
              {nodoActual.pregunta}
            </h1>
            {nodoActual.descripcion && (
              <p className="mt-1.5 text-[13.5px] leading-[1.55] text-noct-neutral-400">
                {nodoActual.descripcion}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-[9px]">
            {nodoActual.opciones.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => void responderOpcion(diagnosticoId, nodoActual, opcion)}
                className="flex min-h-[52px] flex-col justify-center gap-[3px] rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-3 text-left transition-colors hover:border-noct-accent hover:bg-noct-accent/[.07]"
              >
                <span className="text-[14.5px] font-medium leading-[1.35]">{opcion.etiqueta}</span>
                {opcion.articuloId && (
                  <span className="flex items-center gap-1.5 text-[12px] text-noct-accent-300">
                    <BookOpen size={13} aria-hidden />
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
        <Resultado progreso={progreso} diagnosticoId={diagnosticoId} onCerrar={onCerrar} />
      )}

      {/* "Cancelar" deja de ser un botón (hallazgo M-026, regla M-R12:
          lo irreversible no comparte forma con lo reversible). Pasa a
          una frase en texto, fuera de la zona del pulgar donde caen
          las opciones de arriba, y dice de entrada que salir SÍ guarda
          el avance: la mayoría de las veces lo que el técnico quiere
          es justamente eso, no descartar nada. */}
      {estado.tipo !== 'final' && !confirmandoCancelar && (
        <p className="mt-1 text-center text-[12.5px] leading-relaxed text-noct-neutral-600">
          Salir guarda el avance.{' '}
          <button
            type="button"
            onClick={() => onConfirmarCancelar(true)}
            className="min-h-11 text-noct-error/85 underline decoration-noct-error/40 underline-offset-2 hover:text-noct-error"
          >
            Descartar este diagnóstico
          </button>
        </p>
      )}

      {confirmandoCancelar && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
          <div>
            <p className="text-sm font-medium">¿Cancelar el diagnóstico?</p>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-noct-neutral-500">
              El avance se descarta y queda registrado como abandonado.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onCerrar('abandonado')}
              className="min-h-11 rounded-lg border border-noct-error/45 px-3.5 text-[13px] font-medium text-noct-error hover:bg-noct-error/10"
            >
              Sí, cancelar
            </button>
            <button type="button" onClick={() => onConfirmarCancelar(false)} className={BTN_GHOST}>
              Seguir con el diagnóstico
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Un procedimiento vinculado ejecutándose dentro del diagnóstico, en modo
// asistente. Cuando queda completo (todos los pasos y su verificación
// final), avisa y el diagnóstico continúa solo desde la siguiente
// pregunta: el técnico nunca pierde el punto donde estaba.
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

  // Aviso una sola vez: al completarse, el diagnóstico avanza y este
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

  // El artículo vinculado ya no existe o quedó sin pasos: no hay nada
  // que ejecutar. Se avisa y se deja continuar a mano.
  if (articulo === null || articulo.eliminadoEn || !procedimientoEjecutable(procedimiento)) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-noct-precaucion/30 bg-noct-precaucion/10 px-4 py-3.5">
        <p className="text-[13px] leading-relaxed text-noct-text">
          El procedimiento{articuloTitulo ? ` "${articuloTitulo}"` : ''} ya no está disponible. Edita
          el diagnóstico para actualizar el vínculo.
        </p>
        <button
          type="button"
          onClick={onCompletado}
          className="self-start rounded-lg border border-noct-precaucion/45 px-3 py-1.5 text-[13px] font-medium text-noct-precaucion hover:bg-noct-precaucion/10"
        >
          Continuar con el diagnóstico
        </button>
      </div>
    )
  }

  const tieneTareas = procedimiento.pasos.some((p) => tareasDe(p.bloques).length > 0)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-lg border border-noct-accent/30 bg-noct-accent/10 px-3.5 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-noct-accent-300">
          Ejecutando el procedimiento
        </p>
        <p className="mt-[3px] text-[14.5px] font-medium">{articulo.titulo}</p>
        {!tieneTareas && (
          <p className="mt-0.5 text-[12px] text-noct-accent-300/80">
            Marca cada paso con su número al completarlo.
          </p>
        )}
      </div>
      <AsistenteVista articuloId={articuloId} procedimiento={procedimiento} nivel={0} />
    </div>
  )
}

// El texto de cada motivo vive en motivos.ts (unico dueño, tambien lo
// lee el tablero de estadisticas); el icono es un detalle de esta
// pantalla nada mas, asi que se mapea aparte en vez de meter React en
// un modulo de datos puro.
const ICONO_MOTIVO: Record<MotivoConcreto, (props: IconoProps) => React.JSX.Element> = {
  no_funciono: XCircle,
  no_encontro_problema: MagnifyingGlass,
  faltan_pasos: ListPlus,
  encontro_otra_solucion: Lightbulb,
  otro: DotsThreeCircle,
}

// Resultado del diagnóstico: qué se encontró, qué se ejecutó y la
// pregunta que alimenta las estadísticas: ¿quedó resuelto? Si "No", pide
// el motivo (fase D3) antes de cerrar: alimenta las sugerencias del
// equipo cuando el motivo es "encontré otra solución".
function Resultado({
  progreso,
  diagnosticoId,
  onCerrar,
}: {
  progreso: ProgresoDiagnostico
  diagnosticoId: string
  onCerrar: (resuelto: 'si' | 'no', motivo?: MotivoNoResuelto, solucionPropuesta?: string) => void
}) {
  const { estado, camino, articulosEjecutados } = progreso
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)
  const [motivo, setMotivo] = useState<MotivoNoResuelto>('')
  const [solucionPropuesta, setSolucionPropuesta] = useState('')

  if (estado.tipo !== 'final') return null

  const mensajeFinal =
    estado.mensajeFinal ||
    (estado.articuloTitulo
      ? `Se ejecutó "${estado.articuloTitulo}".`
      : 'Se recorrieron todas las preguntas.')

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-noct-exito/35 bg-noct-exito/[.09] p-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-noct-exito">
          Diagnóstico completado
        </p>
        <p className="mt-[5px] text-[14.5px] leading-[1.5]">{mensajeFinal}</p>
      </div>

      {camino.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500">
            Camino recorrido
          </h2>
          <div className="flex flex-col gap-[7px]">
            {camino.map((paso, indice) => (
              <p key={indice} className="text-[13px] leading-[1.5] text-noct-neutral-300">
                {paso.pregunta} <span className="text-noct-accent-300">→ {paso.etiqueta}</span>
              </p>
            ))}
          </div>
          {articulosEjecutados.length > 0 && (
            <p className="mt-2.5 text-[12.5px] text-noct-neutral-400">
              Procedimientos ejecutados: {articulosEjecutados.map((a) => a.titulo).join(', ')}
            </p>
          )}
          {/* Editar, aquí sí (tarea 207, hallazgo M-028, regla M-R10):
              con el camino recorrido delante es cuando el técnico sabe
              qué pregunta faltaba o cuál sobraba. La ejecución ya no
              ofrece esta puerta. */}
          <Link
            to={`/diagnostico/${diagnosticoId}/editar`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-noct-accent-300"
          >
            <PencilSimple size={15} aria-hidden />
            Editar este diagnóstico
          </Link>
        </section>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
        <p className="text-[14.5px] font-medium">¿Quedó resuelto el problema?</p>

        {!pidiendoMotivo ? (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onCerrar('si')}
              className="min-h-12 flex-1 rounded-lg border border-noct-exito/45 text-[14px] font-medium text-noct-exito hover:bg-noct-exito/10"
            >
              Sí, resuelto
            </button>
            <button
              type="button"
              onClick={() => setPidiendoMotivo(true)}
              className="min-h-12 flex-1 rounded-lg border border-noct-precaucion/45 text-[14px] font-medium text-noct-precaucion hover:bg-noct-precaucion/10"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12.5px] text-noct-neutral-400">
              ¿Por qué no quedó resuelto? Ayuda a mejorar la base.
            </p>
            <div className="flex flex-col gap-1">
              {MOTIVOS_ORDEN.map((valor) => {
                const activo = motivo === valor
                const Icono = ICONO_MOTIVO[valor]
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setMotivo(valor)}
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-2.5 text-left text-[13.5px] transition-colors ${
                      activo
                        ? 'border-noct-accent bg-noct-accent/10'
                        : 'border-noct-divider hover:bg-noct-text/[.04]'
                    }`}
                  >
                    <Icono
                      size={16}
                      className={`shrink-0 ${activo ? 'text-noct-accent-300' : 'text-noct-neutral-500'}`}
                      aria-hidden
                    />
                    {ETIQUETA_MOTIVO[valor]}
                  </button>
                )
              })}
            </div>

            {motivo === 'encontro_otra_solucion' && (
              <textarea
                rows={3}
                value={solucionPropuesta}
                onChange={(e) => setSolucionPropuesta(e.target.value)}
                placeholder="Qué funcionó, para revisarlo e incorporarlo a la base de conocimiento"
                className="w-full resize-y rounded-lg border border-noct-divider bg-noct-bg px-3 py-2.5 text-[13.5px] leading-[1.5] text-noct-text outline-none placeholder:text-noct-neutral-500 focus:border-noct-accent"
              />
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onCerrar(
                    'no',
                    motivo,
                    motivo === 'encontro_otra_solucion' ? solucionPropuesta.trim() : '',
                  )
                }
                className={`flex-1 ${BTN_PRIMARIO}`}
              >
                Confirmar
              </button>
              <button type="button" onClick={() => setPidiendoMotivo(false)} className={BTN_GHOST}>
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
