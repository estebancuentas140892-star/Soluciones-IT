import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, type BloquePaso, type PasoAdjunto, type Procedimiento } from '../../lib/db'
import {
  normalizarProcedimiento,
  pasoTrabajoPrevioCompleto,
  procedimientoEjecutable,
  tareasDe,
} from '../../lib/procedimiento'
import { alternarVerificacionFinal, contarHechos, contarInstruccionesHechas, reiniciarProgreso } from '../../lib/progresoPasos'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { VisorImagen } from '../../components/VisorImagen'
import { ArrowSquareOut, CaretRight, Check, CheckCircleFill, Circle, SealCheck } from '../../components/iconos'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { TagNeutral, TituloSeccion } from '../../components/nocturne'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { tonoInfo } from './tonos'
import { useProcedimientoEjecucion } from './useProcedimientoEjecucion'

// Botones pequeños con tono de estado (respuestas Si/No de las
// preguntas de error y decisiones): delineados como todo boton
// Nocturne, en el color del estado que representan.
const BTN_EXITO =
  'cursor-pointer rounded-lg border border-noct-exito/40 px-3 py-1.5 text-xs font-medium text-noct-exito hover:bg-noct-exito/10 active:bg-noct-exito/20'
const BTN_PRECAUCION =
  'cursor-pointer rounded-lg border border-noct-precaucion/40 px-3 py-1.5 text-xs font-medium text-noct-precaucion hover:bg-noct-precaucion/10 active:bg-noct-precaucion/20'

// Panel de aviso reutilizado para vinculos rotos o no disponibles.
const PANEL_PRECAUCION =
  'rounded-lg border border-noct-precaucion/30 bg-noct-precaucion/10 px-3 py-2.5 text-[13px] leading-normal'

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
// `progresoPegajoso` se retiró en la tarea 172: existía solo para que la
// vista previa del editor apagara la barra pegajosa de progreso, y esa
// barra ya no existe (el avance vive junto al título de "Pasos", en
// segmentos). Sin elemento pegajoso no hay nada que apagar.

