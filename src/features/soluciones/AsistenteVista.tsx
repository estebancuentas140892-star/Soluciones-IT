import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { db, type PasoProcedimiento, type Procedimiento } from '../../lib/db'
import {
  normalizarProcedimiento,
  pasoTrabajoPrevioCompleto,
  siguientePasoPendiente,
  tareasDe,
} from '../../lib/procedimiento'
import {
  contarHechos,
  contarInstruccionesHechas,
  leerAvance,
  marcarPasoSaltado,
  registrarEvidenciaPaso,
  reiniciarProgreso,
  type ClaveProgreso,
} from '../../lib/progresoPasos'
import {
  guardarModoEjecucion,
  leerModoEjecucion,
  MODO_EJECUCION_POR_DEFECTO,
  type ModoEjecucion,
} from '../../lib/preferenciasEjecucion'
import { registrarIntervencion } from '../../lib/repositorio'
import { conOrigen } from '../../lib/origenNavegacion'
import { BandaTarea } from '../../app/bandaTarea'
import { Adjuntos } from '../../components/Adjuntos'
import { Camera, CaretDown, CaretLeft, CaretRight, Check, ClockCounterClockwise, LinkSimple, SealCheck, Warning, Wrench, X } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { AccionVinculo, EnlaceVinculo, FilaVinculo } from './FilaVinculo'
import { fraseAvanceDocumento, modoVinculo, PROMESA_REGRESO, ZONA_ANIDADA } from './vinculoAnidado'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
import { cierreDelPaso, guiaPendienteDelPaso } from './cierrePaso'
import { claveDeVinculo, useAvanceProgreso, useClaveProgreso, useClaveVinculo } from './contextoEjecucion'
import { motivoGuiasPendientes } from './guiasObligatorias'
import { useProcedimientoEjecucion } from './useProcedimientoEjecucion'
import { HojaPasos } from './HojaPasos'
import { ModoFoco } from './ModoFoco'
import { HojaFalla } from './HojaFalla'
import { destinoAlSaltar } from './salidasFalla'
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
  // Donde vive el avance de ESTE documento (tarea 2 del encargo): la
  // fila del articulo en el nivel 0, la entrada del vinculo dentro de
  // la ejecucion en curso en un nivel anidado.
  const clave = useClaveProgreso(articuloId, nivel)
  const { pasos, verificacionFinal, tiempoEstimadoMin } = procedimiento
  const idsPasos = useMemo(() => pasos.map((p) => p.id), [pasos])

  // Equipo afectado por ESTE procedimiento (tarea 79, solo nivel 0):
  // determina si la captura de evidencia tiene donde registrarse. Un
  // subprocedimiento o solucion anidados ejecutan otro articulo, con
  // su propio equipo o ninguno; se mantiene fuera para no sumar mas
  // interfaz a paneles ya densos.
  const articulo = useLiveQuery(() => (nivel === 0 ? db.articulos.get(articuloId) : undefined), [articuloId, nivel])
  const dispositivoEvidencia = articulo?.dispositivosAfectados?.[0] ?? null

  // DÓNDE ESTÁ EL TÉCNICO AHORA MISMO. Una guía vinculada que no se
  // puede desplegar aquí se abre en su propia pantalla, y hasta ahora
  // prometía "vuelves aquí al terminar" con un enlace pelado: el
  // regreso caía en el padre declarado (la lista de Guías), no en la
  // ejecución de la que salió. Con el origen escrito en el `state`, el
  // regreso deshace el salto de verdad (regla M-R2).
  const rutaOrigen = useLocation().pathname

  const [indiceActual, setIndiceActual] = useState<number | null>(null)
  const [listo, setListo] = useState(false)
  // Índice de los pasos (tablero 6c): se abre tocando el contador.
  const [indiceAbierto, setIndiceAbierto] = useState(false)
  // CÓMO SE EJECUTA (tarea 217, hallazgos G-16 a G-19). Una tarea a la
  // vez es la ejecución por defecto, y la elección del técnico se
  // GUARDA: era lo único del flujo que no sobrevivía a salir de la
  // pantalla, mientras el avance sí. Arranca en el defecto y se
  // corrige en cuanto la preferencia guardada llega, dentro del mismo
  // efecto que resuelve la posición inicial, así que no hay parpadeo.
  const [modoEjecucion, setModoEjecucion] = useState<ModoEjecucion>(MODO_EJECUCION_POR_DEFECTO)
  async function cambiarModoEjecucion(modo: ModoEjecucion) {
    setModoEjecucion(modo)
    setPasoEnteroPorFalla(null)
    await guardarModoEjecucion(modo)
  }
  // Excepción efímera y atada a UN paso: al declarar una falla hay que
  // ver el paso entero, porque las cuatro salidas (contingencia,
  // evidencia, archivos) viven ahí. No toca la preferencia guardada:
  // mirar una falla no es cambiar de forma de trabajar. Al cambiar de
  // paso deja de aplicar sola, igual que `falla`.
  const [pasoEnteroPorFalla, setPasoEnteroPorFalla] = useState<string | null>(null)
  // FALLA DEL PASO (tablero 3d). Tres estados distintos a propósito:
  //
  // - `falla`: qué paso falló y qué se pidió al declararlo. Va ATADO AL
  //   PASO, así que avanzar retira el aviso solo. Antes el aviso del
  //   modo foco se quedaba puesto en los pasos siguientes.
  // - `hojaFalla`: la hoja de salidas abierta, con la tarea señalada si
  //   viene del foco. Abrirla no declara nada todavía: "Cancelar" tiene
  //   que poder no dejar rastro.
  // - `contingenciaPasoId`: en qué paso se abrió la guía de
  //   contingencia. Antes no hacía falta porque la contingencia solo
  //   aparecía con el paso entero marcado, que es justo el defecto.
  const [falla, setFalla] = useState<{ pasoId: string; tarea: string | null; conEvidencia: boolean } | null>(null)
  const [hojaFalla, setHojaFalla] = useState<{ tarea: string | null } | null>(null)
  const [contingenciaPasoId, setContingenciaPasoId] = useState<string | null>(null)
  // Lleva al técnico hasta la cámara cuando elige "fotografiar y
  // anotar": el bloque de evidencia vive al final del paso. Se desplaza
  // la vista y nada más. Registrar una intervención en el historial del
  // equipo es una escritura, y la decide el técnico tocando su botón,
  // no un efecto secundario de haber elegido una salida.
  const refEvidencia = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (falla?.conEvidencia) refEvidencia.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [falla])

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
    // La preferencia de modo se lee JUNTO con el avance y antes de
    // marcar `listo`: si se leyera aparte, el técnico que trabaja con
    // el paso entero vería medio segundo de foco al entrar.
    void Promise.all([leerAvance(clave), leerModoEjecucion()]).then(([prog, modo]) => {
      if (!vigente) return
      const hechosIniciales = new Set(prog?.pasosHechos ?? [])
      setIndiceActual(siguientePasoPendiente(idsPasos, hechosIniciales, -1))
      setModoEjecucion(modo)
      setListo(true)
    })
    return () => {
      vigente = false
    }
    // Solo al entrar a este articulo: idsPasos cambiaria si se edita el
    // procedimiento a mitad de ejecucion, un caso raro que no amerita
    // recalcular la posicion (podria saltar el avance del tecnico).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articuloId, nivel])

  const {
    progreso,
    hechos,
    instruccionesHechas,
    completados,
    pasosCompletados,
    verificacionCompleta,
    todoCompletado,
    subSatisfechoReactivo,
    guiaDelPasoDisponible,
    guiasPendientesDeTarea,
    alternarTarea,
    alternarVerificacion,
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
    await reiniciarProgreso(clave)
    setInicio(Date.now())
    setAhora(Date.now())
    setIndiceActual(siguientePasoPendiente(idsPasos, new Set<string>(), -1))
  }

  if (!listo) return <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>

  // Anidado (subprocedimiento o solucion de un paso de nivel 0): el
  // padre deja de renderizar este componente en cuanto queda
  // satisfecho, asi que aqui no hace falta pantalla de cierre propia.
  //
  // SALVO SUS COMPROBACIONES FINALES (encargo del 2026-09-09, tarea 4).
  // Con este `return null` sin condiciones, una guia vinculada con
  // comprobaciones desaparecia al cerrar su ultimo paso y nadie llegaba
  // a verlas nunca: el unico sitio donde se marcan es la pantalla que
  // este return borraba. Ahora se va cuando esta terminada de verdad.
  if (indiceActual === null && nivel >= 1 && verificacionCompleta) return null

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
                    onClick={() => void alternarVerificacion(indice)}
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
                    <span className={`text-sm ${marcada ? 'text-noct-neutral-400' : 'text-noct-neutral-300'}`}>
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
  // La falla y la contingencia son de ESTE paso: al cambiar de paso no
  // se arrastran.
  const fallaDelPaso = falla?.pasoId === paso.id ? falla : null
  const contingenciaAbierta = contingenciaPasoId === paso.id
  // A dónde lleva "saltar el paso y seguir", o null si no hay a dónde y
  // entonces esa salida no se ofrece (ver `salidasFalla.ts`).
  const destinoSalto = destinoAlSaltar(indiceActual, idsPasos, hechos)

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
  // QUÉ FALTA, NO "NO PUEDES AVANZAR" (hallazgo H07), y con el MISMO
  // rótulo y la misma regla en las tres vistas (tarea 3 del encargo):
  // el botón nunca dice "Paso hecho" mientras queden tareas o una guía
  // vinculada. Consultar sigue disponible: lo que no se puede es dar el
  // paso por hecho.
  const cierre = cierreDelPaso({
    pasoHecho: pasoActualHecho,
    totalTareas: idsTareas.length,
    tareasMarcadas: marcadas,
    guiaPendiente: guiaPendienteDelPaso(paso, subSatisfecho),
    hayPasoSiguiente: indiceActual + 1 < pasos.length,
    numeroPasoSiguiente: indiceActual + 2,
  })

  // Estado de cada paso para el índice (tablero 6c). Se recalcula en
  // cada render a propósito: son unas pocas decenas de pasos como mucho,
  // y memorizarlo exigiría estabilizar dos Sets que el hook rehace en
  // cada lectura del progreso.
  // "Saltado" ahora se lee del avance guardado, no de la posición: ver
  // la cabecera de estadoPasos.ts (hallazgo H07).
  const saltados = new Set(progreso?.pasosSaltados ?? [])
  const resumenes: ResumenPaso[] = resumirPasos(pasos, hechos, instruccionesHechas, indiceActual, saltados)
  const subtituloIndice = resumenDeAvance(resumenes, minutosRestantes(tiempoEstimadoMin, resumenes))

  // MODO FOCO (tablero 6d): sustituye el cuerpo del paso, no lo
  // acompaña. La `key` es el id del paso, así que al completarlo el
  // foco se remonta ya puesto en la primera tarea del siguiente.
  //
  // Desde la tarea 218 la barra de tarea del chasis (compacta, X +
  // título + contador) y el índice de pasos son EXTERNOS al foco: se
  // comparten con la vista completa a través de `indiceUI`, más abajo.
  // Elegir una salida deja el paso declarado como fallido y muestra EL
  // PASO ENTERO, porque las cuatro salidas ocurren ahí (la
  // contingencia, la evidencia y los archivos viven en el paso
  // completo). Es una excepción de este paso, no un cambio de
  // preferencia: al pasar al siguiente se vuelve solo a como el
  // técnico trabaja. Cancelar no sale: devuelve al técnico exactamente
  // donde estaba.
  function elegirSalida(conEvidencia: boolean) {
    setFalla({ pasoId: paso.id, tarea: hojaFalla?.tarea ?? null, conEvidencia })
    setHojaFalla(null)
    setPasoEnteroPorFalla(paso.id)
  }

  // UNA SOLA hoja para los dos "Falla" (tablero 3d): el del modo foco,
  // que ya existía desde el 6d, y el nuevo de la barra de acción. Lo
  // único que cambia entre los dos es que el foco sabe en qué tarea
  // estaba el técnico.
  const hojaDeFalla = (
    <HojaFalla
      abierto={hojaFalla !== null}
      onCerrar={() => setHojaFalla(null)}
      numeroPaso={indiceActual + 1}
      pasosHechos={completados}
      tarea={hojaFalla?.tarea ?? null}
      solucionArticuloId={paso.solucionArticuloId || null}
      solucionArticuloTitulo={paso.solucionArticuloTitulo}
      onAbrirContingencia={() => {
        elegirSalida(false)
        setContingenciaPasoId(paso.id)
      }}
      onFotografiar={dispositivoEvidencia ? () => elegirSalida(true) : null}
      onSaltar={
        destinoSalto === null
          ? null
          : () => {
              // Saltar no deja aviso puesto: el aviso es de este paso
              // y el técnico se va a otro. Y no cambia de vista: saltar
              // es seguir trabajando, así que el técnico sigue en el
              // modo que eligió.
              //
              // Lo que SÍ hace ahora es dejarlo anotado (H07): antes el
              // índice lo deducía de la posición, así que un paso que
              // solo se miró salía marcado como saltado y uno que se
              // saltó de verdad, al volver atrás, dejaba de estarlo.
              void marcarPasoSaltado(clave, paso.id)
              setHojaFalla(null)
              setIndiceActual(destinoSalto)
            }
      }
      // Detenerse sin resolver ni saltar: deja la falla anotada en el
      // paso y devuelve al técnico donde estaba. Es la salida que
      // faltaba cuando el paso no tiene contingencia vinculada
      // (hallazgo H10): sin ella, la hoja solo ofrecía saltar, es decir
      // presentaba el salto como si fuera la solución del fallo.
      onDetenerse={() => {
        elegirSalida(false)
      }}
    />
  )

  // El foco ya no exige que el paso tenga tareas (G-18): un paso sin
  // ellas se presenta como una sola tarea con su título, así que el
  // modo no se cae solo a mitad de procedimiento. Lo único que lo
  // aparta es la preferencia del técnico o la falla declarada en ESTE
  // paso.
  const enFoco = modoEjecucion === 'foco' && nivel === 0 && pasoEnteroPorFalla !== paso.id

  // El índice de pasos y su disparador (tarea 218, G-09, G-10, G-14):
  // una línea compacta de 44 px que el chasis porta a su propia barra
  // pegajosa (`BandaTarea`, sustituye los 124 px que sumaban la barra
  // de tarea y la banda del paso), más la hoja del índice, que ahora
  // ABRE TAMBIÉN desde aquí en Foco, algo que antes no existía: el
  // índice era inalcanzable sin salir primero a la vista completa. Se
  // arma una sola vez porque las dos vistas lo comparten por igual.
  const indiceUI =
    nivel === 0 ? (
      <>
        <BandaTarea>
          <ContadorPaso indice={indiceActual} total={pasos.length} onAbrirIndice={() => setIndiceAbierto(true)} />
        </BandaTarea>
        <HojaPasos
          abierto={indiceAbierto}
          onCerrar={() => setIndiceAbierto(false)}
          resumenes={resumenes}
          subtitulo={subtituloIndice}
          tituloGuia={articulo?.titulo}
          onIrAPaso={setIndiceActual}
          modoEjecucion={modoEjecucion}
          onCambiarModo={(modo) => void cambiarModoEjecucion(modo)}
          // H11 / A15: se leen desde el primer paso, sin tener que
          // marcar tareas que nadie hizo para llegar a ellas.
          verificacionFinal={verificacionFinal}
        />
      </>
    ) : null

  if (enFoco) {
    return (
      <>
        {indiceUI}
        <ModoFoco
          key={paso.id}
          paso={paso}
          tituloPaso={tituloPaso}
          instruccionesHechas={instruccionesHechas}
          subSatisfecho={subSatisfecho}
          guiaDelPasoDisponible={guiaDelPasoDisponible(paso)}
          onAlternarTarea={(tareaId) => void alternarTarea(indiceActual, paso, tareaId)}
          onCompletarPaso={avanzar}
          etiquetaAvance={cierre.etiqueta}
          puedeCerrarPaso={cierre.accion !== 'bloqueado'}
          onFalla={(texto) => setHojaFalla({ tarea: texto })}
          guiasPendientes={(tareaId) => guiasPendientesDeTarea(paso, tareaId)}
          // TERMINAR EL DESTINO DE UN "NO" RESPONDE LA DECISIÓN, no
          // cierra el paso (encargo del 2026-09-09, secciones 5 y 6).
          // Es el mismo trato que la vista completa: se marca la
          // decisión y se reinicia el avance del destino, para que la
          // próxima guía que lo reutilice lo encuentre limpio.
          onDecisionResuelta={(tareaId, guiaId) => {
            void (async () => {
              // El destino del "no" es un vinculo de ESTA ejecucion, asi
              // que se reinicia ahi: el avance que esa guia lleve por su
              // cuenta no es asunto de este procedimiento (tarea 2).
              await reiniciarProgreso(claveDeVinculo(clave, guiaId))
              await alternarTarea(indiceActual, paso, tareaId)
            })()
          }}
          // LA GUÍA VINCULADA SE EJECUTA AQUÍ DENTRO (H05). Es el mismo
          // componente que ya usaba la vista completa, así que las dos
          // vistas ejecutan exactamente lo mismo (criterio A08) y el
          // regreso al origen es automático: el técnico nunca sale de
          // esta pantalla, así que no hay a dónde volver.
          renderGuia={({ guiaId, tituloReferencia, obligatoria, kicker, abierta, alCompletar }) => (
            <SubProcedimientoEnAsistente
              guiaId={guiaId}
              tituloReferencia={tituloReferencia}
              nivel={nivel}
              obligatoria={obligatoria}
              kicker={kicker}
              abierta={abierta}
              rutaOrigen={rutaOrigen}
              etiquetaOrigen={articulo?.titulo ?? 'la guía'}
              onCompletado={alCompletar ?? (() => void intentarCompletarPaso(indiceActual, paso))}
            />
          )}
        />
        {hojaDeFalla}
      </>
    )
  }

  return (
    <div className={`flex flex-col gap-4 ${nivel === 0 ? 'flex-1' : ''}`}>
      {indiceUI}
      {/* El documento anidado ya NO repite su avance aquí (regla R57 del
          turno 12). Traía una barra de acento con "Paso 1 de 2", justo
          debajo de la fila que lo abre, que dice lo mismo con el anillo
          y con la frase "Paso 1 de 2 de esta contingencia". Eran dos
          barras de acento anidadas midiendo cosas distintas: los pasos
          del procedimiento principal y los del vinculado. */}

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

      {/* Lo que el técnico declaró al elegir una salida (tablero 3d).
          No toca el progreso ni completa nada: deja dicho que este paso
          falló y pone a mano lo que hace falta. Se retira solo al
          cambiar de paso, porque va atado al id del paso. */}
      {fallaDelPaso && nivel === 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-noct-precaucion/45 bg-noct-precaucion/[.12] px-4 py-3">
          <p className="flex items-start gap-2.5 text-[13.5px] leading-snug">
            <Warning size={17} className="mt-px shrink-0 text-noct-precaucion" aria-hidden />
            <span className="min-w-0">
              <span className="font-semibold text-noct-precaucion">Marcaste una falla</span>
              {fallaDelPaso.tarea ? <> en «{fallaDelPaso.tarea}». </> : <> en este paso. </>}
              Aquí tienes el paso completo: sus avisos, sus fotos y sus archivos.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {paso.solucionArticuloId && !contingenciaAbierta && (
              <button
                type="button"
                onClick={() => setContingenciaPasoId(paso.id)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-noct-precaucion/50 px-3 text-[13px] font-medium text-noct-precaucion hover:bg-noct-precaucion/10"
              >
                <Wrench size={15} className="shrink-0" aria-hidden />
                Abrir la contingencia
              </button>
            )}
            <button
              type="button"
              onClick={() => setFalla(null)}
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
                // "No se cumple" de una comprobación abre la MISMA hoja
                // de salidas que el "Falla" del paso, con la
                // comprobación nombrada. Es lo único que le faltaba a
                // esta vista para tratar una verificación distinto de
                // una instrucción (cambio 2 del encargo).
                onNoSeCumple={(texto) => setHojaFalla({ tarea: texto })}
                // LA MISMA REGLA EN LA VISTA DE PASO ENTERO (encargo del
                // 2026-09-09, tarea 1). Sin esto la validación existía
                // solo en el modo de una tarea a la vez, y cambiar de
                // vista era la ruta alternativa que la omitía.
                bloqueadaPor={motivoGuiasPendientes(guiasPendientesDeTarea(paso, bloque.id))}
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

      {/* LO QUE CUELGA DEL PASO, en filas y sin marcos de color (M-012,
          regla M-R11, tableros `3b` y `12b`). El dato protegido y la guía
          anidada traían marco de acento; la contingencia, marco ámbar.
          Con el aviso del paso encima, un paso llegaba a mostrar cinco
          marcos anidados y dos de ellos del mismo tono con significados
          distintos, así que la advertencia real dejaba de destacar.
          Ahora el ámbar es de la falla y nada más. */}
      <div className="flex flex-col">
        {paso.vinculoProtegido && <CredencialEnPaso vinculo={paso.vinculoProtegido} />}

        {paso.subArticuloId && (
          <SubProcedimientoEnAsistente
            guiaId={paso.subArticuloId}
            tituloReferencia={paso.subArticuloTitulo}
            nivel={nivel}
            rutaOrigen={rutaOrigen}
            etiquetaOrigen={articulo?.titulo ?? 'la guía'}
            onCompletado={() => void intentarCompletarPaso(indiceActual, paso)}
          />
        )}

      {/* La contingencia ya no depende de `trabajoPrevio` (tablero 3d):
          se abre desde "Falla", que está disponible siempre. La `key`
          la ata al paso para que no herede el estado de otro.

          Qué pasa al resolverla depende de si el paso tenía trabajo
          pendiente. Con todo marcado, resolverla completa el paso y el
          avance sigue, que es como funcionaba. Con tareas sin marcar,
          NO: darlo por hecho se saltaría trabajo que nadie hizo, así
          que solo se cierra la contingencia y el técnico vuelve al paso
          con su aviso puesto. */}
        {paso.solucionArticuloId && !pasoActualHecho && (
          <SolucionEnAsistente
            key={paso.id}
            solucionArticuloId={paso.solucionArticuloId}
            tituloReferencia={paso.solucionArticuloTitulo}
            nivel={nivel}
            abrirDirecto={contingenciaAbierta}
            onCerrar={() => setContingenciaPasoId(null)}
            onResuelta={() => {
              if (trabajoPrevio) void completarPasoYAvanzar(indiceActual, paso)
              else setContingenciaPasoId(null)
            }}
          />
        )}

        {/* Evidencia fotografica del paso (tarea 79): solo si el
            procedimiento tiene un equipo afectado donde registrarla. */}
        {nivel === 0 && dispositivoEvidencia && (
          <div ref={refEvidencia}>
            <EvidenciaPaso
              clave={clave}
              articuloTitulo={articulo?.titulo ?? ''}
              dispositivoId={dispositivoEvidencia.id}
              paso={paso}
              entradaId={progreso?.evidenciasPorPaso?.[paso.id] ?? null}
              conFalla={Boolean(fallaDelPaso)}
            />
          </div>
        )}
      </div>

      {/* Acción dominante fija al pie (M-011, regla M-R3, mockup `3b`),
          REDUCIDA en la tarea 218 (G-09, G-11, G-12). Hasta la 217 esta
          barra tenía dos filas: una con "Atrás" y el botón de entrada al
          foco, otra con "Falla" a 56 px compitiendo por ancho con la
          acción dominante, que en 360 px llegaba a recortarse ("Paso
          hecho · i..."). Ahora el dominante va SOLO en su fila, a todo
          lo ancho, y "anterior"/"siguiente" pasan a ser paginación pura
          (mueven el índice sin validar ni completar nada, para revisar
          otros pasos sin arriesgar el avance), en la misma fila de 52
          px que el contador —duplicado del de arriba, ya al alcance del
          pulgar (G-14)— y "Falla", que baja a control neutro con icono
          ámbar: deja de ir en ámbar pleno y de competir en tamaño con
          el dominante (G-11).

          Es `sticky`, no `fixed`: así reserva su propio hueco en el
          flujo y no tapa el final del paso.

          Los pasos anidados conservan su fila en línea (más abajo): su
          avance lo decide el paso que los contiene, y dos acciones
          dominantes en la misma pantalla dejarían de ser dominantes. */}
      {nivel === 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.96] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-[12px]">
          <button
            type="button"
            disabled={cierre.accion === 'bloqueado'}
            onClick={avanzar}
            className="flex h-[76px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-noct-accent bg-noct-accent/[.16] text-[17px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.22] active:bg-noct-accent/[.3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent disabled:opacity-30"
          >
            <Check size={19} className="shrink-0" aria-hidden />
            <span className="truncate">{cierre.etiqueta}</span>
          </button>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={indiceActual === 0}
              onClick={() => setIndiceActual(Math.max(0, indiceActual - 1))}
              // CONSULTAR NO ES AVANZAR (cambio 2 del encargo). Decían
              // "Paso anterior" y "Paso siguiente" a secas, en una
              // pantalla cuya acción dominante es cerrar el paso: se
              // leían como avanzar el trabajo. Mueven el índice y nada
              // más, y ahora lo dicen, igual que ya lo decían las
              // flechas del modo de una tarea a la vez.
              aria-label="Ver el paso anterior. Solo mueve la vista, no cambia lo marcado"
              title="Ver el anterior"
              className="flex h-[52px] w-12 shrink-0 items-center justify-center rounded-xl border border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.07] disabled:opacity-30"
            >
              <CaretLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setIndiceAbierto(true)}
              aria-haspopup="dialog"
              aria-label={`Paso ${indiceActual + 1} de ${pasos.length}. Abrir el índice de pasos`}
              className="flex h-[52px] flex-1 items-center justify-center gap-1 rounded-xl border border-noct-divider font-mono text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-text/[.07]"
            >
              {indiceActual + 1}
              <span className="text-[13px] font-normal text-noct-neutral-400">/{pasos.length}</span>
              <CaretDown size={13} className="text-noct-neutral-400" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setHojaFalla({ tarea: null })}
              aria-haspopup="dialog"
              aria-label={`Algo va mal en el paso ${indiceActual + 1}`}
              className="flex h-[52px] w-12 shrink-0 items-center justify-center rounded-xl border border-noct-divider text-noct-precaucion hover:bg-noct-text/[.07]"
            >
              <Warning size={18} aria-hidden />
            </button>
            <button
              type="button"
              disabled={indiceActual + 1 >= pasos.length}
              onClick={() => setIndiceActual(Math.min(pasos.length - 1, indiceActual + 1))}
              aria-label="Ver el paso siguiente. Solo mueve la vista, no lo da por hecho"
              title="Ver el siguiente"
              className="flex h-[52px] w-12 shrink-0 items-center justify-center rounded-xl border border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.07] disabled:opacity-30"
            >
              <CaretRight size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* El paso anidado también puede fallar, así que también tiene su
          salida. No es la barra fija (no hay dos acciones dominantes en
          una pantalla) sino la misma fila en línea de siempre, ahora con
          "Falla" al lado. Sin evidencia: el equipo afectado es el del
          procedimiento de nivel 0, no el de este. */}
      {nivel >= 1 && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHojaFalla({ tarea: null })}
            aria-haspopup="dialog"
            aria-label={`Algo va mal en el paso ${indiceActual + 1}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-noct-precaucion/55 px-3 text-[13px] font-medium text-noct-precaucion hover:bg-noct-precaucion/10"
          >
            <Warning size={15} className="shrink-0" aria-hidden />
            Falla
          </button>
          {/* El mismo control que el nivel 0, con el mismo rótulo y la
              misma regla: decía "Siguiente" sin nombrar nunca lo que
              faltaba (tarea 3 del encargo). */}
          <button
            type="button"
            disabled={cierre.accion === 'bloqueado'}
            onClick={avanzar}
            className={`${BTN_PRIMARIO} min-h-11 flex-1 text-sm disabled:opacity-30`}
          >
            <span className="truncate">{cierre.etiqueta}</span>
            <CaretRight size={15} aria-hidden />
          </button>
        </div>
      )}
      {hojaDeFalla}
    </div>
  )
}

// Contador de paso, DENTRO de la barra compacta de 44 px del chasis
// (tarea 218, G-09, G-10, G-14). Antes era `CabeceraPaso`: un bloque
// propio de 56 px con el título repetido, las tareas del paso y una
// barra de segmentos, que sumado a los 68 px de la barra de tarea daba
// 124 px de cromo fijo. Ahora es solo el DESTINO que abre el índice de
// pasos ("3/7 ▾"), portado junto al título y la X mediante
// `BandaTarea`; el título ya lo dice esa misma línea, y el estado de
// cada paso vive en el propio índice (`HojaPasos`), no repetido aquí.
function ContadorPaso({
  indice,
  total,
  onAbrirIndice,
}: {
  indice: number
  total: number
  onAbrirIndice: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAbrirIndice}
      aria-haspopup="dialog"
      aria-label={`Paso ${indice + 1} de ${total}. Abrir el índice de pasos`}
      className="flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 font-mono text-[14px] font-semibold text-noct-accent-300 hover:bg-noct-text/[.07]"
    >
      {indice + 1}
      <span className="text-[12px] font-normal text-noct-neutral-400">/{total}</span>
      <CaretDown size={12} className="text-noct-neutral-400" aria-hidden />
    </button>
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
  clave,
  articuloTitulo,
  dispositivoId,
  paso,
  entradaId,
  conFalla,
}: {
  clave: ClaveProgreso
  articuloTitulo: string
  dispositivoId: string
  paso: PasoProcedimiento
  entradaId: string | null
  // El paso está declarado como fallido (tablero 3d): la evidencia deja
  // de ser un extra y pasa a ser el registro de lo que salió mal, así
  // que crece a 56 px y la intervención se titula como lo que es. La
  // salida "Fotografiar y anotar el problema" de la hoja de falla trae
  // la vista hasta aquí, pero NO toca el botón: crear la intervención
  // escribe en el historial del equipo y esa es una decisión del
  // técnico, no un efecto de haber abierto una hoja.
  conFalla?: boolean
}) {
  const [creando, setCreando] = useState(false)

  async function adjuntarEvidencia() {
    setCreando(true)
    const tituloPaso = paso.titulo || paso.subArticuloTitulo || 'paso sin título'
    const descripcion = conFalla
      ? `Falla en el paso "${tituloPaso}" (${articuloTitulo})`
      : `Evidencia del paso "${tituloPaso}" (${articuloTitulo})`
    const id = await registrarIntervencion(dispositivoId, descripcion)
    await registrarEvidenciaPaso(clave, paso.id, id)
    setCreando(false)
  }

  if (!entradaId) {
    return conFalla ? (
      <button
        type="button"
        disabled={creando}
        onClick={() => void adjuntarEvidencia()}
        className="flex h-[56px] w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-noct-precaucion/60 bg-noct-precaucion/10 px-4 text-[15px] font-medium text-noct-precaucion active:bg-noct-precaucion/[.24] disabled:opacity-50"
      >
        <Camera size={19} className="shrink-0" aria-hidden />
        {creando ? 'Preparando...' : 'Fotografiar y anotar la falla'}
      </button>
    ) : (
      // Sin falla declarada la evidencia es un vínculo más del paso, así
      // que se dibuja como los demás: fila de 44 px con icono neutro
      // (tablero `3b`, "Foto de evidencia"). Antes era el único botón
      // fantasma en acento del grupo.
      <AccionVinculo
        Icono={Camera}
        kicker="Prueba del trabajo"
        titulo="Foto de evidencia"
        accion={creando ? 'Preparando...' : 'Agregar'}
        onEjecutar={() => void adjuntarEvidencia()}
        deshabilitado={creando}
      />
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
//
// El marco de acento se retira (M-012): era el mismo marco del dato
// protegido, así que el color decía "hay algo vinculado" y no qué. Lo
// que queda es una fila neutra que se pliega y, debajo, la línea
// vertical que marca la profundidad.
function SubProcedimientoEnAsistente({
  guiaId,
  tituloReferencia,
  nivel,
  obligatoria = true,
  kicker: kickerPropio,
  abierta,
  rutaOrigen,
  etiquetaOrigen,
  onCompletado,
}: {
  guiaId: string
  tituloReferencia: string
  nivel: number
  // Rotulo de la fila cuando el papel de la guia no es ni requisito ni
  // consulta: el destino del "no" de una decision se rotula "Si esto
  // falla", igual que en la vista completa.
  kicker?: string
  // Llega desplegada. El destino de un "no" es el trabajo que toca
  // ahora, no algo que se ojea si hace falta.
  abierta?: boolean
  // false para una guia de consulta o contingencia: se ofrece, pero no
  // condiciona nada (punto 6 de la seccion 5 del encargo). Cambia lo
  // que se le promete al tecnico, no lo que se le deja hacer.
  obligatoria?: boolean
  // A donde vuelve el tecnico si la guia se abre en su propia pantalla.
  rutaOrigen?: string
  etiquetaOrigen?: string
  onCompletado: () => void
}) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(guiaId)) ?? null, [guiaId])
  // El avance del vinculo es el de ESTA ejecucion, no el que esa guia
  // lleve por su cuenta ni el que dejo otra guia que la reutiliza.
  const progreso = useAvanceProgreso(useClaveVinculo(guiaId))
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  // Una guía necesaria llega abierta (es el trabajo de la tarea); una
  // de consulta llega cerrada, porque consultar es opcional y abrirla
  // sola le robaría la pantalla a la instrucción.
  const [cerrado, setCerrado] = useState(!(abierta ?? obligatoria))

  if (articulo === undefined) return null

  // VÍNCULO ROTO CON SALIDA ÚTIL (criterio A12). Antes el aviso solo
  // hablaba del editor, así que el técnico que está frente al equipo se
  // quedaba sin nada que hacer y sin saber si podía continuar.
  if (articulo === null || articulo.eliminadoEn) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/10 px-3 py-2.5">
        <p className="text-[13px] leading-snug text-noct-precaucion">
          La guía vinculada{tituloReferencia ? ` «${tituloReferencia}»` : ''} no está disponible en este
          dispositivo. Puede haberse eliminado, o no haber llegado todavía por sincronización.
        </p>
        {/* SIN CONTRADECIR A LA PANTALLA (encargo del 2026-09-09,
            sección 5). Aquí decía "el cierre del paso queda pendiente de
            este vínculo" mientras el pie de la misma pantalla decía
            "este vínculo no impide cerrarlo", y el pie es el que dice la
            verdad: `subSatisfechoReactivo` da por satisfecho el vínculo
            roto justo para no dejar el paso sin salida. Dos frases
            opuestas a cuatro centímetros de distancia es lo que la
            sección 5 prohíbe. */}
        <p className="text-[12.5px] leading-snug text-noct-neutral-300">
          {obligatoria
            ? 'No impide cerrar el paso: sigue con el resto y avisa a quien mantiene la guía para que la reponga.'
            : 'Era material de consulta, así que puedes continuar sin ella.'}
        </p>
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
  const kicker = kickerPropio ?? (obligatoria ? 'Otra guía' : 'Consulta opcional')

  // Misma regla de un solo nivel que ProcedimientoVista: mas alla se
  // enlaza, sin ejecutar aqui, y evita cualquier ciclo de vinculos. Y
  // ahora SE NOTA que solo enlaza (regla R58 del turno 12).
  //
  // EL REGRESO AHORA ES REAL (criterio A10). La fila prometía "vuelves
  // aquí al terminar" con un `<Link>` pelado, así que volver caía en el
  // padre declarado (la lista de Guías) y no en la ejecución de la que
  // se salió. Ahora el origen viaja en el `state` y el chasis lo usa
  // para deshacer el último salto (regla M-R2).
  if (procedimiento === null || modoVinculo(nivel, procedimiento) === 'enlazado') {
    return (
      <EnlaceVinculo
        Icono={LinkSimple}
        kicker={kicker}
        titulo={articulo.titulo}
        nota={PROMESA_REGRESO}
        extra={anillo}
        to={ruta}
        state={rutaOrigen ? conOrigen(rutaOrigen, etiquetaOrigen ?? 'la guía anterior') : undefined}
      />
    )
  }

  const abierto = !cerrado

  return (
    <div>
      <FilaVinculo
        Icono={LinkSimple}
        kicker={kicker}
        titulo={articulo.titulo}
        nota={fraseAvanceDocumento(hechos, total, 'guía')}
        extra={anillo}
        abierto={abierto}
        onAlternar={() => setCerrado((valor) => !valor)}
      />
      {abierto && (
        <div className={`my-1 ${ZONA_ANIDADA}`}>
          <AsistenteVista
            articuloId={articulo.id}
            procedimiento={procedimiento}
            nivel={nivel + 1}
            onCompletado={onCompletado}
          />
        </div>
      )}
    </div>
  )
}

// LA CONTINGENCIA DEL PASO, abierta dentro del asistente (tablero 3d).
//
// Antes esto era una PREGUNTA ("¿Ocurrió algún error durante este
// paso?") con dos botones de 28 px, y solo aparecía cuando el trabajo
// previo del paso estaba completo: si el paso fallaba no se podían
// marcar sus tareas, así que la pregunta no llegaba a hacerse nunca.
// Ahora la pregunta la hace el botón "Falla" de la barra, que está
// siempre, y esto es solo la respuesta: la guía de contingencia
// ejecutándose un paso a la vez, sin salir del procedimiento.
//
// Se abre por dos caminos: porque el técnico la eligió en la hoja de
// falla (`abrirDirecto`), o sola cuando quedó a medias, que es lo que
// pasa al salir y volver a entrar en mitad de un error.
//
// Su marco ámbar se retira (M-012, regla M-R11). La contingencia es un
// DOCUMENTO, no una advertencia: lo que advierte es el aviso del paso y
// el panel de falla que la abre, y los tres compartían el mismo tono.
// Aquí el ámbar se queda en la falla y la contingencia se dibuja como
// cualquier otro documento anidado: fila neutra y línea de profundidad.
function SolucionEnAsistente({
  solucionArticuloId,
  tituloReferencia,
  nivel,
  abrirDirecto,
  onCerrar,
  onResuelta,
}: {
  solucionArticuloId: string
  tituloReferencia: string
  nivel: number
  abrirDirecto: boolean
  onCerrar: () => void
  onResuelta: () => void
}) {
  const articulo = useLiveQuery(async () => (await db.articulos.get(solucionArticuloId)) ?? null, [solucionArticuloId])
  const claveVinculo = useClaveVinculo(solucionArticuloId)
  const progreso = useAvanceProgreso(claveVinculo)
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  // Cerrarla a mano tiene que poder ganarle a la apertura automática
  // por "quedó a medias"; volver a elegirla en la hoja tiene que poder
  // ganarle a ese cierre. De ahí el efecto: cada vez que el técnico la
  // pide otra vez, el cierre anterior deja de contar.
  const [cerradaAMano, setCerradaAMano] = useState(false)
  useEffect(() => {
    if (abrirDirecto) setCerradaAMano(false)
  }, [abrirDirecto])

  if (articulo === undefined) return null

  const total = procedimiento?.pasos.length ?? 0
  const hechos = procedimiento
    ? contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((p) => p.id))
    : 0
  const aMedias = hechos > 0 && hechos < total
  if (cerradaAMano || (!abrirDirecto && !aMedias)) return null

  function cerrar() {
    setCerradaAMano(true)
    onCerrar()
  }

  if (articulo === null || articulo.eliminadoEn) {
    return (
      <div className="rounded-lg border border-noct-precaucion/40 bg-noct-precaucion/10 px-3 py-2">
        <p className="text-xs text-noct-precaucion">
          La contingencia vinculada{tituloReferencia ? ` "${tituloReferencia}"` : ''} ya no está
          disponible. Edita el artículo para quitar el vínculo o vincular otra.
        </p>
      </div>
    )
  }

  const ruta = `/soluciones/${articulo.categoriaId}/${articulo.id}`

  // Dentro de un nivel ya expandido, o si la contingencia no tiene
  // pasos que ejecutar (K1), solo se enlaza: misma regla de un nivel que
  // corta los ciclos en los subprocedimientos.
  if (procedimiento === null || modoVinculo(nivel, procedimiento) === 'enlazado') {
    return (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <EnlaceVinculo
            Icono={Wrench}
            kicker="Si esto falla"
            titulo={articulo.titulo}
            nota={PROMESA_REGRESO}
            to={ruta}
          />
        </div>
        <BotonCerrarContingencia onCerrar={cerrar} />
      </div>
    )
  }

  // La contingencia resuelta devuelve el control al paso: qué pasa
  // entonces lo decide quien la abrió (ver el comentario del punto de
  // uso), y su progreso se reinicia para el próximo error, aquí o en
  // cualquier otro procedimiento que la reutilice.
  async function resuelta() {
    await reiniciarProgreso(claveVinculo)
    onResuelta()
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
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
            onAlternar={cerrar}
          />
        </div>
        <BotonCerrarContingencia onCerrar={cerrar} />
      </div>
      <div className={`my-1 ${ZONA_ANIDADA}`}>
        <AsistenteVista
          articuloId={articulo.id}
          procedimiento={procedimiento}
          nivel={nivel + 1}
          onCompletado={() => void resuelta()}
        />
      </div>
    </div>
  )
}

// Salir de la contingencia sin resolverla. Sin esto la contingencia es
// una trampa: se entra desde la hoja de falla y no se sale más que
// terminándola.
function BotonCerrarContingencia({ onCerrar }: { onCerrar: () => void }) {
  return (
    <button
      type="button"
      onClick={onCerrar}
      aria-label="Cerrar la contingencia y volver al paso"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-400 hover:bg-noct-text/[.07]"
    >
      <X size={18} aria-hidden />
    </button>
  )
}
