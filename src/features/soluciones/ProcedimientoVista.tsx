import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, type BloquePaso, type PasoAdjunto, type Procedimiento } from '../../lib/db'
import { normalizarProcedimiento, pasoTrabajoPrevioCompleto, tareasDe } from '../../lib/procedimiento'
import { alternarVerificacionFinal, contarHechos, contarInstruccionesHechas, reiniciarProgreso } from '../../lib/progresoPasos'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { VisorImagen } from '../../components/VisorImagen'
import { ArrowSquareOut, CaretRight, Check, CheckCircleFill, Circle, LinkSimple, SealCheck, Wrench } from '../../components/iconos'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { TagNeutral, TituloSeccion } from '../../components/nocturne'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { EnlaceVinculo, FilaVinculo } from './FilaVinculo'
import { tonoInfo } from './tonos'
import { useProcedimientoEjecucion } from './useProcedimientoEjecucion'
import {
  fraseAvanceDocumento,
  modoVinculo,
  PROMESA_REGRESO,
  ZONA_ANIDADA,
} from './vinculoAnidado'

// Botones con tono de estado (respuestas Sí/No de las contingencias y
// de las decisiones): delineados como todo botón Nocturne, en el color
// del estado que representan.
//
// Medían 28 px de alto con texto de 12: eran el control más pequeño de
// la pantalla de ejecución, y uno de ellos era la única salida cuando
// algo salía mal (tablero 3d). Ahora 44, el mínimo de toque de la regla
// R6, con texto de 14.
const BTN_ESTADO_BASE =
  'inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3.5 text-[14px] font-medium'
const BTN_EXITO =
  `${BTN_ESTADO_BASE} border-noct-exito/50 text-noct-exito hover:bg-noct-exito/10 active:bg-noct-exito/20`
const BTN_PRECAUCION =
  `${BTN_ESTADO_BASE} border-noct-precaucion/50 text-noct-precaucion hover:bg-noct-precaucion/10 active:bg-noct-precaucion/20`
