import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  db,
  type MotivoNoResuelto,
  type NodoDiagnostico,
  type ProgresoDiagnostico,
  type ResultadoRecorrido,
} from '../../lib/db'
import { normalizarNodos, pideConfirmacion, porcentajeDiagnostico, resultadoDelFinal } from '../../lib/diagnostico'
import { padreDe } from '../../lib/navegacion'
import { estadoDeRegreso } from '../../lib/origenNavegacion'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import {
  duracionSegundos,
  eliminarProgresoDiagnostico,
  iniciarDiagnostico,
  raizDelProcedimiento,
  responderOpcion,
  terminarEjecucionArticulo,
  volverAtras,
} from '../../lib/progresoDiagnostico'
import { contarHechos, verificacionFinalCompleta } from '../../lib/progresoPasos'
import { registrarVisita } from '../../lib/recientes'
import { Chasis } from '../../app/Chasis'
import { useOrigen } from '../../app/useOrigen'
import { registrarEjecucionDiagnostico } from '../../lib/repositorio'
import {
  ArrowLeft,
  BookOpen,
  CaretLeft,
  CheckCircle,
  DotsThreeCircle,
  FlagCheckered,
  Lightbulb,
  ListChecks,
  ListPlus,
  MagnifyingGlass,
  PencilSimple,
  Question,
  WarningOctagon,
  XCircle,
  type IconoProps,
} from '../../components/iconos'
import { BTN_GHOST, BTN_PRIMARIO } from '../../components/nocturne'
import { AsistenteVista } from '../soluciones/AsistenteVista'
import { ProveedorEjecucion } from '../soluciones/ProveedorEjecucion'
import { ETIQUETA_MOTIVO, MOTIVOS_ORDEN, type MotivoConcreto } from './motivos'

