import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type BloquePaso, type NivelDificultad, type PasoAdjunto, type Procedimiento } from '../../lib/db'
import { normalizarProcedimiento, pasoTrabajoPrevioCompleto, tareasDe } from '../../lib/procedimiento'
import { alternarVerificacionFinal, contarHechos, contarInstruccionesHechas, reiniciarProgreso } from '../../lib/progresoPasos'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { VisorImagen } from '../../components/VisorImagen'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { TONOS_AVISO } from './tonos'
import { useProcedimientoEjecucion } from './useProcedimientoEjecucion'

const ETIQUETA_DIFICULTAD: Record<NivelDificultad, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

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
// se expande al tocarlo para ver su cuerpo (tareas con casilla, avisos
// e imagenes) y su galeria. Cada paso muestra su estado: pendiente
// (gris), en progreso (ambar, con contador) o completado (verde). Al
// marcar la ultima tarea de un paso, este se completa, se contrae y se
// expande solo el siguiente pendiente, para avanzar sin buscarlo a mano.
export function ProcedimientoVista({ articuloId, procedimiento, nivel = 0, onCompletado }: Props) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const refsPasos = useRef<(HTMLLIElement | null)[]>([])

  const { objetivoGeneral, requisitos, pasos, verificacionFinal, tiempoEstimadoMin, dificultad } = procedimiento
  const idsPasos = useMemo(() => pasos.map((p) => p.id), [pasos])

  const {
    progreso,
    hechos,
    instruccionesHechas,
    completados,
    pasosCompletados,
    verificacionCompleta,
    todoCompletado,
    subSatisfechoReactivo,
    alternarPaso,
    alternarTarea,
    intentarCompletarPaso,
    completarPasoYAvanzar,
  } = useProcedimientoEjecucion({
    articuloId,
    procedimiento,
    nivel,
    onCompletado,
    // La lista avanza expandiendo el siguiente paso pendiente y
    // llevando el scroll hasta el; sin pendientes se contrae todo.
    onAvanzar: (destino) => {
      if (destino === null) {
        setExpandido(null)
        return
      }
      setExpandido(idsPasos[destino])
      refsPasos.current[destino]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  })

  return (
    <section className="flex flex-col gap-3">
      {(objetivoGeneral || tiempoEstimadoMin || dificultad) && (
        <div className="flex flex-col gap-2">
          {objetivoGeneral && <p className="text-sm text-slate-400">{objetivoGeneral}</p>}
          {(tiempoEstimadoMin || dificultad) && (
            <div className="flex flex-wrap gap-2">
              {tiempoEstimadoMin && (
                <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                  ⏱ {tiempoEstimadoMin} min
                </span>
              )}
              {dificultad && (
                <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                  {ETIQUETA_DIFICULTAD[dificultad]}
                </span>
              )}
            </div>
          )}
        </div>
      )}

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
          const idsTareas = tareasDe(paso.bloques).map((t) => t.id)
          const marcadas = contarInstruccionesHechas(progreso?.instruccionesHechas, idsTareas)
          const enProgreso = !hecho && marcadas > 0
          const subSatisfecho = subSatisfechoReactivo(paso)
          const trabajoPrevio = pasoTrabajoPrevioCompleto(idsTareas.length, marcadas, subSatisfecho)
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
                    {enProgreso && idsTareas.length > 0 && (
                      <span className="rounded-full border border-amber-800 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-400">
                        {marcadas}/{idsTareas.length}
                      </span>
                    )}
                    {paso.subArticuloId && <ContadorSubProgreso subArticuloId={paso.subArticuloId} />}
                    <span className="text-xs text-slate-500">{expandido === paso.id ? '▲' : '▼'}</span>
                  </span>
                </button>
              </div>

              {expandido === paso.id && (
                <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3">
                  {paso.objetivo && <p className="text-xs text-slate-400">{paso.objetivo}</p>}

                  {paso.adjuntos.length > 0 && <AdjuntosPaso adjuntos={paso.adjuntos} titulo={paso.titulo} />}

                  {paso.bloques.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {paso.bloques.map((bloque) => (
                        <li key={bloque.id}>
                          <BloqueVista
                            bloque={bloque}
                            marcada={instruccionesHechas.has(bloque.id)}
                            onAlternar={() => void alternarTarea(indice, paso, bloque.id)}
                          />
                        </li>
                      ))}
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
                      onCompletado={() => void intentarCompletarPaso(indice, paso)}
                    />
                  )}

                  {paso.subArticuloId && nivel === 0 && !hecho && !subSatisfecho && (
                    <p className="text-xs text-amber-400/80">
                      Termina el procedimiento vinculado para completar este paso.
                    </p>
                  )}

                  {/* La pregunta de error solo aparece cuando el trabajo
                      previo del paso (tareas y subprocedimiento) ya esta
                      completo: asi el paso no avanza saltandose nada. */}
                  {paso.solucionArticuloId && !hecho && trabajoPrevio && (
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

      {pasosCompletados && verificacionFinal.length > 0 && !verificacionCompleta && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3">
          <h2 className="text-sm font-medium text-amber-200">✅ Verificación final</h2>
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
      )}

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
          🔗 Procedimiento: {articulo.titulo}
        </p>
        <span className="shrink-0 text-xs text-sky-300 underline underline-offset-2">Abrir</span>
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-sky-200">
          🔗 Procedimiento: {articulo.titulo}
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
          🛠 Solución: {articulo.titulo}
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
          🛠 Solución: {articulo.titulo}
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

// Un bloque del cuerpo del paso en la vista de lectura. Segun su tipo:
// una tarea con casilla (la unica que cuenta para completar el paso),
// un aviso con su color e icono, o una imagen intercalada con pie.
// Exportado: lo reutiliza tambien el modo asistente (AsistenteVista).
export function BloqueVista({
  bloque,
  marcada,
  onAlternar,
}: {
  bloque: BloquePaso
  marcada: boolean
  onAlternar: () => void
}) {
  if (bloque.tipo === 'aviso') {
    const tono = TONOS_AVISO.find((t) => t.valor === bloque.tono) ?? TONOS_AVISO[0]
    return (
      <div className={`flex gap-2 rounded-lg border px-3 py-2 ${tono.clases}`}>
        <span aria-hidden className="shrink-0">
          {tono.icono}
        </span>
        <p className="text-sm">{bloque.texto}</p>
      </div>
    )
  }

  if (bloque.tipo === 'imagen') {
    if (!bloque.adjunto) return null
    return (
      <figure className="flex flex-col gap-1">
        <AdjuntoPaso adjunto={bloque.adjunto} titulo={bloque.texto} />
        {bloque.texto && (
          <figcaption className="text-xs text-slate-500">{bloque.texto}</figcaption>
        )}
      </figure>
    )
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={`Tarea: ${bloque.texto}`}
      onClick={onAlternar}
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
        {bloque.texto}
      </span>
    </button>
  )
}

// Adjuntos del paso en la vista de lectura: las imagenes acompañan la
// accion que el tecnico esta ejecutando; los demas archivos (manuales,
// PDF) se abren en una pestaña nueva. Una sola imagen ocupa el ancho
// completo; con varias se acomodan en dos columnas. Exportado: lo
// reutiliza tambien el modo asistente (AsistenteVista).
export function AdjuntosPaso({ adjuntos, titulo }: { adjuntos: PasoAdjunto[]; titulo: string }) {
  const unaSolaImagen = adjuntos.length === 1 && adjuntos[0].tipo.startsWith('image/')

  return (
    <div className={unaSolaImagen ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-2'}>
      {adjuntos.map((adjunto) => (
        <AdjuntoPaso key={adjunto.referencia} adjunto={adjunto} titulo={titulo} />
      ))}
    </div>
  )
}

function AdjuntoPaso({ adjunto, titulo }: { adjunto: PasoAdjunto; titulo: string }) {
  const url = useUrlAdjunto(adjunto.referencia)
  const esImagen = adjunto.tipo.startsWith('image/')
  const [visorAbierto, setVisorAbierto] = useState(false)

  if (!url) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-slate-800 bg-slate-950">
        <p className="px-3 text-center text-xs text-slate-500">
          Adjunto no disponible. Si estás sin conexión, usa "Descargar todo para offline" con señal.
        </p>
      </div>
    )
  }

  if (!esImagen) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-sky-300"
      >
        <span aria-hidden>📄</span>
        <span className="min-w-0 truncate underline underline-offset-2">{adjunto.nombre}</span>
      </a>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setVisorAbierto(true)} className="block">
        <img
          src={url}
          alt={`Adjunto del paso: ${titulo}`}
          className="max-h-72 w-full rounded-lg border border-slate-800 object-contain"
        />
      </button>
      {visorAbierto && (
        <VisorImagen
          url={url}
          alt={`Adjunto del paso: ${titulo}`}
          onCerrar={() => setVisorAbierto(false)}
        />
      )}
    </>
  )
}