// Vista de lectura de un procedimiento en el sistema Nocturne (handoff
// "Ficha de Procedimiento.dc.html"): stepper vertical con todos los
// pasos visibles de un vistazo, insignia de paso (completo: tinte del
// acento con check; actual: numero con glow; pendiente: divisor) unida
// por una linea conectora, y el cuerpo de cada paso (tareas con
// casilla, avisos por tono, imagenes, credenciales y vinculos) siempre
// desplegado. El progreso vive en una barra pegajosa arriba (nivel 0)
// para no perderse nunca. Al completar un paso, el scroll avanza solo
// hasta el siguiente pendiente.
export function ProcedimientoVista({
  articuloId,
  procedimiento,
  nivel = 0,
  onCompletado,
}: Props) {
  const refsPasos = useRef<(HTMLLIElement | null)[]>([])

  const { objetivoGeneral, requisitos, pasos, verificacionFinal } = procedimiento

  const {
    progreso,
    hechos,
    instruccionesHechas,
    completados,
    pasosCompletados,
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
    // Sin acordeon que expandir: avanzar es llevar el scroll hasta el
    // siguiente paso pendiente (su insignia ya lo señala como actual).
    onAvanzar: (destino) => {
      if (destino === null) return
      refsPasos.current[destino]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  })

  const progresoPct = pasos.length === 0 ? 0 : Math.round((completados / pasos.length) * 100)
  // La insignia "actual" (numero con glow) es el primer paso sin
  // completar; los siguientes pendientes van con el borde divisor.
  const indiceActual = pasos.findIndex((p) => !hechos.has(p.id))

  // Pasos que el técnico abrió o cerró a mano (tarea 172, decisión 5).
  // Fuera de este mapa manda el estado por defecto: solo el paso actual
  // llega abierto, así que al marcarlo hecho se cierra solo y se abre el
  // siguiente, sin que nadie toque nada.
  const [abiertoPorUsuario, setAbiertoPorUsuario] = useState<Record<string, boolean>>({})
  function alternarAbierto(id: string, estaAbierto: boolean) {
    setAbiertoPorUsuario((previo) => ({ ...previo, [id]: !estaAbierto }))
  }

  return (
    <section className="flex flex-col gap-[22px]">
      {objetivoGeneral && (
        <section>
          <TituloSeccion className="mb-2">Objetivo</TituloSeccion>
          <p className="text-sm leading-[1.55]">{objetivoGeneral}</p>
        </section>
      )}

      {requisitos.length > 0 && (
        <section>
          <TituloSeccion className="mb-2">Antes de empezar</TituloSeccion>
          <div className="flex flex-col gap-2.5 rounded-lg bg-noct-surface p-3.5">
            {requisitos.map((requisito) => (
              <div key={requisito} className="flex items-start gap-2.5">
                <Circle size={14} className="mt-[3px] shrink-0 text-noct-neutral-600" />
                <span className="text-[13.5px] leading-normal">{requisito}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {pasos.length > 0 && (
        <section>
          {/* Decisión 6 de P2: el avance va junto al título de la sección,
              como segmentos (uno por paso), en vez de una barra pegajosa
              aparte. La barra pegajosa era el segundo elemento fijo de la
              pantalla y solo aparecía cuando ya se habían recorrido el
              objetivo y los requisitos; y con la acción dominante ya fija
              abajo (decisión 1), dos elementos fijos sobran. */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <TituloSeccion>Pasos</TituloSeccion>
            <div className="flex shrink-0 items-center gap-2">
              <IndicadorAvance hechos={completados} total={pasos.length} variante="segmentos" />
              <IndicadorAvance hechos={completados} total={pasos.length} variante="texto" />
            </div>
          </div>
          <ol>
            {pasos.map((paso, indice) => {
              const hecho = hechos.has(paso.id)
              const idsTareas = tareasDe(paso.bloques).map((t) => t.id)
              const marcadas = contarInstruccionesHechas(progreso?.instruccionesHechas, idsTareas)
              const subSatisfecho = subSatisfechoReactivo(paso)
              const trabajoPrevio = pasoTrabajoPrevioCompleto(idsTareas.length, marcadas, subSatisfecho)
              const esUltimo = indice === pasos.length - 1
              // Solo el procedimiento principal plega. `abiertoPorUsuario`
              // guarda la elección explícita del técnico y, si no la hay,
              // manda el estado por defecto: abierto si es el paso actual.
              const plegable = nivel === 0
              const abierto = !plegable || (abiertoPorUsuario[paso.id] ?? indice === indiceActual)
              return (
                <li
                  key={paso.id}
                  ref={(elemento) => {
                    refsPasos.current[indice] = elemento
                  }}
                  className="flex gap-3.5"
                >
                  <div className="flex w-7 shrink-0 flex-col items-center">
                    <button
                      type="button"
                      onClick={() => void alternarPaso(indice, paso)}
                      aria-label={
                        hecho ? `Desmarcar paso ${indice + 1}` : `Marcar paso ${indice + 1} como hecho`
                      }
                      className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-[12.5px] font-medium ${
                        hecho
                          ? 'border-noct-accent bg-noct-accent/15 text-noct-accent-300'
                          : indice === indiceActual
                            ? 'border-noct-accent text-noct-accent-300 shadow-[0_0_10px_color-mix(in_srgb,var(--color-noct-accent)_35%,transparent)]'
                            : 'border-noct-divider text-noct-neutral-600'
                      }`}
                    >
                      {hecho ? <Check size={14} /> : indice + 1}
                    </button>
                    {!esUltimo && <div className="my-1.5 w-px flex-1 bg-noct-divider" />}
                  </div>

                  <div
                    className={`min-w-0 flex-1 ${esUltimo ? '' : abierto ? 'pb-[26px]' : 'pb-1.5'}`}
                  >
                    {/* Decisión 5 de P2: plegado salvo el actual. Con 6
                        pasos, avisos, imágenes y credenciales el documento
                        pasaba de 4.000 px, así que para ver el paso 5 había
                        que recorrer los cuatro anteriores enteros. El
                        completado se colapsa a una fila con check y el
                        pendiente a una fila con número (la insignia de la
                        izquierda ya los distingue). Plegar es del
                        procedimiento principal: los niveles anidados llegan
                        abiertos, porque ahí el plegado ya lo hace la
                        tarjeta del vínculo. */}
                    {plegable ? (
                      <button
                        type="button"
                        onClick={() => alternarAbierto(paso.id, abierto)}
                        aria-expanded={abierto}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-noct-accent"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm ${
                              hecho ? 'text-noct-neutral-500' : 'font-medium'
                            } ${abierto ? '' : 'truncate'}`}
                          >
                            {paso.titulo || paso.subArticuloTitulo || `Paso ${indice + 1}`}
                          </span>
                          {paso.objetivo && abierto && (
                            <span className="mt-0.5 block text-[12.5px] text-noct-neutral-500">
                              {paso.objetivo}
                            </span>
                          )}
                        </span>
                        <CaretRight
                          size={13}
                          className={`shrink-0 text-noct-neutral-600 transition-transform ${
                            abierto ? '-rotate-90' : 'rotate-90'
                          }`}
                          aria-hidden
                        />
                      </button>
                    ) : (
                      <div className="mb-3">
                        <p className="text-sm font-medium">
                          {paso.titulo || paso.subArticuloTitulo || `Paso ${indice + 1}`}
                        </p>
                        {paso.objetivo && (
                          <p className="mt-0.5 text-[12.5px] text-noct-neutral-500">{paso.objetivo}</p>
                        )}
                      </div>
                    )}

                    <div className={`flex flex-col gap-2.5 ${plegable ? 'mt-2' : ''} ${abierto ? '' : 'hidden'}`}>
                      {paso.adjuntos.length > 0 && <AdjuntosPaso adjuntos={paso.adjuntos} titulo={paso.titulo} />}

                      {paso.bloques.map((bloque) => (
                        <BloqueVista
                          key={bloque.id}
                          bloque={bloque}
                          marcada={instruccionesHechas.has(bloque.id)}
                          onAlternar={() => void alternarTarea(indice, paso, bloque.id)}
                          nivel={nivel}
                          ejecutarInline={({ articuloId: vinculadoId, procedimiento: vinculado, onCompletado }) => (
                            <ProcedimientoVista
                              articuloId={vinculadoId}
                              procedimiento={vinculado}
                              nivel={nivel + 1}
                              onCompletado={onCompletado}
                            />
                          )}
                        />
                      ))}

                      {paso.vinculoProtegido && <CredencialEnPaso vinculo={paso.vinculoProtegido} />}

                      {paso.subArticuloId && (
                        <SubProcedimientoEnPaso
                          subArticuloId={paso.subArticuloId}
                          tituloReferencia={paso.subArticuloTitulo}
                          nivel={nivel}
                          onCompletado={() => void intentarCompletarPaso(indice, paso)}
                        />
                      )}

                      {paso.subArticuloId && nivel === 0 && !hecho && !subSatisfecho && (
                        <p className="text-xs text-noct-precaucion/85">
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
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {/* Verificacion final: visible desde el principio en el
          procedimiento principal (el diseño la anuncia deshabilitada
          hasta completar los pasos); en los niveles anidados solo
          cuando ya se puede marcar, para no recargar la tarjeta. */}
      {verificacionFinal.length > 0 && (nivel === 0 || pasosCompletados) && !pasosCompletados && (
        // Decisión 8 de P2: mientras no se pueda marcar, la verificación
        // final SE ANUNCIA en una tarjeta neutra que dice cuántas
        // comprobaciones hay y cuándo se abren, en vez de mostrarse
        // apagada. Antes ocupaba una tarjeta con acento desde el primer
        // momento, con sus círculos al 30% de opacidad: un bloque
        // destacado que no se podía usar (R3, ningún control muerto).
        <section className="rounded-lg border border-noct-divider bg-noct-surface px-3.5 py-3">
          <div className="flex items-center gap-2">
            <SealCheck size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
            <h2 className="text-[13.5px] font-medium">
              Al terminar {verificacionFinal.length === 1 ? 'hay 1 comprobación' : `hay ${verificacionFinal.length} comprobaciones`}
            </h2>
          </div>
          <p className="mt-1 text-[12.5px] leading-normal text-noct-neutral-400">
            Se abren cuando marques {pasos.length === 1 ? 'el paso' : `el paso ${pasos.length}`}. Son la prueba de
            que quedó funcionando.
          </p>
        </section>
      )}

      {verificacionFinal.length > 0 && pasosCompletados && (
        <section className="rounded-lg border border-noct-accent/30 bg-noct-accent/[.08] p-3.5">
          <h2 className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-noct-accent-300">
            Verificación final
          </h2>
          <div className="flex flex-col gap-[9px]">
            {verificacionFinal.map((item, indice) => {
              const marcada = (progreso?.verificacionHecha ?? []).includes(indice)
              return (
                <button
                  key={indice}
                  type="button"
                  role="checkbox"
                  aria-checked={marcada}
                  onClick={() => void alternarVerificacionFinal(articuloId, indice)}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-noct-accent"
                >
                  {marcada ? (
                    <CheckCircleFill size={22} className="shrink-0 text-noct-accent" aria-hidden />
                  ) : (
                    <Circle size={22} className="shrink-0 text-noct-accent-400" aria-hidden />
                  )}
                  <span
                    className={`text-[15px] leading-[1.4] ${marcada ? 'text-noct-neutral-500 line-through' : ''}`}
                  >
                    {item}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {todoCompletado && (
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-noct-exito/30 bg-noct-exito/10 px-3.5 py-3">
          <p className="flex min-w-0 items-center gap-2.5 text-[13.5px] font-medium">
            <CheckCircleFill size={16} className="shrink-0 text-noct-exito" aria-hidden />
            Procedimiento completado
          </p>
          <button
            type="button"
            onClick={() => void reiniciarProgreso(articuloId)}
            className={`shrink-0 ${BTN_EXITO}`}
          >
            Reiniciar
          </button>
        </div>
      )}

      {/* En los niveles anidados no hay barra pegajosa: el avance vive
          en una barra compacta al pie de la tarjeta, con su reinicio. */}
      {nivel >= 1 && pasos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-noct-neutral-900">
            <div
              className="h-full rounded-full bg-noct-accent transition-[width] duration-150 ease-out"
              style={{ width: `${progresoPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-noct-neutral-500">
              {completados} de {pasos.length} pasos completados
            </p>
            {completados > 0 && !todoCompletado && (
              <button
                type="button"
                onClick={() => void reiniciarProgreso(articuloId)}
                className="cursor-pointer text-xs text-noct-neutral-400 underline underline-offset-2"
              >
                Reiniciar progreso
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// Avance del subprocedimiento vinculado, visible en la tarjeta de
// vinculo. Desde la tarea 172 lo dibuja `IndicadorAvance` en su variante
// de anillo, la misma pieza que usan la lista de Guías, la barra de
// reanudar y la cabecera de "Pasos": con esto se cierra **CAND-7**, el
// candidato de las tres formas distintas de decir "vas por X de Y".
// Antes era una pastilla "X/Y" propia con tres colores de fondo, que
// además discrepaba del resto (aquí el intermedio era ámbar; en el resto
// de la app, acento).
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

  if (!procedimientoEjecutable(procedimiento)) return null
  const total = procedimiento.pasos.length
  const hechos = contarHechos(
    progreso?.pasosHechos ?? [],
    procedimiento.pasos.map((p) => p.id),
  )

  return <IndicadorAvance hechos={hechos} total={total} size={22} className="shrink-0" />
}

// Encabezado de una tarjeta de vinculo a otra entidad (patron del
// diseño): kicker en mayusculas + titulo truncable.
function EncabezadoVinculo({
  kicker,
  titulo,
  claseKicker,
}: {
  kicker: string
  titulo: string
  claseKicker: string
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className={`block text-[10px] font-medium uppercase tracking-[0.08em] ${claseKicker}`}>
        {kicker}
      </span>
      <span className="block truncate text-[13.5px] font-medium text-noct-text">{titulo}</span>
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
      <div className={PANEL_PRECAUCION}>
        El procedimiento vinculado{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
        disponible. Edita el artículo para quitar el vínculo o vincular otro.
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Mas alla del primer nivel de anidamiento solo se enlaza, sin
  // expandir: evita la expansion infinita y corta cualquier ciclo
  // (A vincula a B y B a A). Tambien cubre el caso de un articulo
  // vinculado que ya no tiene pasos (o nunca los tuvo: K1).
  if (nivel >= 1 || !procedimientoEjecutable(procedimiento)) {
    return (
      <Link
        to={ruta}
        className="flex min-h-11 items-center gap-2.5 rounded-lg border border-noct-accent/35 bg-noct-accent/[.08] px-3 py-[11px] hover:bg-noct-accent/[.14]"
      >
        <ArrowSquareOut size={17} className="shrink-0 text-noct-accent" aria-hidden />
        <EncabezadoVinculo kicker="Continúa en" titulo={articulo.titulo} claseKicker="text-noct-accent" />
        {procedimiento && <ContadorSubProgreso subArticuloId={subArticuloId} />}
        <CaretRight size={14} className="shrink-0 text-noct-accent" aria-hidden />
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-noct-accent/35 bg-noct-accent/[.08]">
      <div className="flex min-h-11 items-center gap-2.5 px-3 py-[11px]">
        <ArrowSquareOut size={17} className="shrink-0 text-noct-accent" aria-hidden />
        <EncabezadoVinculo kicker="Continúa en" titulo={articulo.titulo} claseKicker="text-noct-accent" />
        <ContadorSubProgreso subArticuloId={subArticuloId} />
        <Link to={ruta} className="shrink-0 text-xs font-medium text-noct-accent">
          Abrir
        </Link>
      </div>
      <div className="border-t border-noct-accent/20 p-3">
        <ProcedimientoVista
          articuloId={articulo.id}
          procedimiento={procedimiento}
          nivel={nivel + 1}
          onCompletado={onCompletado}
        />
      </div>
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
      <div className={PANEL_PRECAUCION}>
        La solución vinculada{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
        disponible. Edita el artículo para quitar el vínculo o vincular otra.
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
        <p className="text-[13.5px] font-medium leading-normal">
          ¿Ocurrió algún error durante este paso?
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" onClick={onContinuar} className={BTN_EXITO}>
            No, continuar
          </button>
          <button type="button" onClick={() => setMostrarSolucion(true)} className={BTN_PRECAUCION}>
            Sí, ver la solución
          </button>
        </div>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Dentro de un subprocedimiento ya expandido (o si la solucion se
  // quedo sin pasos, o nunca los tuvo: K1) solo se enlaza: misma regla
  // de un solo nivel que corta ciclos en los subprocedimientos.
  if (nivel >= 1 || !procedimientoEjecutable(procedimiento)) {
    return (
      <Link
        to={ruta}
        className="flex min-h-11 items-center gap-2.5 rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-3 py-[11px] hover:bg-noct-precaucion/[.14]"
      >
        <ArrowSquareOut size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
        <EncabezadoVinculo kicker="Solución" titulo={articulo.titulo} claseKicker="text-noct-precaucion" />
        <CaretRight size={14} className="shrink-0 text-noct-precaucion" aria-hidden />
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
    <div className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08]">
      <div className="flex min-h-11 items-center gap-2.5 px-3 py-[11px]">
        <ArrowSquareOut size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
        <EncabezadoVinculo kicker="Solución" titulo={articulo.titulo} claseKicker="text-noct-precaucion" />
        <Link to={ruta} className="shrink-0 text-xs font-medium text-noct-precaucion">
          Abrir
        </Link>
        <button
          type="button"
          onClick={() => setMostrarSolucion(false)}
          className="shrink-0 cursor-pointer text-xs text-noct-neutral-400 underline underline-offset-2"
        >
          Ocultar
        </button>
      </div>
      <div className="border-t border-noct-precaucion/20 p-3">
        <ProcedimientoVista
          articuloId={articulo.id}
          procedimiento={procedimiento}
          nivel={nivel + 1}
          onCompletado={() => void resuelta()}
        />
      </div>
    </div>
  )
}

// Como ejecutar un articulo vinculado en linea dentro de una tarea de
// decision: la vista de lista anida ProcedimientoVista y el asistente
// anida AsistenteVista. Se recibe como funcion para que DecisionEnTarea
// sirva a ambos sin acoplarse a ninguno.
export type EjecutarArticuloInline = (opciones: {
  articuloId: string
  procedimiento: Procedimiento
  onCompletado: () => void
}) => ReactNode

// Fila de tarea con casilla (accion o verificacion): casilla de 18px
// (marcada: relleno del acento con check en el color del fondo; las
// verificaciones llevan su etiqueta a la derecha) y texto tachado al
// completar. La comparten las tareas normales y las decisiones ya
// respondidas.
function FilaTarea({
  marcada,
  esVerificacion,
  texto,
  onAlternar,
  ariaLabel,
}: {
  marcada: boolean
  esVerificacion?: boolean
  texto: string
  onAlternar: () => void
  ariaLabel: string
}) {
  // Decisión 7 de P2: casilla de 24 px en una fila de 44 y texto a 15 px.
  // Antes eran 18 px de casilla y 14 de texto: es lo que se lee agachado
  // junto a un rack, y lo que se toca con guantes (R6, toque de 44).
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={ariaLabel}
      onClick={onAlternar}
      className="flex min-h-11 w-full cursor-pointer items-start gap-2.5 py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-noct-accent"
    >
      {marcada ? (
        <span
          aria-hidden
          className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-noct-accent"
        >
          <Check size={16} className="text-noct-bg" />
        </span>
      ) : (
        <span
          aria-hidden
          className="mt-px h-6 w-6 shrink-0 rounded-md border-[1.5px] border-noct-neutral-700"
        />
      )}
      <span
        className={`min-w-0 flex-1 self-center text-[15px] leading-[1.4] ${
          marcada ? 'text-noct-neutral-600 line-through' : ''
        }`}
      >
        {texto}
      </span>
      {esVerificacion && <TagNeutral className="shrink-0 self-center">Verificación</TagNeutral>}
    </button>
  )
}

// Un bloque del cuerpo del paso en la vista de lectura. Segun su tipo:
// una tarea con casilla (la unica que cuenta para completar el paso;
// las de tipo decision se responden con Si/No), un aviso con su tono
// Nocturne, o una imagen intercalada con pie. Exportado: lo reutiliza
// tambien el modo asistente (AsistenteVista).
export function BloqueVista({
  bloque,
  marcada,
  onAlternar,
  nivel = 0,
  ejecutarInline,
}: {
  bloque: BloquePaso
  marcada: boolean
  onAlternar: () => void
  nivel?: number
  ejecutarInline?: EjecutarArticuloInline
}) {
  if (bloque.tipo === 'aviso') {
    const tono = tonoInfo(bloque.tono)
    // Decisión 9 de P2: el aviso dice SU PALABRA además del color. Un
    // ámbar no significa nada por sí solo para quien no conoce el
    // sistema, y a pleno sol puede no distinguirse (R16: estado en dos
    // canales, nunca solo color). La palabra ya existía como
    // `etiqueta` en tonos.ts, solo la usaba el editor.
    return (
      <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${tono.clasesPanel}`}>
        <tono.Icono size={16} className={`mt-px shrink-0 ${tono.claseIcono}`} aria-hidden />
        <p className="min-w-0 text-[13px] leading-normal">
          <span className={`font-semibold ${tono.claseIcono}`}>{tono.etiqueta}.</span> {bloque.texto}
        </p>
      </div>
    )
  }

  if (bloque.tipo === 'imagen') {
    if (!bloque.adjunto) return null
    return (
      <figure className="flex flex-col gap-1.5">
        <AdjuntoPaso adjunto={bloque.adjunto} titulo={bloque.texto} />
        {bloque.texto && (
          <figcaption className="text-xs text-noct-neutral-500">{bloque.texto}</figcaption>
        )}
      </figure>
    )
  }

  // El vinculo protegido (tarea 40, generalizado en P2) es independiente
  // del tipo de tarea: se muestra debajo de la casilla o de la
  // pregunta, con el mismo bloque protegido contraido por defecto que
  // ya protege el vinculo de un paso completo.
  const credencialInline = bloque.vinculoProtegido && <CredencialEnPaso vinculo={bloque.vinculoProtegido} />

  if (bloque.tipoTarea === 'decision') {
    return (
      <div className="flex flex-col gap-1.5">
        <DecisionEnTarea
          bloque={bloque}
          marcada={marcada}
          onAlternar={onAlternar}
          nivel={nivel}
          ejecutarInline={ejecutarInline}
        />
        {credencialInline}
      </div>
    )
  }

  const esVerificacion = bloque.tipoTarea === 'verificacion'
  return (
    <div className="flex flex-col gap-1.5">
      <FilaTarea
        marcada={marcada}
        esVerificacion={esVerificacion}
        texto={bloque.texto}
        onAlternar={onAlternar}
        ariaLabel={`${esVerificacion ? 'Verificación' : 'Tarea'}: ${bloque.texto}`}
      />
      {credencialInline}
    </div>
  )
}

// Tarea de decision en la vista de lectura: una pregunta de Si/No.
// "Si" marca la tarea y el flujo continua. "No" despliega en linea la
// solucion o el procedimiento vinculado (si lo hay) y, al completarlo,
// la tarea queda marcada y el tecnico regresa exactamente al punto
// donde iba, con todo su progreso intacto (el avance del procedimiento
// principal se lleva por id de bloque y no se toca). Sin vinculo,
// ambas respuestas marcan la tarea y el flujo sigue.
function DecisionEnTarea({
  bloque,
  marcada,
  onAlternar,
  nivel,
  ejecutarInline,
}: {
  bloque: BloquePaso
  marcada: boolean
  onAlternar: () => void
  nivel: number
  ejecutarInline?: EjecutarArticuloInline
}) {
  const vinculoId = bloque.decisionArticuloId
  const articulo = useLiveQuery(
    async () => (vinculoId ? ((await db.articulos.get(vinculoId)) ?? null) : null),
    [vinculoId],
  )
  const progreso = useLiveQuery(
    () => (vinculoId ? db.progresoPasos.get(vinculoId) : undefined),
    [vinculoId],
  )
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  // null = sin responder: la solucion se muestra abierta solo si quedo
  // a medias (por ejemplo tras salir y volver a mitad de un "No").
  const [mostrarVinculo, setMostrarVinculo] = useState<boolean | null>(null)

  // Ya respondida: se ve como una casilla marcada con la pregunta;
  // tocarla la desmarca para volver a responder.
  if (marcada) {
    return (
      <FilaTarea
        marcada
        texto={bloque.texto}
        onAlternar={onAlternar}
        ariaLabel={`Decisión respondida: ${bloque.texto}`}
      />
    )
  }

  const total = procedimiento?.pasos.length ?? 0
  const hechos = procedimiento
    ? contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((p) => p.id))
    : 0
  const aMedias = hechos > 0 && hechos < total
  const abierta = mostrarVinculo ?? aMedias

  if (!abierta) {
    return (
      <div className="rounded-lg border border-noct-divider bg-noct-surface px-3 py-2.5">
        <p className="text-[13.5px] font-medium leading-normal">{bloque.texto}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" onClick={onAlternar} className={BTN_EXITO}>
            Sí, continuar
          </button>
          <button
            type="button"
            onClick={() => (vinculoId ? setMostrarVinculo(true) : onAlternar())}
            className={BTN_PRECAUCION}
          >
            {vinculoId ? `No, abrir "${bloque.decisionArticuloTitulo || 'la solución'}"` : 'No, continuar'}
          </button>
        </div>
      </div>
    )
  }

  if (articulo === undefined) return null

  if (articulo === null || articulo.eliminadoEn) {
    return (
      <div className={PANEL_PRECAUCION}>
        <p className="m-0">
          El artículo vinculado a esta decisión
          {bloque.decisionArticuloTitulo ? ` "${bloque.decisionArticuloTitulo}"` : ''} ya no está
          disponible. Edita el artículo para quitar el vínculo o vincular otro.
        </p>
        <button type="button" onClick={onAlternar} className={`mt-2.5 ${BTN_EXITO}`}>
          Marcar la decisión y continuar
        </button>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Misma regla de un solo nivel de anidamiento que los
  // subprocedimientos y las soluciones: mas profundo solo se enlaza
  // (corta ciclos), y el tecnico marca la decision al volver.
  if (nivel >= 1 || !procedimientoEjecutable(procedimiento) || !ejecutarInline) {
    return (
      <div className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08] px-3 py-[11px]">
        <div className="flex items-center gap-2.5">
          <ArrowSquareOut size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
          <EncabezadoVinculo kicker="Solución" titulo={articulo.titulo} claseKicker="text-noct-precaucion" />
          <Link to={ruta} className="shrink-0 text-xs font-medium text-noct-precaucion">
            Abrir
          </Link>
        </div>
        <button type="button" onClick={onAlternar} className={`mt-2.5 ${BTN_EXITO}`}>
          Ya quedó resuelto, continuar
        </button>
      </div>
    )
  }

  // El vinculo completado marca la decision, el flujo del
  // procedimiento principal sigue desde este punto exacto y el
  // progreso del vinculado se reinicia para su proximo uso (aqui o en
  // cualquier otro procedimiento que lo reutilice).
  async function resuelta() {
    if (vinculoId) await reiniciarProgreso(vinculoId)
    setMostrarVinculo(null)
    onAlternar()
  }

  return (
    <div className="rounded-lg border border-noct-precaucion/35 bg-noct-precaucion/[.08]">
      <div className="flex min-h-11 items-center gap-2.5 px-3 py-[11px]">
        <ArrowSquareOut size={17} className="shrink-0 text-noct-precaucion" aria-hidden />
        <EncabezadoVinculo kicker="Solución" titulo={articulo.titulo} claseKicker="text-noct-precaucion" />
        <Link to={ruta} className="shrink-0 text-xs font-medium text-noct-precaucion">
          Abrir
        </Link>
        <button
          type="button"
          onClick={() => setMostrarVinculo(false)}
          className="shrink-0 cursor-pointer text-xs text-noct-neutral-400 underline underline-offset-2"
        >
          Ocultar
        </button>
      </div>
      <div className="border-t border-noct-precaucion/20 p-3">
        {ejecutarInline({
          articuloId: articulo.id,
          procedimiento,
          onCompletado: () => void resuelta(),
        })}
      </div>
    </div>
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
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-noct-neutral-700">
        <p className="px-3 text-center text-xs text-noct-neutral-500">
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
        className="flex items-center gap-2.5 rounded-lg border border-noct-divider bg-noct-surface px-3 py-2.5 text-xs font-medium text-noct-accent-400 hover:bg-noct-text/[.04]"
      >
        <ArrowSquareOut size={15} className="shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{adjunto.nombre}</span>
      </a>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setVisorAbierto(true)} className="block w-full cursor-zoom-in">
        <img
          src={url}
          alt={`Adjunto del paso: ${titulo}`}
          className="max-h-72 w-full rounded-lg border border-noct-divider bg-noct-surface object-contain"
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