// Asistente del Modo Diagnóstico Inteligente re-autorizado en Nocturne
// (handoff "Rediseño de aplicación empresarial", Diagnóstico.dc.html;
// tarea 81). Guía al técnico del problema a la solución con una pregunta
// a la vez. El avance vive en la base local (progresoDiagnostico): salir,
// quedar sin señal o ejecutar un procedimiento vinculado nunca lo pierde.
// El recorrido arranca directo en la primera pregunta (decisión del
// usuario, 2026-07-18): tocar el problema entra de una.
//
// RESOLUCIÓN GUIADA (tarea 263, encargo del 2026-09-22). Para quien
// resuelve esto es una GUÍA CON PREGUNTAS, no otra herramienta:
//
//   - se entra desde Resolver (el buscador ya encuentra guías y
//     recorridos) y se sale a donde se vino, con la búsqueda, o a
//     Resolver; ya no a la lista de diagnósticos de Más;
//   - habla el idioma de la guía: "Resolviendo", "Decide", respuestas
//     grandes, el azul de la acción para lo que se va a hacer;
//   - el procedimiento de una respuesta se ejecuta con la MISMA
//     ejecución que una guía vinculada y con avance PROPIO del recorrido
//     (`raizDelProcedimiento`): la guía no se entera ni se reinicia, y al
//     terminar se vuelve solo a la pregunta siguiente;
//   - cada final dice cómo termina (Solucionado, Sigue sin resolverse,
//     Hay que escalar, Falta información): recorrer todo no es resolver.
export function DiagnosticoRunPage() {
  const { diagnosticoId = '' } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  // A DÓNDE SE VUELVE: de donde vino el técnico (la búsqueda de Resolver,
  // que se repone; la ficha de un equipo; la lista) y, si no, su padre
  // declarado, Resolver. El mismo criterio que la X de una guía.
  const origen = useOrigen()
  const salida = { to: origen?.to ?? padreDe(pathname)?.to ?? '/', estado: estadoDeRegreso(origen) }

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

  // Queda anotado en los recientes de este teléfono (tarea 241): es lo
  // que alimenta "Recientes" de Resolver, donde un recorrido a medias
  // dice en qué pregunta va (tarea 263).
  const idVisitado = diagnostico && !diagnostico.eliminadoEn ? diagnostico.id : null
  useEffect(() => {
    if (idVisitado) void registrarVisita('diagnostico', idVisitado)
  }, [idVisitado])

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

  if (diagnostico === null || diagnostico?.eliminadoEn) return <Navigate to={salida.to} replace />

  // Salir descarta una sesión recién iniciada sin responder nada (no deja
  // un "en curso" fantasma tras el auto-inicio); si ya hay avance, se
  // conserva para retomarlo desde Resolver ("Recientes").
  async function salir() {
    if (progreso && progreso.camino.length === 0) {
      await eliminarProgresoDiagnostico(diagnosticoId)
    }
    navigate(salida.to, { state: salida.estado })
  }

  // Cierra la sesión registrando la ejecución. El registro es la base de
  // las estadísticas: problemas frecuentes, tasa de éxito, tiempo. motivo
  // y solucionPropuesta (fase D3) solo tienen sentido cuando resuelto es
  // 'no': se piden en la pantalla de resultado. Al terminar se REEMPLAZA
  // la entrada del recorrido: el botón atrás no vuelve a un recorrido ya
  // cerrado (lo reabriría vacío).
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
    navigate(salida.to, { state: salida.estado, replace: true })
  }

  const titulo = diagnostico?.titulo ?? ''
  const cargando = diagnostico === undefined || progreso === undefined
  const sinPreguntas = !cargando && progreso === null && nodos.length === 0
  const esFinal = progreso?.estado.tipo === 'final'
  // El verde es de lo resuelto (o de lo que se va a confirmar): un final
  // que escala, que pide información o que no resolvió llena la barra en
  // neutro. Recorrer todo no es resolver (tarea 263).
  const colorBarra = !esFinal
    ? 'bg-noct-accent'
    : progreso && pideConfirmacion(resultadoDelFinal(progreso.estado))
      ? 'bg-noct-exito'
      : 'bg-noct-neutral-400'
  const porcentaje = progreso ? porcentajeDiagnostico(nodos, progreso.camino, progreso.estado) : 0
  const etiquetaProgreso = esFinal
    ? 'Terminado'
    : progreso?.estado.tipo === 'articulo'
      ? 'En la guía'
      : `Pregunta ${(progreso?.camino.length ?? 0) + 1}`
  // Última respuesta dada, para la línea que la muestra y permite
  // volver a ella. En el resultado final no se ofrece: ahí el camino
  // completo ya está escrito, y retroceder no tendría sentido.
  const ultimaRespuesta = esFinal ? null : (progreso?.camino.at(-1) ?? null)

  return (
    // Nivel 3 del chasis (tarea 185): tarea con salida. La X guarda el
    // avance antes de salir (`salir`). La ruta de vuelta la escribe el
    // chasis: el origen del salto o "Resolver". Debajo, la barra de
    // progreso pegajosa (08_ESTILO).
    <Chasis
      modo="tarea"
      rotulo="Resolviendo"
      titulo={titulo}
      salidaEtiqueta="Guardar el avance y salir"
      alSalir={() => void salir()}
      barra={
        <>
          {/* SIN LÁPIZ AQUÍ (tarea 207, hallazgo M-028, regla M-R10):
              editar se ofrece en la administración y en el resultado,
              con el camino recorrido delante. */}
          {progreso && (
            <div className="flex items-center gap-2.5 px-4 pb-2">
              <span className="block h-[3px] flex-1 overflow-hidden rounded-full bg-noct-neutral-900">
                <span
                  className={`block h-full rounded-full transition-[width] duration-200 ease-out ${colorBarra}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </span>
              <span className="shrink-0 text-[11.5px] text-noct-neutral-500">{etiquetaProgreso}</span>
            </div>
          )}
          {/* LO QUE RESPONDISTE ANTES, A LA VISTA (tarea 207, hallazgo
              M-027): la última pregunta con su respuesta, y lleva de
              vuelta a ella. Lo reversible vive arriba, nombrando su
              destino; lo irreversible, al pie y en texto (M-R12). */}
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
          <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-text/[.04] px-4 py-3.5">
            <p className="text-[13.5px] leading-relaxed text-noct-neutral-200">
              Esta guía todavía no tiene preguntas.
            </p>
            <Link
              to={`/diagnostico/${diagnosticoId}/editar`}
              className="inline-flex min-h-11 items-center self-start rounded-lg border border-noct-divider px-3 text-[13px] font-medium text-noct-text hover:bg-noct-text/[.07]"
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
            tituloRecorrido={titulo}
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
  tituloRecorrido,
  confirmandoCancelar,
  onConfirmarCancelar,
  onCerrar,
}: {
  nodos: NodoDiagnostico[]
  progreso: ProgresoDiagnostico
  diagnosticoId: string
  tituloRecorrido: string
  confirmandoCancelar: boolean
  onConfirmarCancelar: (valor: boolean) => void
  onCerrar: (resuelto: 'si' | 'no' | 'abandonado', motivo?: MotivoNoResuelto, solucionPropuesta?: string) => void
}) {
  const { estado } = progreso

  const nodoActual =
    estado.tipo === 'pregunta' ? nodos.find((n) => n.id === estado.nodoId) ?? null : null

  return (
    <div className="flex flex-col gap-[18px]">
      {estado.tipo === 'pregunta' && !nodoActual && (
        // La guía se editó a mitad de una sesión y la pregunta actual ya
        // no existe: no hay forma segura de continuar. Neutro: no es un
        // riesgo, y dentro de una guía el amarillo significa "lugar".
        <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-text/[.04] px-4 py-3.5">
          <p className="text-[13.5px] leading-relaxed text-noct-neutral-200">
            Esta guía cambió y la pregunta en la que ibas ya no existe. Hay que empezar de nuevo.
          </p>
          <button
            type="button"
            onClick={() => void eliminarProgresoDiagnostico(diagnosticoId)}
            className="inline-flex min-h-11 items-center self-start rounded-lg border border-noct-divider px-3 text-[13px] font-medium text-noct-text hover:bg-noct-text/[.07]"
          >
            Empezar de nuevo
          </button>
        </div>
      )}

      {estado.tipo === 'pregunta' && nodoActual && (
        <div className="flex flex-col gap-4">
          {/* LA PREGUNTA, EN EL IDIOMA DE LA GUÍA (tarea 263): la misma
              etiqueta "Decide" que una decisión dentro de una guía, con
              su icono y su palabra, y la pregunta en grande. */}
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-noct-neutral-300">
              <Question size={13} className="shrink-0" aria-hidden />
              Decide
            </p>
            <h1 className="text-[22px] font-medium leading-[1.3] text-pretty">{nodoActual.pregunta}</h1>
            {nodoActual.descripcion && (
              <p className="text-[14px] leading-[1.55] text-noct-neutral-400">{nodoActual.descripcion}</p>
            )}
          </div>
          {/* Las respuestas, grandes y de dedo (56 px): la pregunta se
              contesta de pie frente al equipo. La que lleva a una guía lo
              dice en el azul de la acción. */}
          <div className="flex flex-col gap-2.5">
            {nodoActual.opciones.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => void responderOpcion(diagnosticoId, nodoActual, opcion)}
                className="flex min-h-14 flex-col justify-center gap-1 rounded-xl border-[1.5px] border-noct-divider bg-noct-surface px-4 py-3 text-left transition-colors hover:border-noct-neutral-600 active:bg-noct-text/[.07]"
              >
                <span className="text-[16px] font-medium leading-snug text-pretty">{opcion.etiqueta}</span>
                {opcion.articuloId && (
                  <span className="flex items-start gap-1.5 text-[12.5px] leading-snug text-noct-accion">
                    <BookOpen size={13} className="mt-px shrink-0" aria-hidden />
                    <span className="min-w-0 text-pretty">Te lleva a «{opcion.articuloTitulo || 'una guía'}»</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {estado.tipo === 'articulo' && (
        <ProcedimientoEnRecorrido
          diagnosticoId={diagnosticoId}
          tituloRecorrido={tituloRecorrido}
          articuloId={estado.articuloId}
          articuloTitulo={estado.articuloTitulo}
          onCompletado={() => void terminarEjecucionArticulo(diagnosticoId)}
          onVolver={() => void volverAtras(diagnosticoId)}
        />
      )}

      {estado.tipo === 'final' && (
        <Resultado progreso={progreso} diagnosticoId={diagnosticoId} onCerrar={onCerrar} />
      )}

      {/* Descartar, en texto y fuera de la zona del pulgar (M-026, regla
          M-R12: lo irreversible no comparte forma con lo reversible). Y
          dice de entrada que salir SÍ guarda el avance. */}
      {estado.tipo !== 'final' && !confirmandoCancelar && (
        <p className="mt-1 text-center text-[12.5px] leading-relaxed text-noct-neutral-500">
          Salir guarda el avance.{' '}
          <button
            type="button"
            onClick={() => onConfirmarCancelar(true)}
            className="min-h-11 text-noct-error/85 underline decoration-noct-error/40 underline-offset-2 hover:text-noct-error"
          >
            Descartar este recorrido
          </button>
        </p>
      )}

      {confirmandoCancelar && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
          <div>
            <p className="text-sm font-medium">¿Descartar el recorrido?</p>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-noct-neutral-400">
              El avance se borra y queda registrado como abandonado.
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onCerrar('abandonado')}
              className="min-h-11 rounded-lg border border-noct-error/45 px-3.5 text-[13px] font-medium text-noct-error hover:bg-noct-error/10"
            >
              Sí, descartar
            </button>
            <button type="button" onClick={() => onConfirmarCancelar(false)} className={`min-h-11 ${BTN_GHOST}`}>
              Seguir con el recorrido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// UNA GUÍA DENTRO DEL RECORRIDO (tarea 263, encargo "Resolución guiada",
// sección 5: procedimiento vinculado). Se ejecuta con la misma
// `AsistenteVista` que cualquier guía, pero su avance vive en la raíz
// PROPIA del recorrido (`raizDelProcedimiento`): la guía abierta por su
// cuenta no se toca, no se reinicia y no aparece "a medias" en Resolver.
// La cabecera es la de una guía vinculada ("Estás realizando X para
// continuar con Y") y volver deshace la respuesta que la abrió. Cuando
// queda completa (todos los pasos y su verificación final), el recorrido
// continúa solo: el técnico nunca pierde el punto donde estaba, y salir
// a mitad y volver la retoma donde la dejó.
function ProcedimientoEnRecorrido({
  diagnosticoId,
  tituloRecorrido,
  articuloId,
  articuloTitulo,
  onCompletado,
  onVolver,
}: {
  diagnosticoId: string
  tituloRecorrido: string
  articuloId: string
  articuloTitulo: string
  onCompletado: () => void
  onVolver: () => void
}) {
  const raiz = raizDelProcedimiento(diagnosticoId)
  const articulo = useLiveQuery(async () => (await db.articulos.get(articuloId)) ?? null, [articuloId])
  const progresoPasos = useLiveQuery(() => db.progresoPasos.get(raiz), [raiz])
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

  // Aviso una sola vez: al completarse, el recorrido avanza y este
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

  // La guía vinculada ya no existe o quedó sin pasos: no hay nada que
  // ejecutar. Se dice y se deja continuar a mano.
  if (articulo === null || articulo.eliminadoEn || !procedimientoEjecutable(procedimiento)) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-noct-divider bg-noct-text/[.04] px-4 py-3.5">
        <p className="text-[13.5px] leading-relaxed text-noct-neutral-200">
          La guía{articuloTitulo ? ` «${articuloTitulo}»` : ''} ya no está disponible en este dispositivo.
          Puedes seguir con el recorrido y avisar a quien lo mantiene.
        </p>
        <button
          type="button"
          onClick={onCompletado}
          className="inline-flex min-h-11 items-center self-start rounded-lg border border-noct-divider px-3 text-[13px] font-medium text-noct-text hover:bg-noct-text/[.07]"
        >
          Continuar con el recorrido
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 border-b border-noct-divider pb-3">
        <h2 className="text-[15px] leading-snug text-pretty text-noct-neutral-200">
          Estás realizando <span className="font-semibold text-noct-text">«{articulo.titulo}»</span>
          {tituloRecorrido ? (
            <>
              {' '}para continuar con <span className="font-semibold text-noct-text">«{tituloRecorrido}»</span>
            </>
          ) : null}
        </h2>
        {/* VOLVER SIN TERMINAR NO CUMPLE NADA: deshace la respuesta que
            abrió la guía y vuelve a esa pregunta. Lo hecho en la guía se
            conserva si se vuelve a elegir la misma respuesta. */}
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-noct-divider px-3 text-[13px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.07]"
        >
          <CaretLeft size={15} className="shrink-0" aria-hidden />
          Volver a la pregunta
        </button>
      </div>
      <ProveedorEjecucion raizId={raiz}>
        <AsistenteVista articuloId={articulo.id} procedimiento={procedimiento} nivel={0} />
      </ProveedorEjecucion>
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

// CÓMO TERMINA, DICHO CON COLOR, ICONO Y PALABRA (tarea 263; el color
// nunca va solo, regla R16). Verde lo resuelto, rojo lo que obliga a
// detenerse y escalar, neutro lo demás. Sin indicar es lo escrito antes.
const CABECERA_RESULTADO: Record<
  ResultadoRecorrido,
  { titulo: string; Icono: (props: IconoProps) => React.JSX.Element; panel: string; color: string }
> = {
  '': { titulo: 'Recorrido terminado', Icono: FlagCheckered, panel: 'border-noct-divider bg-noct-surface', color: 'text-noct-neutral-300' },
  solucionado: { titulo: 'Solucionado', Icono: CheckCircle, panel: 'border-noct-exito/35 bg-noct-exito/[.09]', color: 'text-noct-exito' },
  sin_resolver: { titulo: 'Sigue sin resolverse', Icono: XCircle, panel: 'border-noct-divider bg-noct-surface', color: 'text-noct-neutral-300' },
  escalar: { titulo: 'Hay que escalar', Icono: WarningOctagon, panel: 'border-noct-error/40 bg-noct-error/[.08]', color: 'text-noct-error' },
  falta_informacion: {
    titulo: 'Falta información o un requisito',
    Icono: ListChecks,
    panel: 'border-noct-divider bg-noct-surface',
    color: 'text-noct-neutral-300',
  },
}

// Resultado del recorrido: cómo termina, qué se hizo y, solo cuando la
// rama lo resuelve o no lo dice, la pregunta que alimenta las
// estadísticas: ¿quedó resuelto? Si "No", pide el motivo (fase D3). Un
// final que ya dice que hay que escalar, que falta información o que
// sigue sin resolverse no se "confirma" como resuelto: se registra como
// no resuelto, con el camino recorrido, que dice por qué.
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

  const resultado = resultadoDelFinal(estado)
  const cabecera = CABECERA_RESULTADO[resultado]
  const mensajeFinal =
    estado.mensajeFinal ||
    (estado.articuloTitulo ? `Se hizo «${estado.articuloTitulo}».` : 'Se recorrieron todas las preguntas.')

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-lg border p-3.5 ${cabecera.panel}`}>
        <p className={`flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] ${cabecera.color}`}>
          <cabecera.Icono size={17} className="shrink-0" aria-hidden />
          {cabecera.titulo}
        </p>
        <p className="mt-[7px] text-[15px] leading-[1.5] text-pretty">{mensajeFinal}</p>
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
              Guías hechas: {articulosEjecutados.map((a) => a.titulo).join(', ')}
            </p>
          )}
          {/* Editar, aquí sí (tarea 207, hallazgo M-028, regla M-R10):
              con el camino recorrido delante es cuando se sabe qué
              pregunta faltaba o cuál sobraba. */}
          <Link
            to={`/diagnostico/${diagnosticoId}/editar`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-noct-accent-300"
          >
            <PencilSimple size={15} aria-hidden />
            Editar este recorrido
          </Link>
        </section>
      )}

      {!pideConfirmacion(resultado) ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-noct-divider bg-noct-surface p-3.5">
          <p className="text-[13px] leading-snug text-noct-neutral-300">
            Queda registrado como no resuelto, con el camino recorrido.
          </p>
          <button type="button" onClick={() => onCerrar('no')} className={`min-h-12 flex-1 ${BTN_PRIMARIO}`}>
            Terminar
          </button>
        </div>
      ) : (
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
              {/* "No" neutro (tarea 255): no es un riesgo, es la otra vía. */}
              <button
                type="button"
                onClick={() => setPidiendoMotivo(true)}
                className="min-h-12 flex-1 rounded-lg border border-noct-neutral-600 text-[14px] font-medium text-noct-neutral-200 hover:bg-noct-text/[.07]"
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
                  className={`min-h-11 flex-1 ${BTN_PRIMARIO}`}
                >
                  Confirmar
                </button>
                <button type="button" onClick={() => setPidiendoMotivo(false)} className={`min-h-11 ${BTN_GHOST}`}>
                  Volver
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
