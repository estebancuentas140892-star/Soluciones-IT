import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type PasoProcedimiento, type Procedimiento } from '../../lib/db'
import { normalizarProcedimiento, siguientePasoPendiente } from '../../lib/procedimiento'
import {
  alternarInstruccionHecha,
  claveInstruccion,
  clavesDeInstrucciones,
  contarHechos,
  contarInstruccionesHechas,
  establecerPasoHecho,
  reiniciarProgreso,
} from '../../lib/progresoPasos'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'

interface Props {
  articuloId: string
  procedimiento: Procedimiento
  // 0 = procedimiento principal; 1 = subprocedimiento o solucion
  // expandidos dentro de un paso. Mas alla del nivel 1 los vinculos
  // se muestran solo como enlace, sin expandirse.
  nivel?: number
  // Aviso hacia arriba cuando una accion completa el ultimo paso
  // pendiente: asi un subprocedimiento o una solucion que terminan
  // completan tambien la tarea del paso que los vincula.
  onCompletado?: () => void
}

// Vista de lectura de un procedimiento: la lista de pasos colapsados
// es el "mapa" del proceso (se ve completo de un vistazo) y cada paso
// se expande al tocarlo para ver sus instrucciones y su captura.
// Cada paso muestra su estado: pendiente (gris), en progreso (ambar,
// con contador) o completado (verde). Al marcar la ultima instruccion
// de un paso, este se completa, se contrae y se expande solo el
// siguiente pendiente, para avanzar sin buscarlo a mano.
export function ProcedimientoVista({ articuloId, procedimiento, nivel = 0, onCompletado }: Props) {
  const progreso = useLiveQuery(() => db.progresoPasos.get(articuloId), [articuloId])
  const [expandido, setExpandido] = useState<string | null>(null)
  const refsPasos = useRef<(HTMLLIElement | null)[]>([])

  const { requisitos, pasos } = procedimiento
  const hechos = new Set(progreso?.pasosHechos ?? [])
  const instruccionesHechas = new Set(progreso?.instruccionesHechas ?? [])
  const completados = contarHechos(progreso?.pasosHechos ?? [], pasos.map((p) => p.id))
  const todoCompletado = pasos.length > 0 && completados === pasos.length

  // Avance automatico despues de completar el paso del indice dado:
  // se contrae y se expande el siguiente pendiente. Si no queda
  // ninguno, el procedimiento termino y se avisa al padre.
  function avanzarDespuesDe(indice: number, hechosNuevos: ReadonlySet<string>) {
    const ids = pasos.map((p) => p.id)
    const destino = siguientePasoPendiente(ids, hechosNuevos, indice)
    if (destino === null) {
      setExpandido(null)
      onCompletado?.()
      return
    }
    setExpandido(ids[destino])
    refsPasos.current[destino]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function alternarPaso(indice: number, paso: PasoProcedimiento) {
    const hecho = hechos.has(paso.id)
    await establecerPasoHecho(
      articuloId,
      paso.id,
      !hecho,
      clavesDeInstrucciones(paso.id, paso.instrucciones.length),
    )
    if (!hecho) avanzarDespuesDe(indice, new Set([...hechos, paso.id]))
  }

  async function alternarInstruccion(indice: number, paso: PasoProcedimiento, i: number) {
    const completo = await alternarInstruccionHecha(articuloId, paso.id, i, paso.instrucciones.length)
    if (completo) avanzarDespuesDe(indice, new Set([...hechos, paso.id]))
  }

  // Completa el paso y sigue de largo: lo usan el subprocedimiento
  // vinculado que termina, la respuesta "No" a la pregunta de error y
  // la solucion que se completa despues de un error.
  async function completarPasoYAvanzar(indice: number, paso: PasoProcedimiento) {
    if (hechos.has(paso.id)) return
    await establecerPasoHecho(
      articuloId,
      paso.id,
      true,
      clavesDeInstrucciones(paso.id, paso.instrucciones.length),
    )
    avanzarDespuesDe(indice, new Set([...hechos, paso.id]))
  }

  return (
    <section className="flex flex-col gap-3">
      {requisitos.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-200">Antes de empezar</h2>
          <ul className="mt-1.5 flex flex-col gap-1">
            {requisitos.map((requisito) => (
              <li key={requisito} className="text-sm text-slate-400">
                • {requisito}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {pasos.map((paso, indice) => {
          const hecho = hechos.has(paso.id)
          const marcadas = contarInstruccionesHechas(
            progreso?.instruccionesHechas,
            paso.id,
            paso.instrucciones.length,
          )
          const enProgreso = !hecho && marcadas > 0
          return (
            <li
              key={paso.id}
              ref={(elemento) => {
                refsPasos.current[indice] = elemento
              }}
              className={`rounded-xl border ${
                expandido === paso.id ? 'border-sky-700' : hecho ? 'border-emerald-900/60' : 'border-slate-800'
              } bg-slate-900`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => void alternarPaso(indice, paso)}
                  aria-label={
                    hecho ? `Desmarcar paso ${indice + 1}` : `Marcar paso ${indice + 1} como hecho`
                  }
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                    hecho
                      ? 'border-emerald-700 bg-emerald-500/15 text-emerald-400'
                      : enProgreso
                        ? 'border-amber-700 bg-amber-500/10 text-amber-400'
                        : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {hecho ? '✓' : indice + 1}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandido(expandido === paso.id ? null : paso.id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                >
                  <span
                    className={`text-sm ${hecho ? 'text-slate-500' : 'text-slate-200'} ${
                      expandido === paso.id ? 'font-medium' : ''
                    }`}
                  >
                    {paso.titulo || paso.subArticuloTitulo || `Paso ${indice + 1}`}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {enProgreso && paso.instrucciones.length > 0 && (
                      <span className="rounded-full border border-amber-800 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-400">
                        {marcadas}/{paso.instrucciones.length}
                      </span>
                    )}
                    {paso.subArticuloId && <ContadorSubProgreso subArticuloId={paso.subArticuloId} />}
                    <span className="text-xs text-slate-500">{expandido === paso.id ? '▲' : '▼'}</span>
                  </span>
                </button>
              </div>

              {expandido === paso.id && (
                <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3">
                  {paso.imagen && <ImagenPaso referencia={paso.imagen} titulo={paso.titulo} />}

                  {paso.instrucciones.length > 0 && (
                    <ul className="flex flex-col gap-0.5">
                      {paso.instrucciones.map((instruccion, i) => {
                        const marcada = instruccionesHechas.has(claveInstruccion(paso.id, i))
                        return (
                          <li key={claveInstruccion(paso.id, i)}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={marcada}
                              aria-label={`Instrucción: ${instruccion}`}
                              onClick={() => void alternarInstruccion(indice, paso, i)}
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
                              <span
                                className={`text-sm ${
                                  marcada ? 'text-slate-500 line-through' : 'text-slate-300'
                                }`}
                              >
                                {instruccion}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {paso.credencialId && (
                    <CredencialEnPaso
                      credencialId={paso.credencialId}
                      tituloReferencia={paso.credencialTitulo}
                    />
                  )}

                  {paso.subArticuloId && (
                    <SubProcedimientoEnPaso
                      subArticuloId={paso.subArticuloId}
                      tituloReferencia={paso.subArticuloTitulo}
                      nivel={nivel}
                      onCompletado={() => void completarPasoYAvanzar(indice, paso)}
                    />
                  )}

                  {paso.solucionArticuloId && !hecho && (
                    <SolucionEnPaso
                      solucionArticuloId={paso.solucionArticuloId}
                      tituloReferencia={paso.solucionArticuloTitulo}
                      nivel={nivel}
                      onContinuar={() => void completarPasoYAvanzar(indice, paso)}
                    />
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {todoCompletado && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3">
          <p className="text-sm font-medium text-emerald-300">✓ Procedimiento completado</p>
          <button
            type="button"
            onClick={() => void reiniciarProgreso(articuloId)}
            className="shrink-0 text-xs text-emerald-400 underline underline-offset-2"
          >
            Reiniciar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${todoCompletado ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${pasos.length === 0 ? 0 : Math.round((completados / pasos.length) * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {completados} de {pasos.length} pasos completados
          </p>
          {completados > 0 && !todoCompletado && (
            <button
              type="button"
              onClick={() => void reiniciarProgreso(articuloId)}
              className="text-xs text-slate-400 underline underline-offset-2"
            >
              Reiniciar progreso
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

// Avance del subprocedimiento vinculado, visible en la fila colapsada
// del paso: el procedimiento principal funciona como lista de tareas
// y de un vistazo se ve cuales van completas (verde), cuales van a
// medias (ambar) y cuales no han empezado (gris).
function ContadorSubProgreso({ subArticuloId }: { subArticuloId: string }) {
  const articulo = useLiveQuery(
    async () => (await db.articulos.get(subArticuloId)) ?? null,
    [subArticuloId],
  )
  const progreso = useLiveQuery(() => db.progresoPasos.get(subArticuloId), [subArticuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )

  if (!procedimiento) return null
  const total = procedimiento.pasos.length
  const hechos = contarHechos(
    progreso?.pasosHechos ?? [],
    procedimiento.pasos.map((p) => p.id),
  )

  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
        hechos === total
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400'
          : hechos > 0
            ? 'border-amber-800 bg-amber-950/40 text-amber-400'
            : 'border-slate-700 bg-slate-800/60 text-slate-400'
      }`}
    >
      {hechos}/{total}
    </span>
  )
}

// Subprocedimiento vinculado a un paso: el paso a paso de otro
// articulo, desplegado dentro del procedimiento principal. El
// progreso usa el id del articulo vinculado, asi que es el mismo se
// abra desde aqui o desde el articulo original. Al completarse avisa
// al paso que lo contiene para que este se complete y avance solo.
function SubProcedimientoEnPaso({
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
  const articulo = useLiveQuery(
    async () => (await db.articulos.get(subArticuloId)) ?? null,
    [subArticuloId],
  )
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

  // Mas alla del primer nivel de anidamiento solo se enlaza, sin
  // expandir: evita la expansion infinita y corta cualquier ciclo
  // (A vincula a B y B a A). Tambien cubre el caso de un articulo
  // vinculado que ya no tiene pasos.
  if (nivel >= 1 || !procedimiento) {
    return (
      <Link
        to={ruta}
        className="flex items-center justify-between gap-2 rounded-lg border border-sky-900/60 bg-sky-950/20 px-3 py-2"
      >
        <p className="min-w-0 truncate text-xs font-medium text-sky-200">
          Procedimiento: {articulo.titulo}
        </p>
        <span className="shrink-0 text-xs text-sky-300 underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-sky-200">
          Procedimiento: {articulo.titulo}
        </p>
        <Link to={ruta} className="shrink-0 text-xs text-sky-300 underline underline-offset-2">
          Abrir
        </Link>
      </div>
      <ProcedimientoVista
        articuloId={articulo.id}
        procedimiento={procedimiento}
        nivel={nivel + 1}
        onCompletado={onCompletado}
      />
    </div>
  )
}

// Pregunta de error del paso, visible solo cuando el editor vinculo
// una solucion. "No" completa el paso y el flujo sigue solo; "Sí"
// despliega la solucion ahi mismo y, al completarla, el paso se
// completa, el avance continua desde ese punto y el progreso de la
// solucion se reinicia para que quede lista para el proximo error
// (aqui o en cualquier otro procedimiento que la reutilice).
function SolucionEnPaso({
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
  const articulo = useLiveQuery(
    async () => (await db.articulos.get(solucionArticuloId)) ?? null,
    [solucionArticuloId],
  )
  const progreso = useLiveQuery(() => db.progresoPasos.get(solucionArticuloId), [solucionArticuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  // null = sin responder: en ese caso la solucion se muestra abierta
  // solo si quedo a medias (por ejemplo tras salir y volver a entrar
  // a mitad de un error).
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

  // Dentro de un subprocedimiento ya expandido (o si la solucion se
  // quedo sin pasos) solo se enlaza: misma regla de un solo nivel que
  // corta ciclos en los subprocedimientos.
  if (nivel >= 1 || !procedimiento) {
    return (
      <Link
        to={ruta}
        className="flex items-center justify-between gap-2 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2"
      >
        <p className="min-w-0 truncate text-xs font-medium text-amber-200">
          Solución: {articulo.titulo}
        </p>
        <span className="shrink-0 text-xs text-amber-300 underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  // La solucion completada vuelve sola al flujo principal: completa
  // el paso donde ocurrio el error, el avance sigue de largo y su
  // progreso se reinicia para el proximo uso.
  async function resuelta() {
    await reiniciarProgreso(solucionArticuloId)
    setMostrarSolucion(null)
    onContinuar()
  }

  return (
    <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-amber-200">
          Solución: {articulo.titulo}
        </p>
        <span className="flex shrink-0 items-center gap-2">
          <Link to={ruta} className="text-xs text-amber-300 underline underline-offset-2">
            Abrir
          </Link>
          <button
            type="button"
            onClick={() => setMostrarSolucion(false)}
            className="text-xs text-slate-400 underline underline-offset-2"
          >
            Ocultar
          </button>
        </span>
      </div>
      <ProcedimientoVista
        articuloId={articulo.id}
        procedimiento={procedimiento}
        nivel={nivel + 1}
        onCompletado={() => void resuelta()}
      />
    </div>
  )
}

function ImagenPaso({ referencia, titulo }: { referencia: string; titulo: string }) {
  const url = useUrlAdjunto(referencia)

  if (!url) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-slate-800 bg-slate-950">
        <p className="px-3 text-center text-xs text-slate-500">
          Captura no disponible. Si estás sin conexión, usa "Descargar todo para offline" con señal.
        </p>
      </div>
    )
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={`Captura del paso: ${titulo}`}
        className="max-h-72 w-full rounded-lg border border-slate-800 object-contain"
      />
    </a>
  )
}
