import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type PasoProcedimiento, type Procedimiento } from '../../lib/db'
import {
  normalizarProcedimiento,
  pasoTrabajoPrevioCompleto,
  procedimientoEjecutable,
  siguientePasoPendiente,
  tareasDe,
} from '../../lib/procedimiento'
import {
  alternarVerificacionFinal,
  contarHechos,
  contarInstruccionesHechas,
  registrarEvidenciaPaso,
  reiniciarProgreso,
} from '../../lib/progresoPasos'
import { registrarIntervencion } from '../../lib/repositorio'
import { Adjuntos } from '../../components/Adjuntos'
import { Camera, CaretLeft, CaretRight, Check, ClockCounterClockwise, LinkSimple, SealCheck, Warning } from '../../components/iconos'
import { BTN_GHOST_ACENTO, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
import { useProcedimientoEjecucion } from './useProcedimientoEjecucion'

interface Props {
  articuloId: string
  procedimiento: Procedimiento
  // 0 = procedimiento principal del asistente; 1 = subprocedimiento o
  // solucion de un paso de nivel 0 (misma regla que ProcedimientoVista:
  // mas alla no se ejecuta aqui, solo se enlaza).
  nivel: number
  onCompletado?: () => void
}

// Formatea segundos como MM:SS (o H:MM:SS si pasa de una hora).
function formatoCronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  const dd = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dd(m)}:${dd(seg)}` : `${m}:${dd(seg)}`
}

// Modo ejecucion (asistente): en vez del "mapa" completo
// (ProcedimientoVista), esta vista muestra un paso a la vez con su
// objetivo y su checklist, para que el tecnico ejecute en el sitio sin
// distraerse con el resto del procedimiento. Rediseño Nocturne (tarea
// 78): antes vivia fuera del Layout con estilos de tema claro y se veia
// "en blanco" (texto claro sobre fondo blanco). Ahora: shell oscuro,
// cronometro contra el tiempo estimado, navegacion Atras/Siguiente
// explicita y resumen final. Reutiliza el mismo avance de
// useProcedimientoEjecucion que la vista de lista, asi que entrar y
// salir nunca pierde ni duplica progreso.
export function AsistenteVista({ articuloId, procedimiento, nivel, onCompletado }: Props) {
  const { pasos, verificacionFinal, tiempoEstimadoMin } = procedimiento
  const idsPasos = useMemo(() => pasos.map((p) => p.id), [pasos])

  // Equipo afectado por ESTE procedimiento (tarea 79, solo nivel 0):
  // determina si la captura de evidencia tiene donde registrarse. Un
  // subprocedimiento o solucion anidados ejecutan otro articulo, con
  // su propio equipo o ninguno; se mantiene fuera para no sumar mas
  // interfaz a paneles ya densos.
  const articulo = useLiveQuery(() => (nivel === 0 ? db.articulos.get(articuloId) : undefined), [articuloId, nivel])
  const dispositivoEvidencia = articulo?.dispositivosAfectados?.[0] ?? null

  const [indiceActual, setIndiceActual] = useState<number | null>(null)
  const [listo, setListo] = useState(false)

  // Cronometro de la sesion de ejecucion (solo nivel 0): tiempo desde
  // que se abrio el asistente, para contrastar con el estimado. Es
  // efimero (no se persiste): mide "cuanto llevo en esta sesion".
  const [inicio, setInicio] = useState(() => Date.now())
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (nivel !== 0) return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [nivel])
  const transcurridoSeg = Math.floor((ahora - inicio) / 1000)

  // La posicion inicial se resuelve una sola vez con una lectura
  // directa (no en vivo) del avance guardado: asi, si el tecnico ya
  // habia completado los primeros pasos, el asistente arranca en el
  // primero pendiente en vez de saltar al azar por una lectura a
  // medio cargar. De ahi en adelante el avance lo decide unicamente
  // onAvanzar (abajo), no una relectura del progreso.
  useEffect(() => {
    let vigente = true
    setListo(false)
    void db.progresoPasos.get(articuloId).then((prog) => {
      if (!vigente) return
      const hechosIniciales = new Set(prog?.pasosHechos ?? [])
      setIndiceActual(siguientePasoPendiente(idsPasos, hechosIniciales, -1))
      setListo(true)
    })
    return () => {
      vigente = false
    }
    // Solo al entrar a este articulo: idsPasos cambiaria si se edita el
    // procedimiento a mitad de ejecucion, un caso raro que no amerita
    // recalcular la posicion (podria saltar el avance del tecnico).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articuloId])

  const {
    progreso,
    hechos,
    instruccionesHechas,
    completados,
    pasosCompletados,
    verificacionCompleta,
    todoCompletado,
    subSatisfechoReactivo,
    alternarTarea,
    intentarCompletarPaso,
    completarPasoYAvanzar,
  } = useProcedimientoEjecucion({
    articuloId,
    procedimiento,
    nivel,
    onCompletado,
    onAvanzar: setIndiceActual,
  })

  // Reiniciar desde la pantalla de "completado": borra el progreso
  // guardado Y reposiciona la vista en el primer paso (con el cronometro
  // a cero). Sin lo segundo, indiceActual seguiria en null y la pantalla
  // de cierre no cambiaria: el boton "no hacia nada".
  async function reiniciarYVolver() {
    await reiniciarProgreso(articuloId)
    setInicio(Date.now())
    setAhora(Date.now())
    setIndiceActual(siguientePasoPendiente(idsPasos, new Set<string>(), -1))
  }

  if (!listo) return <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>

  // Anidado (subprocedimiento o solucion de un paso de nivel 0): el
  // padre deja de renderizar este componente en cuanto queda
  // satisfecho, asi que aqui no hace falta pantalla de cierre propia.
  if (indiceActual === null && nivel >= 1) return null

  const porcentaje = pasos.length === 0 ? 0 : Math.round((completados / pasos.length) * 100)
  const cronometro = nivel === 0 ? formatoCronometro(transcurridoSeg) : null

  if (indiceActual === null && pasosCompletados && verificacionFinal.length > 0 && !verificacionCompleta) {
    return (
      <div className="flex flex-col gap-4">
        <Encabezado porcentaje={porcentaje} completado={false} cronometro={cronometro} estimado={tiempoEstimadoMin} />
        <div className="rounded-xl border border-noct-precaucion/40 bg-noct-precaucion/10 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-noct-precaucion">
            <SealCheck size={16} aria-hidden />
            Verificación final
          </h2>
          <p className="mt-0.5 text-xs text-noct-precaucion/80">
            Confirma que el objetivo realmente se cumplió antes de dar por terminado el procedimiento.
          </p>
          <ul className="mt-2 flex flex-col gap-0.5">
            {verificacionFinal.map((item, indice) => {
              const marcada = (progreso?.verificacionHecha ?? []).includes(indice)
              return (
                <li key={indice}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcada}
                    onClick={() => void alternarVerificacionFinal(articuloId, indice)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-1 py-1.5 text-left"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        marcada
                          ? 'border-noct-exito bg-noct-exito/15 text-noct-exito'
                          : 'border-noct-neutral-700 text-transparent'
                      }`}
                    >
                      <Check size={12} />
                    </span>
                    <span className={`text-sm ${marcada ? 'text-noct-neutral-500 line-through' : 'text-noct-neutral-300'}`}>
                      {item}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  }

  if (indiceActual === null || todoCompletado) {
    return (
      <div className="flex flex-col gap-4">
        <Encabezado porcentaje={100} completado cronometro={cronometro} estimado={tiempoEstimadoMin} />
        <div className="flex flex-col items-center gap-2 rounded-xl border border-noct-exito/50 bg-noct-exito/10 px-4 py-8 text-center">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full border border-noct-exito/60 text-noct-exito">
            <Check size={26} />
          </span>
          <p className="text-base font-medium text-noct-exito">Procedimiento completado</p>
          <p className="text-xs text-noct-neutral-400">
            {pasos.length} {pasos.length === 1 ? 'paso' : 'pasos'}
            {cronometro ? ` · ${cronometro} en esta sesión` : ''}
          </p>
          <button
            type="button"
            onClick={() => void reiniciarYVolver()}
            className={`mt-2 ${BTN_SECUNDARIO}`}
          >
            <ClockCounterClockwise size={15} aria-hidden />
            Reiniciar y volver a empezar
          </button>
        </div>
      </div>
    )
  }

  const paso = pasos[indiceActual]
  const idsTareas = tareasDe(paso.bloques).map((t) => t.id)
  const marcadas = contarInstruccionesHechas(progreso?.instruccionesHechas, idsTareas)
  const subSatisfecho = subSatisfechoReactivo(paso)
  const trabajoPrevio = pasoTrabajoPrevioCompleto(idsTareas.length, marcadas, subSatisfecho)
  const pasoActualHecho = hechos.has(paso.id)
  // La pregunta de error ocupa el lugar del boton "Siguiente" mientras
  // no se responda; una vez respondida (o si no hay solucion vinculada,
  // o si se esta revisando un paso ya completo), el boton vuelve a
  // decidir el avance.
  const mostrandoPreguntaError = !pasoActualHecho && Boolean(paso.solucionArticuloId) && trabajoPrevio

  // Avance del boton principal. En un paso pendiente: intenta completarlo
  // (valida el trabajo previo y avanza al siguiente pendiente). En un
  // paso ya completo (al que se llego con "Atrás" para revisar): navega
  // linealmente hacia adelante, o al primer pendiente / al cierre.
  function avanzar() {
    if (indiceActual === null) return
    if (pasoActualHecho) {
      setIndiceActual(
        indiceActual + 1 < pasos.length ? indiceActual + 1 : siguientePasoPendiente(idsPasos, hechos, -1),
      )
    } else {
      void intentarCompletarPaso(indiceActual, paso)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Encabezado
        porcentaje={porcentaje}
        completado={false}
        cronometro={cronometro}
        estimado={tiempoEstimadoMin}
        contador={`Paso ${indiceActual + 1} de ${pasos.length}`}
      />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-noct-text">
          {paso.titulo || paso.subArticuloTitulo || `Paso ${indiceActual + 1}`}
        </h2>
        {paso.objetivo && <p className="text-sm text-noct-neutral-400">{paso.objetivo}</p>}
      </div>

      {paso.adjuntos.length > 0 && <AdjuntosPaso adjuntos={paso.adjuntos} titulo={paso.titulo} />}

      {paso.bloques.length > 0 && (
        <ul className="flex flex-col gap-2">
          {paso.bloques.map((bloque) => (
            <li key={bloque.id}>
              <BloqueVista
                bloque={bloque}
                marcada={instruccionesHechas.has(bloque.id)}
                onAlternar={() => void alternarTarea(indiceActual, paso, bloque.id)}
                nivel={nivel}
                ejecutarInline={({ articuloId: vinculadoId, procedimiento: vinculado, onCompletado }) => (
                  <AsistenteVista
                    articuloId={vinculadoId}
                    procedimiento={vinculado}
                    nivel={nivel + 1}
                    onCompletado={onCompletado}
                  />
                )}
              />
            </li>
          ))}
        </ul>
      )}

      {paso.vinculoProtegido && <CredencialEnPaso vinculo={paso.vinculoProtegido} />}

      {paso.subArticuloId && (
        <SubProcedimientoEnAsistente
          subArticuloId={paso.subArticuloId}
          tituloReferencia={paso.subArticuloTitulo}
          nivel={nivel}
          onCompletado={() => void intentarCompletarPaso(indiceActual, paso)}
        />
      )}

      {paso.solucionArticuloId && trabajoPrevio && !pasoActualHecho && (
        <SolucionEnAsistente
          solucionArticuloId={paso.solucionArticuloId}
          tituloReferencia={paso.solucionArticuloTitulo}
          nivel={nivel}
          onContinuar={() => void completarPasoYAvanzar(indiceActual, paso)}
        />
      )}

      {/* Evidencia fotografica del paso (tarea 79): solo si el
          procedimiento tiene un equipo afectado donde registrarla. */}
      {nivel === 0 && dispositivoEvidencia && (
        <EvidenciaPaso
          articuloId={articuloId}
          articuloTitulo={articulo?.titulo ?? ''}
          dispositivoId={dispositivoEvidencia.id}
          paso={paso}
          entradaId={progreso?.evidenciasPorPaso?.[paso.id] ?? null}
        />
      )}

      {/* Navegacion explicita en el modo ejecucion (nivel 0): Atrás para
          revisar el paso anterior y Siguiente para avanzar. Los pasos
          anidados conservan su boton unico (su avance lo decide el paso
          que los contiene). */}
      {!mostrandoPreguntaError && nivel === 0 && (
        <div className="mt-2 flex items-center gap-2.5">
          <button
            type="button"
            disabled={indiceActual === 0}
            onClick={() => setIndiceActual(Math.max(0, indiceActual - 1))}
            className={`${BTN_SECUNDARIO} min-h-11 px-4 disabled:opacity-30`}
          >
            <CaretLeft size={15} aria-hidden />
            Atrás
          </button>
          <button
            type="button"
            disabled={!pasoActualHecho && !trabajoPrevio}
            onClick={avanzar}
            className={`flex-1 ${BTN_PRIMARIO} min-h-11 text-sm disabled:opacity-30`}
          >
            {pasoActualHecho ? 'Siguiente paso' : 'Siguiente'}
            <CaretRight size={15} aria-hidden />
          </button>
        </div>
      )}

      {!mostrandoPreguntaError && nivel >= 1 && (
        <button
          type="button"
          disabled={!trabajoPrevio}
          onClick={() => void intentarCompletarPaso(indiceActual, paso)}
          className={`mt-2 ${BTN_PRIMARIO} min-h-11 text-sm disabled:opacity-30`}
        >
          Siguiente
          <CaretRight size={15} aria-hidden />
        </button>
      )}
    </div>
  )
}