// El verde deja de servir para ELEGIR (regla R60 del turno 12): el
// significado del éxito se invertía de un bloque al de al lado, porque
// en la pregunta de error el verde era "No, no falló nada" y en una
// decisión Sí/No era "Sí, continuar". Ahora el acento marca siempre la
// vía que sigue y el ámbar la que se desvía, igual en los dos sitios.
// El verde queda solo para decir "completado".
const BTN_ACENTO =
  `${BTN_ESTADO_BASE} border-noct-accent/50 text-noct-accent-300 hover:bg-noct-accent/10 active:bg-noct-accent/20`

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
  // Paso que hay que abrir y traer a la vista al montar. Lo usa
  // "Probar" del editor (tablero 6b) para enseñar el paso que se acaba
  // de escribir sin obligar a recorrer el artículo entero.
  pasoDestacadoId?: string | null
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
  pasoDestacadoId = null,
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

  // La insignia "actual" (numero con glow) es el primer paso sin
  // completar; los siguientes pendientes van con el borde divisor.
  const indiceActual = pasos.findIndex((p) => !hechos.has(p.id))

  // Pasos que el técnico abrió o cerró a mano (tarea 172, decisión 5).
  // Fuera de este mapa manda el estado por defecto: solo el paso actual
  // llega abierto, así que al marcarlo hecho se cierra solo y se abre el
  // siguiente, sin que nadie toque nada.
  // El paso destacado entra abierto aunque no sea el actual: es el que
  // se ha pedido ver.
  const [abiertoPorUsuario, setAbiertoPorUsuario] = useState<Record<string, boolean>>(() =>
    pasoDestacadoId ? { [pasoDestacadoId]: true } : {},
  )

  useEffect(() => {
    if (!pasoDestacadoId) return
    const destino = pasos.findIndex((p) => p.id === pasoDestacadoId)
    if (destino < 0) return
    refsPasos.current[destino]?.scrollIntoView({ block: 'center' })
  }, [pasoDestacadoId, pasos])

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
          {/* En el documento anidado esta cabecera SOBRA (regla R57 del
              turno 12): la fila que lo abre ya trae su anillo de avance
              y la frase "Paso 1 de 3 de esta guía" justo encima, así que
              repetir aquí "Pasos · 0 de 3" es el mismo dato dos veces
              con dos formas distintas, y a 13 px de sangría se leía como
              si fuera del procedimiento principal. */}
          {nivel === 0 && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <TituloSeccion>Pasos</TituloSeccion>
              <div className="flex shrink-0 items-center gap-2">
                <IndicadorAvance hechos={completados} total={pasos.length} variante="segmentos" />
                <IndicadorAvance hechos={completados} total={pasos.length} variante="texto" />
              </div>
            </div>
          )}
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

                      {/* LO QUE CUELGA DEL PASO, en filas y sin marcos
                          de color (M-012, regla M-R11, tableros `3b` y
                          `12b`). El dato protegido, la guía anidada y la
                          contingencia traían cada uno su propia tarjeta
                          con borde y fondo: acento los dos primeros,
                          ámbar la tercera. Sumados al aviso y a la
                          pregunta de error, un paso llegaba a mostrar
                          cinco marcos anidados, dos de ellos del mismo
                          tono con significados distintos, y la
                          advertencia real dejaba de destacar.

                          Ahora son tres filas de 44 px con icono neutro,
                          y lo que se despliega de cada una va sangrado
                          tras una línea vertical neutra. */}
                      {(paso.vinculoProtegido || paso.subArticuloId || paso.solucionArticuloId) && (
                        <div className="flex flex-col">
                          {paso.vinculoProtegido && <CredencialEnPaso vinculo={paso.vinculoProtegido} />}

                          {paso.subArticuloId && (
                            <SubProcedimientoEnPaso
                              subArticuloId={paso.subArticuloId}
                              tituloReferencia={paso.subArticuloTitulo}
                              nivel={nivel}
                              onCompletado={() => void intentarCompletarPaso(indice, paso)}
                            />
                          )}

                          {/* El aviso de dependencia dice qué hacer, no
                              qué regla se está incumpliendo, y va en
                              neutro: no advierte de ningún riesgo. */}
                          {paso.subArticuloId && nivel === 0 && !hecho && !subSatisfecho && (
                            <p className="pb-1 text-[12px] leading-normal text-noct-neutral-500">
                              Este paso se completa al terminar la guía de arriba.
                            </p>
                          )}

                          {/* La contingencia deja de esconderse (tablero
                              3d) y deja de preguntar (regla R59 del turno
                              12): no se pregunta lo que se puede deducir.
                              "No, continuar" era completar el paso, que es
                              lo que ya hace la insignia del paso, así que
                              la pregunta con dos botones saturados se
                              queda en una fila más: la salida por si algo
                              falla, disponible siempre. */}
                          {paso.solucionArticuloId && !hecho && (
                            <ContingenciaEnPaso
                              solucionArticuloId={paso.solucionArticuloId}
                              tituloReferencia={paso.solucionArticuloTitulo}
                              nivel={nivel}
                              onResuelta={() => {
                                if (trabajoPrevio) void completarPasoYAvanzar(indice, paso)
                              }}
                            />
                          )}
                        </div>
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
                    className={`text-[15px] leading-[1.4] ${marcada ? 'text-noct-neutral-400' : ''}`}
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

      {/* UN INDICADOR DE AVANCE POR DOCUMENTO (regla R57 del turno 12).
          El nivel anidado traía aquí su propia barra de acento con su
          "N de M pasos completados" y un enlace "Reiniciar progreso"
          subrayado de 12 px. Eran dos barras de acento anidadas midiendo
          cosas distintas (los pasos del principal y los del vinculado) y
          la tercera forma del mismo dato. Ahora el avance del documento
          anidado lo dice UNA sola vez la fila que lo abre: el anillo de
          `IndicadorAvance` más "Paso 1 de 3 de esta guía", que además
          nombra a qué documento pertenece.

          De paso se cierra la duplicación de "Reiniciar" (regla R61): la
          misma acción se dibujaba como botón de contorno en el panel de
          completado y como enlace subrayado aquí. Queda solo el botón, y
          el reinicio del documento anidado vive donde vive el documento,
          en su propia ficha. */}
    </section>
  )
}

