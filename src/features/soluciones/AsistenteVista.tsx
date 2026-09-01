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
import { BandaTarea } from '../../app/bandaTarea'
import { Adjuntos } from '../../components/Adjuntos'
import { Camera, CaretDown, CaretLeft, CaretRight, Check, ClockCounterClockwise, Crosshair, LinkSimple, SealCheck, Warning, Wrench } from '../../components/iconos'
import { BTN_GHOST_ACENTO, BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
import { useProcedimientoEjecucion } from './useProcedimientoEjecucion'
import { HojaPasos } from './HojaPasos'
import { ModoFoco } from './ModoFoco'
import { minutosRestantes, resumenDeAvance, resumirPasos, type ResumenPaso } from './estadoPasos'

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
  // Índice de los pasos (tablero 6c): se abre tocando el contador.
  const [indiceAbierto, setIndiceAbierto] = useState(false)
  // Modo foco (tablero 6d): una tarea a la vez. Es un modo, no un
  // reemplazo, así que se entra y se sale a voluntad.
  const [enFoco, setEnFoco] = useState(false)
  // Tarea en la que el técnico declaró que algo falló, para dejar el
  // aviso puesto al volver a la vista completa del paso.
  const [tareaFallida, setTareaFallida] = useState<string | null>(null)

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

  const tituloPaso = paso.titulo || paso.subArticuloTitulo || `Paso ${indiceActual + 1}`

  // Etiqueta de la acción dominante (M-R3: una acción fija abajo que
  // dice qué va a pasar) y, cuando no se puede avanzar, la razón escrita
  // encima. Antes el botón se apagaba al 30 % de opacidad sin decir por
  // qué, al final del scroll del paso.
  const faltanTareas = Math.max(0, idsTareas.length - marcadas)
  const motivoBloqueo =
    pasoActualHecho || trabajoPrevio
      ? null
      : faltanTareas > 0
        ? `Falta ${faltanTareas} ${faltanTareas === 1 ? 'tarea' : 'tareas'} de este paso para poder avanzar`
        : 'Termina el procedimiento vinculado para poder avanzar'
  const hayPasoSiguiente = indiceActual + 1 < pasos.length
  const etiquetaAvance = pasoActualHecho
    ? hayPasoSiguiente
      ? `Ir al paso ${indiceActual + 2}`
      : 'Continuar'
    : hayPasoSiguiente
      ? `Paso hecho · ir al ${indiceActual + 2}`
      : 'Paso hecho · terminar'

  // Estado de cada paso para el índice (tablero 6c). Se recalcula en
  // cada render a propósito: son unas pocas decenas de pasos como mucho,
  // y memorizarlo exigiría estabilizar dos Sets que el hook rehace en
  // cada lectura del progreso.
  const resumenes: ResumenPaso[] = resumirPasos(pasos, hechos, instruccionesHechas, indiceActual)
  const subtituloIndice = resumenDeAvance(resumenes, minutosRestantes(tiempoEstimadoMin, resumenes))

  // MODO FOCO (tablero 6d): sustituye el cuerpo del paso, no lo
  // acompaña. La `key` es el id del paso, así que al completarlo el
  // foco se remonta ya puesto en la primera tarea del siguiente.
  //
  // La barra de tarea del chasis se queda (dice qué se está haciendo y
  // a dónde se vuelve, regla R19); lo que no se monta es la banda del
  // paso, porque el foco trae su propia cabecera mínima.
  if (enFoco && nivel === 0 && idsTareas.length > 0) {
    return (
      <ModoFoco
        key={paso.id}
        paso={paso}
        indicePaso={indiceActual}
        totalPasos={pasos.length}
        tituloPaso={tituloPaso}
        instruccionesHechas={instruccionesHechas}
        onAlternarTarea={(tareaId) => void alternarTarea(indiceActual, paso, tareaId)}
        onSalir={() => setEnFoco(false)}
        onFalla={(texto) => {
          setTareaFallida(texto)
          setEnFoco(false)
        }}
      />
    )
  }

  return (
    <div className={`flex flex-col gap-4 ${nivel === 0 ? 'flex-1' : ''}`}>
      {nivel === 0 && (
        <HojaPasos
          abierto={indiceAbierto}
          onCerrar={() => setIndiceAbierto(false)}
          resumenes={resumenes}
          subtitulo={subtituloIndice}
          onIrAPaso={setIndiceActual}
        />
      )}
      {/* Ancla del paso (M-010, mockup `3b`): 44 px pegajosos dentro del
          mismo bloque de la barra de tarea. El modo ejecución era la
          única pantalla de la app sin nada fijo: el progreso, el "Paso 3
          de 7" y el título se iban con el scroll, así que al volver de
          una interrupción (el escenario declarado del encargo) la
          pantalla no decía ni en qué paso estaba ni qué llevaba marcado.
          Los pasos anidados no la montan: su avance lo decide el paso
          que los contiene. */}
      {nivel === 0 ? (
        <BandaTarea>
          <CabeceraPaso
            indice={indiceActual}
            total={pasos.length}
            titulo={tituloPaso}
            tareasHechas={marcadas}
            tareasTotal={idsTareas.length}
            completados={completados}
            onAbrirIndice={() => setIndiceAbierto(true)}
          />
        </BandaTarea>
      ) : (
        <Encabezado
          porcentaje={porcentaje}
          completado={false}
          cronometro={cronometro}
          estimado={tiempoEstimadoMin}
          contador={`Paso ${indiceActual + 1} de ${pasos.length}`}
        />
      )}

      <div className="flex flex-col gap-1">
        {nivel >= 1 && <h2 className="text-lg font-semibold text-noct-text">{tituloPaso}</h2>}
        {paso.objetivo && <p className="text-sm text-noct-neutral-400">{paso.objetivo}</p>}
        {cronometro && (
          <p className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-noct-neutral-500">
            <ClockCounterClockwise size={13} aria-hidden />
            {cronometro}
            {tiempoEstimadoMin ? <span className="text-noct-neutral-600">/ ~{tiempoEstimadoMin} min</span> : null}
          </p>
        )}
      </div>

      {/* Lo que el técnico declaró desde el modo foco (tablero 6d). No
          toca el progreso ni completa nada: solo deja dicho qué falló y
          pone a mano la solución del paso, si la tiene. */}
      {tareaFallida && nivel === 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-noct-precaucion/45 bg-noct-precaucion/[.12] px-4 py-3">
          <p className="flex items-start gap-2.5 text-[13.5px] leading-snug">
            <Warning size={17} className="mt-px shrink-0 text-noct-precaucion" aria-hidden />
            <span className="min-w-0">
              <span className="font-semibold text-noct-precaucion">Marcaste una falla</span> en
              «{tareaFallida}». Aquí tienes el paso completo: sus avisos, sus fotos y sus archivos.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {paso.solucionArticuloId && (
              <SolucionDelPasoEnlace
                solucionArticuloId={paso.solucionArticuloId}
                tituloReferencia={paso.solucionArticuloTitulo}
              />
            )}
            <button
              type="button"
              onClick={() => setTareaFallida(null)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] font-medium text-noct-neutral-300 hover:bg-noct-text/[.08]"
            >
              Quitar el aviso
            </button>
          </div>
        </div>
      )}

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

      {/* Acción dominante fija al pie (M-011, regla M-R3, mockup `3b`).
          Hasta ahora "Atrás / Siguiente" vivían al final del scroll del
          paso, mientras la ficha de artículo sí fijaba su acción abajo
          (tarea 172): la contradicción se pagaba justo en la pantalla
          donde el pulgar trabaja de verdad, porque avanzar exigía
          recorrer el paso entero con una mano. Aquí se aplica el patrón
          ya aprobado: 52 px, "Atrás" reducido a icono de 44 a su
          izquierda (M-R14 pide 8 px entre objetivos vecinos) y la razón
          escrita encima cuando el avance está bloqueado.

          Es `sticky`, no `fixed`: así reserva su propio hueco en el
          flujo y no tapa el final del paso.

          Los pasos anidados conservan su botón único en línea: su avance
          lo decide el paso que los contiene, y dos acciones dominantes
          en la misma pantalla dejarían de ser dominantes. */}
      {!mostrandoPreguntaError && nivel === 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.96] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[12px]">
          {motivoBloqueo && (
            <p className="mb-1.5 text-center text-[11.5px] text-noct-neutral-400">{motivoBloqueo}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={indiceActual === 0}
              onClick={() => setIndiceActual(Math.max(0, indiceActual - 1))}
              aria-label="Volver al paso anterior"
              className="flex h-[52px] w-11 shrink-0 items-center justify-center rounded-xl border border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.07] disabled:opacity-30"
            >
              <CaretLeft size={18} aria-hidden />
            </button>
            {/* Entrada al modo foco (tablero 6d). Solo si el paso tiene
                tareas: sin ellas el foco no tendría nada que enfocar. */}
            {idsTareas.length > 0 && (
              <button
                type="button"
                onClick={() => setEnFoco(true)}
                className="flex h-[52px] shrink-0 items-center gap-1.5 rounded-xl border-[1.5px] border-noct-accent/50 bg-noct-accent/10 px-3 text-[14.5px] font-medium text-noct-accent-300 hover:bg-noct-accent/[.22]"
              >
                <Crosshair size={18} className="shrink-0" aria-hidden />
                Foco
              </button>
            )}
            <button
              type="button"
              disabled={!pasoActualHecho && !trabajoPrevio}
              onClick={avanzar}
              className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-noct-accent bg-noct-accent/[.12] px-3 text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.18] active:bg-noct-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent disabled:opacity-30"
            >
              <Check size={17} className="shrink-0" aria-hidden />
              <span className="truncate">{etiquetaAvance}</span>
            </button>
          </div>
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

// Ancla del paso en ejecución (M-010, mockup `3b`): 44 px de alto con
// "Paso 3 de 7", el título truncado y las tareas marcadas de este paso,
// más una barra de progreso de 3 px del procedimiento completo. Vive
// dentro del bloque pegajoso de la barra de tarea (ver
// src/app/bandaTarea.tsx), así que no se va con el scroll.
//
// El contador de la derecha cuenta las tareas DEL PASO (2/4), no los
// pasos: los pasos ya los dice la izquierda, y lo que se pierde al
// desplazarse dentro de un paso largo es cuánto llevas marcado de él.
function CabeceraPaso({
  indice,
  total,
  titulo,
  tareasHechas,
  tareasTotal,
  completados,
  onAbrirIndice,
}: {
  indice: number
  total: number
  titulo: string
  tareasHechas: number
  tareasTotal: number
  completados: number
  onAbrirIndice: () => void
}) {
  return (
    <div className="border-t border-noct-divider px-4">
      {/* El contador deja de ser un rótulo y pasa a ser un DESTINO
          (tablero 6c): abre el índice con el estado real de los siete
          pasos. Toda la banda es el objetivo, 56 px de alto, porque el
          "3/7" solo mide 30 y es lo que el dedo busca. */}
      <button
        type="button"
        onClick={onAbrirIndice}
        aria-haspopup="dialog"
        aria-label={`Paso ${indice + 1} de ${total}: ${titulo}. Abrir el índice de pasos`}
        className="flex min-h-[56px] w-full items-center gap-2.5 pb-1.5 pt-1 text-left"
      >
        <span className="flex shrink-0 items-center gap-1 font-mono text-[17px] font-semibold text-noct-accent-300">
          {indice + 1}
          <span className="text-[13px] font-normal text-noct-neutral-400">/{total}</span>
          <CaretDown size={13} className="text-noct-neutral-400" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-normal text-noct-neutral-200">{titulo}</h2>
        {tareasTotal > 0 && (
          <span className="shrink-0 font-mono text-[14px] tabular-nums text-noct-text">
            {tareasHechas}/{tareasTotal}
            <span className="sr-only"> tareas de este paso marcadas</span>
          </span>
        )}
      </button>
      {/* Segmentos, uno por paso, en vez de la barra continua de
          porcentaje: dicen cuántos pasos hay y cuál es el que sigue,
          que es lo que el técnico pregunta. */}
      <IndicadorAvance
        hechos={completados}
        total={total}
        variante="segmentos"
        expandido
        actual={indice}
        className="-mb-px"
      />
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

// Enlace directo a la solución vinculada del paso, para el aviso de
// "algo falló" que deja el modo foco (tablero 6d). Es un ENLACE, no la
// pregunta de error: esa completa el paso al resolverse, y aquí el paso
// puede tener tareas sin marcar, así que darlo por hecho se saltaría
// trabajo. Abrir la guía es lo que el técnico necesita y no toca nada.
function SolucionDelPasoEnlace({
  solucionArticuloId,
  tituloReferencia,
}: {
  solucionArticuloId: string
  tituloReferencia: string
}) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(solucionArticuloId)) ?? null, [solucionArticuloId])
  if (!articulo || articulo.eliminadoEn) {
    return (
      <span className="inline-flex min-h-11 items-center text-[13px] text-noct-precaucion/85">
        La solución vinculada{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está disponible.
      </span>
    )
  }
  return (
    <Link
      to={`/soluciones/${articulo.categoriaId}/${articulo.id}`}
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-noct-precaucion/50 px-3 text-[13px] font-medium text-noct-precaucion hover:bg-noct-precaucion/10"
    >
      <Wrench size={15} className="shrink-0" aria-hidden />
      <span className="min-w-0 truncate">Ver la solución: {articulo.titulo}</span>
    </Link>
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
