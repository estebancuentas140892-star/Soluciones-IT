import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type Procedimiento } from '../../lib/db'
import { normalizarProcedimiento, pasoTrabajoPrevioCompleto, siguientePasoPendiente, tareasDe } from '../../lib/procedimiento'
import { alternarVerificacionFinal, contarHechos, contarInstruccionesHechas, reiniciarProgreso } from '../../lib/progresoPasos'
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

// Modo asistente: en vez del "mapa" completo (ProcedimientoVista), esta
// vista muestra un paso a la vez con su objetivo y su checklist, para
// que el tecnico no se distraiga con el resto del procedimiento. Al
// completar el ultimo bloque pendiente del paso, avanza solo al
// siguiente; con una barra de progreso siempre visible. Reutiliza el
// mismo avance de useProcedimientoEjecucion que la vista de lista, asi
// que entrar y salir del asistente nunca pierde ni duplica progreso.
export function AsistenteVista({ articuloId, procedimiento, nivel, onCompletado }: Props) {
  const { pasos, verificacionFinal } = procedimiento
  const idsPasos = useMemo(() => pasos.map((p) => p.id), [pasos])

  const [indiceActual, setIndiceActual] = useState<number | null>(null)
  const [listo, setListo] = useState(false)

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

  if (!listo) return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>

  // Anidado (subprocedimiento o solucion de un paso de nivel 0): el
  // padre deja de renderizar este componente en cuanto queda
  // satisfecho, asi que aqui no hace falta pantalla de cierre propia.
  if (indiceActual === null && nivel >= 1) return null

  const porcentaje = pasos.length === 0 ? 0 : Math.round((completados / pasos.length) * 100)

  if (indiceActual === null && pasosCompletados && verificacionFinal.length > 0 && !verificacionCompleta) {
    return (
      <div className="flex flex-col gap-4">
        <BarraProgreso porcentaje={porcentaje} completado={false} />
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3">
          <h2 className="text-sm font-medium text-amber-200">Verificación final</h2>
          <p className="mt-0.5 text-xs text-amber-400/80">
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
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                        marcada
                          ? 'border-emerald-700 bg-emerald-500/15 text-emerald-400'
                          : 'border-slate-600 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className={`text-sm ${marcada ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
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
        <BarraProgreso porcentaje={100} completado />
        <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-8 text-center">
          <span aria-hidden className="text-3xl">✓</span>
          <p className="text-base font-medium text-emerald-300">Procedimiento completado</p>
          <button
            type="button"
            onClick={() => void reiniciarProgreso(articuloId)}
            className="mt-2 text-xs text-emerald-400 underline underline-offset-2"
          >
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
  // La pregunta de error ocupa el lugar del boton "Siguiente" mientras
  // no se responda; una vez respondida (o si no hay solucion
  // vinculada), el boton vuelve a decidir el avance.
  const mostrandoPreguntaError = Boolean(paso.solucionArticuloId) && trabajoPrevio

  return (
    <div className="flex flex-col gap-4">
      <BarraProgreso porcentaje={porcentaje} completado={false} />

      <p className="text-xs text-slate-500">
        Paso {indiceActual + 1} de {pasos.length}
      </p>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {paso.titulo || paso.subArticuloTitulo || `Paso ${indiceActual + 1}`}
        </h2>
        {paso.objetivo && <p className="text-sm text-slate-400">{paso.objetivo}</p>}
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
              />
            </li>
          ))}
        </ul>
      )}

      {paso.credencialId && (
        <CredencialEnPaso credencialId={paso.credencialId} tituloReferencia={paso.credencialTitulo} />
      )}

      {paso.subArticuloId && (
        <SubProcedimientoEnAsistente
          subArticuloId={paso.subArticuloId}
          tituloReferencia={paso.subArticuloTitulo}
          nivel={nivel}
          onCompletado={() => void intentarCompletarPaso(indiceActual, paso)}
        />
      )}

      {paso.solucionArticuloId && trabajoPrevio && (
        <SolucionEnAsistente
          solucionArticuloId={paso.solucionArticuloId}
          tituloReferencia={paso.solucionArticuloTitulo}
          nivel={nivel}
          onContinuar={() => void completarPasoYAvanzar(indiceActual, paso)}
        />
      )}

      {!mostrandoPreguntaError && (
        <button
          type="button"
          disabled={!trabajoPrevio}
          onClick={() => void intentarCompletarPaso(indiceActual, paso)}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-30"
        >
          Siguiente
        </button>
      )}
    </div>
  )
}

function BarraProgreso({ porcentaje, completado }: { porcentaje: number; completado: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-all ${completado ? 'bg-emerald-500' : 'bg-sky-500'}`}
        style={{ width: `${porcentaje}%` }}
      />
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
      <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2">
        <p className="text-xs text-amber-300">
          El procedimiento vinculado{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
          disponible. Edita el artículo para quitar el vínculo o vincular otro.
        </p>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Misma regla de un solo nivel que ProcedimientoVista: mas alla se
  // enlaza, sin ejecutar aqui, y evita cualquier ciclo de vinculos.
  if (nivel >= 1 || !procedimiento) {
    return (
      <Link
        to={ruta}
        className="flex items-center justify-between gap-2 rounded-lg border border-sky-900/60 bg-sky-950/20 px-3 py-2"
      >
        <p className="min-w-0 truncate text-xs font-medium text-sky-200">Procedimiento: {articulo.titulo}</p>
        <span className="shrink-0 text-xs text-sky-300 underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-3">
      <p className="mb-3 min-w-0 truncate text-xs font-medium text-sky-200">
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
      <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2">
        <p className="text-xs text-amber-300">
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
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
        <p className="text-xs font-medium text-slate-300">¿Ocurrió algún error durante este paso?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onContinuar}
            className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs text-emerald-300"
          >
            No, continuar
          </button>
          <button
            type="button"
            onClick={() => setMostrarSolucion(true)}
            className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs text-amber-300"
          >
            Sí, ver la solución
          </button>
        </div>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  if (nivel >= 1 || !procedimiento) {
    return (
      <Link
        to={ruta}
        className="flex items-center justify-between gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2"
      >
        <p className="min-w-0 truncate text-xs font-medium text-amber-200">Solución: {articulo.titulo}</p>
        <span className="shrink-0 text-xs text-amber-300 underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  async function resuelta() {
    await reiniciarProgreso(solucionArticuloId)
    setMostrarSolucion(null)
    onContinuar()
  }

  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
      <p className="mb-3 min-w-0 truncate text-xs font-medium text-amber-200">
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