// Subprocedimiento vinculado a un paso: el paso a paso de otra guía,
// desplegado dentro del procedimiento principal. El progreso usa el id
// del articulo vinculado, asi que es el mismo se abra desde aqui o
// desde la guía original. Al completarse avisa al paso que lo contiene
// para que este se complete y avance solo.
//
// Antes era una TARJETA CON MARCO DE ACENTO, el mismo marco que traía
// el dato protegido del paso (M-012). Ahora es una fila neutra que se
// pliega: el tipo de vínculo lo dicen el icono y el rótulo, no el color.
//
// El rótulo cambió de "Continúa en" a "Otra guía" (turno 12): "continúa
// en" sugiere que el procedimiento termina y sigue en otra parte,
// cuando en realidad se despliega aquí y vuelve.
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
  const progreso = useLiveQuery(() => db.progresoPasos.get(subArticuloId), [subArticuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  // La guía anidada llega ABIERTA: el paso no se completa hasta que ella
  // termine, así que esconderla sería esconder el trabajo. Lo que cambia
  // es que ahora se puede cerrar, con el mismo gesto con el que se
  // cierra la contingencia (antes una tenía "Ocultar" y la otra no, sin
  // razón visible).
  const [cerrado, setCerrado] = useState(false)

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
  const total = procedimiento?.pasos.length ?? 0
  const hechos = procedimiento
    ? contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((paso) => paso.id))
    : 0
  const anillo =
    total > 0 ? <IndicadorAvance hechos={hechos} total={total} size={22} className="shrink-0" /> : undefined

  // Mas alla del primer nivel de anidamiento solo se enlaza: evita la
  // expansion infinita y corta cualquier ciclo (A vincula a B y B a A).
  // Tambien cubre el caso de una guía vinculada que ya no tiene pasos (o
  // nunca los tuvo: K1). Y ahora SE NOTA que solo enlaza (regla R58).
  if (procedimiento === null || modoVinculo(nivel, procedimiento) === 'enlazado') {
    return (
      <EnlaceVinculo
        Icono={LinkSimple}
        kicker="Otra guía"
        titulo={articulo.titulo}
        nota={PROMESA_REGRESO}
        extra={anillo}
        to={ruta}
      />
    )
  }

  const abierto = !cerrado

  return (
    <div>
      <FilaVinculo
        Icono={LinkSimple}
        kicker="Otra guía"
        titulo={articulo.titulo}
        nota={fraseAvanceDocumento(hechos, total, 'guía')}
        extra={anillo}
        abierto={abierto}
        onAlternar={() => setCerrado((valor) => !valor)}
      />
      {abierto && (
        <div className={`my-1 ${ZONA_ANIDADA}`}>
          <ProcedimientoVista
            articuloId={articulo.id}
            procedimiento={procedimiento}
            nivel={nivel + 1}
            onCompletado={onCompletado}
          />
          <Link
            to={ruta}
            className="mt-2 inline-flex min-h-11 items-center text-[12.5px] font-medium text-noct-accent-300"
          >
            Abrir esta guía aparte
          </Link>
        </div>
      )}
    </div>
  )
}