// Encabezado del asistente: barra de progreso, contador de paso y, en el
// nivel 0, cronometro de la sesion contra el tiempo estimado.
function Encabezado({
  porcentaje,
  completado,
  cronometro,
  estimado,
  contador,
}: {
  porcentaje: number
  completado: boolean
  cronometro: string | null
  estimado: number | null
  contador?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-noct-neutral-800">
        <div
          className={`h-full rounded-full transition-all ${completado ? 'bg-noct-exito' : 'bg-noct-accent'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      {(contador || cronometro) && (
        <div className="flex items-center justify-between text-xs text-noct-neutral-500">
          <span>{contador}</span>
          {cronometro && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <ClockCounterClockwise size={13} aria-hidden />
              {cronometro}
              {estimado ? <span className="text-noct-neutral-600">/ ~{estimado} min</span> : null}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Evidencia fotografica del trabajo (tarea 79): "prueba de trabajo" que
// el tecnico documenta en el sitio al completar un paso. Reutiliza la
// misma bitacora que RegistrarIntervencion.tsx (una entrada de
// `historial` sobre el equipo afectado, con su galeria de `Adjuntos`),
// asi que la evidencia queda visible en el "Ver historial" normal del
// dispositivo, no en un lugar aparte. La entrada se crea una sola vez
// por paso (registrarEvidenciaPaso guarda el vinculo en el progreso
// local): revisitar el paso reutiliza la misma galeria en vez de crear
// intervenciones nuevas.
function EvidenciaPaso({
  articuloId,
  articuloTitulo,
  dispositivoId,
  paso,
  entradaId,
}: {
  articuloId: string
  articuloTitulo: string
  dispositivoId: string
  paso: PasoProcedimiento
  entradaId: string | null
}) {
  const [creando, setCreando] = useState(false)

  async function adjuntarEvidencia() {
    setCreando(true)
    const tituloPaso = paso.titulo || paso.subArticuloTitulo || 'paso sin título'
    const descripcion = `Evidencia del paso "${tituloPaso}" (${articuloTitulo})`
    const id = await registrarIntervencion(dispositivoId, descripcion)
    await registrarEvidenciaPaso(articuloId, paso.id, id)
    setCreando(false)
  }

  if (!entradaId) {
    return (
      <button
        type="button"
        disabled={creando}
        onClick={() => void adjuntarEvidencia()}
        className={`self-start ${BTN_GHOST_ACENTO} disabled:opacity-50`}
      >
        <Camera size={14} aria-hidden />
        {creando ? 'Preparando...' : 'Adjuntar evidencia de este paso'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface p-3">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-noct-neutral-400">
        <Camera size={13} aria-hidden />
        Evidencia de este paso
      </p>
      <Adjuntos entidadTipo="historial" entidadId={entradaId} />
    </div>
  )
}

// Subprocedimiento vinculado, en modo asistente: en vez de la lista
// completa (ProcedimientoVista), aqui se anida otro AsistenteVista, un
// paso a la vez. Al completarse avisa al paso que lo contiene.
function SubProcedimientoEnAsistente({
  subArticuloId,
  tituloReferencia,
  nivel,
  onCompletado,
}: {
  subArticuloId: string
  tituloReferencia: string
  nivel: number
  onCompletado: () => void
}) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(subArticuloId)) ?? null, [subArticuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )

  if (articulo === undefined) return null

  if (articulo === null || articulo.eliminadoEn) {
    return (
      <div className="rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/10 px-3 py-2">
        <p className="text-xs text-noct-precaucion">
          El procedimiento vinculado{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
          disponible. Edita el artículo para quitar el vínculo o vincular otro.
        </p>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Misma regla de un solo nivel que ProcedimientoVista: mas alla se
  // enlaza, sin ejecutar aqui, y evita cualquier ciclo de vinculos.
  if (nivel >= 1 || !procedimientoEjecutable(procedimiento)) {
    return (
      <Link
        to={ruta}
        className="flex items-center justify-between gap-2 rounded-lg border border-noct-accent/30 bg-noct-accent/10 px-3 py-2"
      >
        <p className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-noct-accent-300">
          <LinkSimple size={13} aria-hidden />
          Procedimiento: {articulo.titulo}
        </p>
        <span className="shrink-0 text-xs text-noct-accent-400 underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-noct-accent/30 bg-noct-accent/[.07] p-3">
      <p className="mb-3 inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-noct-accent-300">
        <LinkSimple size={13} aria-hidden />
        Procedimiento: {articulo.titulo}
      </p>
      <AsistenteVista
        articuloId={articulo.id}
        procedimiento={procedimiento}
        nivel={nivel + 1}
        onCompletado={onCompletado}
      />
    </div>
  )
}

// Pregunta de error del paso, en modo asistente: misma mecanica que
// ProcedimientoVista (No completa y sigue; Sí anida el asistente de la
// solucion), solo que la solucion tambien se ejecuta un paso a la vez.
function SolucionEnAsistente({
  solucionArticuloId,
  tituloReferencia,
  nivel,
  onContinuar,
}: {
  solucionArticuloId: string
  tituloReferencia: string
  nivel: number
  onContinuar: () => void
}) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(solucionArticuloId)) ?? null, [solucionArticuloId])
  const progreso = useLiveQuery(() => db.progresoPasos.get(solucionArticuloId), [solucionArticuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  const [mostrarSolucion, setMostrarSolucion] = useState<boolean | null>(null)

  if (articulo === undefined) return null

  if (articulo === null || articulo.eliminadoEn) {
    return (
      <div className="rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/10 px-3 py-2">
        <p className="text-xs text-noct-precaucion">
          La solución vinculada{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
          disponible. Edita el artículo para quitar el vínculo o vincular otra.
        </p>
      </div>
    )
  }

  const total = procedimiento?.pasos.length ?? 0
  const hechos = procedimiento
    ? contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((p) => p.id))
    : 0
  const aMedias = hechos > 0 && hechos < total
  const abierta = mostrarSolucion ?? aMedias

  if (!abierta) {
    return (
      <div className="rounded-lg border border-noct-divider bg-noct-surface px-3 py-2.5">
        <p className="flex items-center gap-2 text-xs font-medium text-noct-neutral-300">
          <Warning size={14} className="text-noct-precaucion" aria-hidden />
          ¿Ocurrió algún error durante este paso?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onContinuar}
            className="rounded-lg border border-noct-exito/60 px-3 py-1.5 text-xs text-noct-exito hover:bg-noct-exito/10"
          >
            No, continuar
          </button>
          <button
            type="button"
            onClick={() => setMostrarSolucion(true)}
            className="rounded-lg border border-noct-precaucion/60 px-3 py-1.5 text-xs text-noct-precaucion hover:bg-noct-precaucion/10"
          >
            Sí, ver la solución
          </button>
        </div>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  if (nivel >= 1 || !procedimientoEjecutable(procedimiento)) {
    return (
      <Link
        to={ruta}
        className="flex items-center justify-between gap-2 rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/10 px-3 py-2"
      >
        <p className="min-w-0 truncate text-xs font-medium text-noct-precaucion">Solución: {articulo.titulo}</p>
        <span className="shrink-0 text-xs text-noct-precaucion underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  async function resuelta() {
    await reiniciarProgreso(solucionArticuloId)
    setMostrarSolucion(null)
    onContinuar()
  }

  return (
    <div className="rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/[.07] p-3">
      <p className="mb-3 min-w-0 truncate text-xs font-medium text-noct-precaucion">
        Solución: {articulo.titulo}
      </p>
      <AsistenteVista
        articuloId={articulo.id}
        procedimiento={procedimiento}
        nivel={nivel + 1}
        onCompletado={() => void resuelta()}
      />
    </div>
  )
}
