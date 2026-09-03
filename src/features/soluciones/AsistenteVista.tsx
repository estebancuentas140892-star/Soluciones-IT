import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, type PasoProcedimiento, type Procedimiento } from '../../lib/db'
import {
  normalizarProcedimiento,
  pasoTrabajoPrevioCompleto,
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
import {
  guardarModoEjecucion,
  leerModoEjecucion,
  MODO_EJECUCION_POR_DEFECTO,
  type ModoEjecucion,
} from '../../lib/preferenciasEjecucion'
import { registrarIntervencion } from '../../lib/repositorio'
import { BandaTarea } from '../../app/bandaTarea'
import { Adjuntos } from '../../components/Adjuntos'
import { Camera, CaretDown, CaretLeft, CaretRight, Check, ClockCounterClockwise, Crosshair, LinkSimple, SealCheck, Warning, Wrench, X } from '../../components/iconos'
import { BTN_PRIMARIO, BTN_SECUNDARIO } from '../../components/nocturne'
import { CredencialEnPaso } from '../boveda/CredencialEnPaso'
import { IndicadorAvance } from '../../components/IndicadorAvance'
import { AccionVinculo, EnlaceVinculo, FilaVinculo } from './FilaVinculo'
import { fraseAvanceDocumento, modoVinculo, PROMESA_REGRESO, ZONA_ANIDADA } from './vinculoAnidado'
import { AdjuntosPaso, BloqueVista } from './ProcedimientoVista'
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
    void Promise.all([db.progresoPasos.get(articuloId), leerModoEjecucion()]).then(([prog, modo]) => {
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
              // y el técnico se va a otro. Que quedó saltado ya lo dice
              // el índice, que lo deriva de la posición
              // (`estadoPasos.ts`). Y no cambia de vista: saltar es
              // seguir trabajando, así que el técnico sigue en el modo
              // que eligió.
              setHojaFalla(null)
              setIndiceActual(destinoSalto)
            }
      }
    />
  )

  // El foco ya no exige que el paso tenga tareas (G-18): un paso sin
  // ellas se presenta como una sola tarea con su título, así que el
  // modo no se cae solo a mitad de procedimiento. Lo único que lo
  // aparta es la preferencia del técnico o la falla declarada en ESTE
  // paso.
  const enFoco = modoEjecucion === 'foco' && nivel === 0 && pasoEnteroPorFalla !== paso.id

  if (enFoco) {
    return (
      <>
        <ModoFoco
          key={paso.id}
          paso={paso}
          indicePaso={indiceActual}
          totalPasos={pasos.length}
          tituloPaso={tituloPaso}
          instruccionesHechas={instruccionesHechas}
          onAlternarTarea={(tareaId) => void alternarTarea(indiceActual, paso, tareaId)}
          onCompletarPaso={avanzar}
          etiquetaAvance={etiquetaAvance}
          motivoBloqueo={motivoBloqueo}
          onVerPasoEntero={() => void cambiarModoEjecucion('pasoEntero')}
          onFalla={(texto) => setHojaFalla({ tarea: texto })}
        />
        {hojaDeFalla}
      </>
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
      ) : null}
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
            subArticuloId={paso.subArticuloId}
            tituloReferencia={paso.subArticuloTitulo}
            nivel={nivel}
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
              articuloId={articuloId}
              articuloTitulo={articulo?.titulo ?? ''}
              dispositivoId={dispositivoEvidencia.id}
              paso={paso}
              entradaId={progreso?.evidenciasPorPaso?.[paso.id] ?? null}
              conFalla={Boolean(fallaDelPaso)}
            />
          </div>
        )}
      </div>

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
      {/* Acción dominante fija al pie (M-011, regla M-R3, mockup `3b`).
          Hasta ahora "Atrás / Siguiente" vivían al final del scroll del
          paso, mientras la ficha de artículo sí fijaba su acción abajo
          (tarea 172): la contradicción se pagaba justo en la pantalla
          donde el pulgar trabaja de verdad, porque avanzar exigía
          recorrer el paso entero con una mano.

          Es `sticky`, no `fixed`: así reserva su propio hueco en el
          flujo y no tapa el final del paso.

          DOS FILAS desde el tablero 3d. La barra tiene ahora cuatro
          controles, y en 360 px una sola fila dejaba la acción dominante
          en 88 px, recortada a "Paso hecho · i...". Así que los dos que
          no son trabajo (volver y entrar al foco) suben a una fila de 44
          y la fila de abajo, la que cae bajo el pulgar, se queda con las
          dos que sí lo son: la contingencia y el avance, a 56 px.

          Y esta barra ya NO desaparece. Antes, cuando el paso tenía una
          contingencia vinculada y el trabajo previo completo, la
          pregunta "¿Ocurrió algún error?" la reemplazaba: la pantalla se
          quedaba sin acción dominante y el layout saltaba. Esa pregunta
          ya no existe, porque "Falla" es la pregunta, y está siempre.

          Los pasos anidados conservan su fila en línea: su avance lo
          decide el paso que los contiene, y dos acciones dominantes en
          la misma pantalla dejarían de ser dominantes. */}
      {nivel === 0 && (
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
              className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl border border-noct-divider text-noct-neutral-300 hover:bg-noct-text/[.07] disabled:opacity-30"
            >
              <CaretLeft size={18} aria-hidden />
            </button>
            {/* El regreso a la ejecución normal (tarea 217). Ya no es
                "Foco", un modo opcional que había que descubrir, sino
                la vuelta a como se trabaja aquí: una tarea a la vez.
                Está siempre, también en los pasos sin tareas, porque
                el foco ya sabe presentarlos. */}
            <button
              type="button"
              onClick={() => void cambiarModoEjecucion('foco')}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-noct-accent/50 bg-noct-accent/10 px-3 text-[14.5px] font-medium text-noct-accent-300 hover:bg-noct-accent/[.22]"
            >
              <Crosshair size={18} className="shrink-0" aria-hidden />
              <span className="truncate">Volver a una tarea a la vez</span>
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {/* "Falla" de 56 px, permanente. La etiqueta es corta a
                propósito: así la acción dominante conserva su ancho y
                ninguna de las dos se recorta. */}
            <button
              type="button"
              onClick={() => setHojaFalla({ tarea: null })}
              aria-haspopup="dialog"
              aria-label={`Algo va mal en el paso ${indiceActual + 1}`}
              className="flex h-[56px] shrink-0 items-center gap-2 rounded-xl border-[1.5px] border-noct-precaucion/60 bg-noct-precaucion/10 px-3.5 text-[14.5px] font-medium text-noct-precaucion active:bg-noct-precaucion/[.24]"
            >
              <Warning size={19} className="shrink-0" aria-hidden />
              Falla
            </button>
            <button
              type="button"
              disabled={!pasoActualHecho && !trabajoPrevio}
              onClick={avanzar}
              className="flex h-[56px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-noct-accent bg-noct-accent/[.12] px-3 text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.18] active:bg-noct-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent disabled:opacity-30"
            >
              <Check size={17} className="shrink-0" aria-hidden />
              <span className="truncate">{etiquetaAvance}</span>
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
          <button
            type="button"
            disabled={!trabajoPrevio}
            onClick={() => void intentarCompletarPaso(indiceActual, paso)}
            className={`${BTN_PRIMARIO} min-h-11 flex-1 text-sm disabled:opacity-30`}
          >
            Siguiente
            <CaretRight size={15} aria-hidden />
          </button>
        </div>
      )}
      {hojaDeFalla}
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
  conFalla,
}: {
  articuloId: string
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
    await registrarEvidenciaPaso(articuloId, paso.id, id)
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
  const progreso = useLiveQuery(() => db.progresoPasos.get(subArticuloId), [subArticuloId])
  const procedimiento = useMemo(
    () => normalizarProcedimiento(articulo && !articulo.eliminadoEn ? articulo.procedimiento : null),
    [articulo],
  )
  // Llega abierta, como en la vista de lectura: el paso no se completa
  // hasta que la guía anidada termine. Se puede cerrar con el mismo
  // gesto con el que se cierra la contingencia.
  const [cerrado, setCerrado] = useState(false)

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
  const total = procedimiento?.pasos.length ?? 0
  const hechos = procedimiento
    ? contarHechos(progreso?.pasosHechos ?? [], procedimiento.pasos.map((paso) => paso.id))
    : 0
  const anillo =
    total > 0 ? <IndicadorAvance hechos={hechos} total={total} size={22} className="shrink-0" /> : undefined

  // Misma regla de un solo nivel que ProcedimientoVista: mas alla se
  // enlaza, sin ejecutar aqui, y evita cualquier ciclo de vinculos. Y
  // ahora SE NOTA que solo enlaza (regla R58 del turno 12): antes la
  // tarjeta enlazada y la desplegable eran el mismo marco de acento con
  // el mismo icono, así que tocar una salía de la pantalla y tocar la
  // otra no, sin nada que lo anunciara.
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
  const progreso = useLiveQuery(() => db.progresoPasos.get(solucionArticuloId), [solucionArticuloId])
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
    await reiniciarProgreso(solucionArticuloId)
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