// La contingencia del paso: qué hacer si esto falla. Se despliega ahi
// mismo y, al completarla, el paso se completa (si no le quedaba trabajo
// pendiente), el avance continua desde ese punto y el progreso de la
// contingencia se reinicia para el proximo error, aqui o en cualquier
// otro procedimiento que la reutilice.
//
// ANTES ERA UNA PREGUNTA: "¿Ocurrió algún error durante este paso?" en
// un panel con dos botones saturados, verde "No, continuar" y ámbar
// "Sí, ver la contingencia". Tres problemas de un golpe: el verde
// significaba "No" aquí y "Sí" en el bloque de decisión de al lado
// (R60); la pregunta casi siempre se responde "No" y responder "No" era
// solo seguir, que es lo que ya hace la insignia del paso (R59); y el
// ámbar del panel competía con el ámbar del aviso, que es el único que
// advierte de un riesgo real (M-012). Queda una fila más entre los
// vínculos del paso, disponible siempre.
function ContingenciaEnPaso({
  solucionArticuloId,
  tituloReferencia,
  nivel,
  onResuelta,
}: {
  solucionArticuloId: string
  tituloReferencia: string
  nivel: number
  onResuelta: () => void
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
  // null = sin tocar: en ese caso la contingencia se muestra abierta solo
  // si quedo a medias (por ejemplo tras salir y volver a entrar a mitad
  // de un error).
  const [mostrar, setMostrar] = useState<boolean | null>(null)

  if (articulo === undefined) return null

  if (articulo === null || articulo.eliminadoEn) {
    return (
      <div className={PANEL_PRECAUCION}>
        La contingencia vinculada{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
        disponible. Edita el artículo para quitar el vínculo o vincular otra.
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`
  const total = procedimiento?.pasos.length ?? 0
  const hechos = procedimiento
    ? contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((paso) => paso.id))
    : 0
  const aMedias = hechos > 0 && hechos < total
  const abierta = mostrar ?? aMedias

  // Dentro de un subprocedimiento ya expandido (o si la contingencia se
  // quedo sin pasos, o nunca los tuvo: K1) solo se enlaza: misma regla
  // de un solo nivel que corta ciclos en los subprocedimientos.
  if (procedimiento === null || modoVinculo(nivel, procedimiento) === 'enlazado') {
    return (
      <EnlaceVinculo
        Icono={Wrench}
        kicker="Si esto falla"
        titulo={articulo.titulo}
        nota={PROMESA_REGRESO}
        to={ruta}
      />
    )
  }

  // La contingencia completada devuelve el control al paso donde ocurrio
  // el error y su progreso se reinicia para el proximo uso.
  async function resuelta() {
    await reiniciarProgreso(solucionArticuloId)
    setMostrar(null)
    onResuelta()
  }

  return (
    <div>
      <FilaVinculo
        Icono={Wrench}
        kicker="Si esto falla"
        titulo={articulo.titulo}
        nota={abierta ? fraseAvanceDocumento(hechos, total, 'contingencia') : null}
        extra={
          abierta && total > 0 ? (
            <IndicadorAvance hechos={hechos} total={total} size={22} className="shrink-0" />
          ) : undefined
        }
        abierto={abierta}
        onAlternar={() => setMostrar(!abierta)}
      />
      {abierta && (
        <div className={`my-1 ${ZONA_ANIDADA}`}>
          <ProcedimientoVista
            articuloId={articulo.id}
            procedimiento={procedimiento}
            nivel={nivel + 1}
            onCompletado={() => void resuelta()}
          />
          <Link
            to={ruta}
            className="mt-2 inline-flex min-h-11 items-center text-[12.5px] font-medium text-noct-accent-300"
          >
            Abrir esta contingencia aparte
          </Link>
        </div>
      )}
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

// Fila de tarea con casilla (acción o verificación): casilla rellena
// del acento con el check en el color del fondo cuando está marcada, y
// la etiqueta a la derecha en las verificaciones. La comparten las
// tareas normales y las decisiones ya respondidas, y la usan las dos
// vistas del procedimiento (lectura y asistente).
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
  // Casilla de 28 px en una fila de 56 y texto de 16 (tablero 3d).
  // Venían de 24 en 44 con texto de 15 (decisión 7 de P2), y antes de
  // eso de 18 con texto de 14. Es lo que se toca con guantes y lo que se
  // lee agachado junto a un rack.
  //
  // El estado hecho NO va tachado: a 16 px, a pleno sol y con el
  // teléfono apoyado en el rack, la línea del tachado no se distingue y
  // solo emborrona el texto. Lo dicen la casilla en acento y el texto
  // atenuado, que además sube de `neutral-600` (4.0:1 sobre el fondo,
  // por debajo del 4.5 que pide AA, regla R2) a `neutral-400` (8.9:1).
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={ariaLabel}
      onClick={onAlternar}
      className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 py-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-noct-accent"
    >
      {marcada ? (
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-noct-accent"
        >
          <Check size={18} className="text-noct-bg" />
        </span>
      ) : (
        <span aria-hidden className="h-7 w-7 shrink-0 rounded-lg border-[1.5px] border-noct-neutral-700" />
      )}
      <span className={`min-w-0 flex-1 text-[16px] leading-[1.35] ${marcada ? 'text-noct-neutral-400' : ''}`}>
        {texto}
      </span>
      {esVerificacion && <TagNeutral className="shrink-0">Verificación</TagNeutral>}
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
      // Barra lateral en vez de marco completo (M-012, regla M-R11,
      // tablero `3b`), el mismo dibujo que ya usa el modo foco. El aviso
      // es LO ÚNICO del cuerpo de un paso que conserva color de fondo,
      // ahora que los vínculos son filas neutras: cuando había cinco
      // marcos por paso, la advertencia real era uno más entre ellos.
      <div
        className={`flex items-start gap-2.5 rounded-r-lg border-l-2 px-3 py-2.5 ${tono.claseBarra} ${tono.claseFondo}`}
      >
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
  // El dato protegido de una TAREA cuelga de esa tarea, así que va
  // sangrado tras la línea, igual que lo que cuelga de un paso.
  const credencialInline = bloque.vinculoProtegido && (
    <div className={ZONA_ANIDADA}>
      <CredencialEnPaso vinculo={bloque.vinculoProtegido} />
    </div>
  )

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
          {/* Acento la vía que sigue, ámbar la que se desvía (R60). El
              verde se retira: significaba "Sí" aquí y "No" en la
              pregunta de error de al lado. */}
          <button type="button" onClick={onAlternar} className={BTN_ACENTO}>
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
        <button type="button" onClick={onAlternar} className={`mt-2.5 ${BTN_ACENTO}`}>
          Marcar la decisión y continuar
        </button>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Misma regla de un solo nivel de anidamiento que los
  // subprocedimientos y las soluciones: mas profundo solo se enlaza
  // (corta ciclos), y el tecnico marca la decision al volver.
  if (procedimiento === null || modoVinculo(nivel, procedimiento) === 'enlazado' || !ejecutarInline) {
    return (
      <div className="rounded-lg border border-noct-divider bg-noct-surface px-3 py-2.5">
        <EnlaceVinculo
          Icono={Wrench}
          kicker="Si esto falla"
          titulo={articulo.titulo}
          nota={PROMESA_REGRESO}
          to={ruta}
        />
        <button type="button" onClick={onAlternar} className={`mt-1.5 ${BTN_ACENTO}`}>
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
    <div>
      <FilaVinculo
        Icono={Wrench}
        kicker="Si esto falla"
        titulo={articulo.titulo}
        nota={fraseAvanceDocumento(hechos, total, 'contingencia')}
        extra={
          total > 0 ? (
            <IndicadorAvance hechos={hechos} total={total} size={22} className="shrink-0" />
          ) : undefined
        }
        abierto
        onAlternar={() => setMostrarVinculo(false)}
      />
      <div className={`my-1 ${ZONA_ANIDADA}`}>
        {ejecutarInline({
          articuloId: articulo.id,
          procedimiento,
          onCompletado: () => void resuelta(),
        })}
        <Link
          to={ruta}
          className="mt-2 inline-flex min-h-11 items-center text-[12.5px] font-medium text-noct-accent-300"
        >
          Abrir esta contingencia aparte
        </Link>
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
