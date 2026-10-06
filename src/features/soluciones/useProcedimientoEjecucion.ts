import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db, type PasoProcedimiento, type Procedimiento } from '../../lib/db'
import {
  normalizarProcedimiento,
  pasoTrabajoPrevioCompleto,
  procedimientoEjecutable,
  siguientePasoPendiente,
  tareasDe,
} from '../../lib/procedimiento'
import {
  alternarInstruccionHecha,
  alternarVerificacionFinal,
  avanceDe,
  contarInstruccionesHechas,
  establecerPasoHecho,
  hayAvanceEnEjecucion,
  leerAvance,
  raizDe,
  registrarEleccion,
  verificacionFinalCompleta,
} from '../../lib/progresoPasos'
import {
  aplicarEleccion,
  avanceDeLaRuta,
  decisionDeRuta,
  guiaDeLaRespuesta,
  guiasDeLasOpciones,
  hechosDeRuta,
  largoDeLaRuta,
  opcionElegida,
  rutaDe,
  type Elecciones,
} from '../../lib/rutaProcedimiento'
import { guiaTerminada } from './cierrePaso'
import { useClaveProgreso } from './contextoEjecucion'
import {
  guiasObligatoriasDeTarea,
  guiasObligatoriasPendientes,
  idsGuiasObligatoriasDelPaso,
} from './guiasObligatorias'

interface Opciones {
  articuloId: string
  procedimiento: Procedimiento
  // 0 = procedimiento principal; 1 = subprocedimiento o solucion de un
  // paso de nivel 0. Mas alla del nivel 1 los vinculos solo se
  // muestran como enlace (no se ejecutan aqui), asi que este hook no
  // les calcula subprocedimientos propios.
  nivel: number
  // Aviso hacia arriba cuando el ULTIMO paso pendiente se completa:
  // asi un subprocedimiento o una solucion que terminan completan
  // tambien el paso del nivel anterior que los vincula.
  onCompletado?: () => void
  // A que paso ir (o null si el procedimiento ya no tiene pendientes),
  // por su posicion en la RUTA (tarea 302), que es lo que las vistas
  // recorren. Quien use el hook decide que significa eso en su interfaz:
  // la lista lo expande y hace scroll, el asistente cambia de pantalla.
  onAvanzar: (destino: number | null) => void
}

// Logica de ejecucion de un procedimiento, compartida entre la vista
// de lista ("mapa" del procedimiento, ProcedimientoVista.tsx) y el modo
// asistente (un paso a la vez, AsistenteVista.tsx). Un paso es un
// contenedor de tareas: no se da por completado ni avanza hasta
// terminar TODO su contenido (sus tareas propias, su subprocedimiento
// vinculado y, si aplica, responder la pregunta de error).
//
// LA EJECUCIÓN RECORRE LA RUTA (tarea 302). Con decisiones con opciones,
// los pasos que se ejecutan son los de la ruta que marcan las respuestas
// dadas (`rutaDe`), no todos los de la guía: los índices, el avance, el
// paso siguiente y terminar se cuentan sobre ella, así que los pasos de los
// caminos no elegidos no existen para quien ejecuta. Sin decisiones con
// opciones, la ruta son todos los pasos en su orden, como siempre.
export function useProcedimientoEjecucion({
  articuloId,
  procedimiento,
  nivel,
  onCompletado,
  onAvanzar,
}: Opciones) {
  // DONDE VIVE ESTE AVANCE (tarea 2 del encargo). En el nivel 0 es la
  // fila del articulo; en un nivel anidado, la entrada de ESTA
  // ejecucion dentro de la fila de la guia principal. Nunca la fila
  // propia del vinculado: eso hacia que una guia completada en otra
  // ocasion diera por cumplido el vinculo de hoy.
  const clave = useClaveProgreso(articuloId, nivel)
  const raizId = raizDe(clave)
  // `null` = no hay fila; `undefined` = todavía se está leyendo. Hay que
  // distinguirlos (2026-09-17): la vista de una acción a la vez decide en
  // qué acción arranca al montarse, y con la lectura a medias creía que
  // no había nada hecho y abría una guía retomada en una acción ya hecha.
  const filaLeida = useLiveQuery(async () => (await db.progresoPasos.get(raizId)) ?? null, [raizId])
  const avanceCargado = filaLeida !== undefined
  const filaRaiz = filaLeida ?? undefined
  const progreso = avanceDe(filaRaiz, clave)
  const { verificacionFinal } = procedimiento

  // LAS RESPUESTAS DE ESTA EJECUCIÓN Y SU RUTA. La consulta viva entrega un
  // objeto nuevo en cada lectura; la firma hace que la ruta (y con ella la
  // lista de pasos que reciben las vistas) solo cambie cuando cambia una
  // respuesta, no cada vez que se marca una tarea.
  const firmaElecciones = JSON.stringify(progreso?.elecciones ?? {})
  const elecciones = useMemo(() => JSON.parse(firmaElecciones) as Elecciones, [firmaElecciones])
  const ruta = useMemo(() => rutaDe(procedimiento, elecciones), [procedimiento, elecciones])
  const pasos = ruta.pasos
  const idsPasos = useMemo(() => pasos.map((p) => p.id), [pasos])
  // El total de la ruta entera, o null si todavía depende de una respuesta
  // cuyos caminos no miden lo mismo (entonces no se afirma).
  const largo = useMemo(() => largoDeLaRuta(procedimiento, elecciones), [procedimiento, elecciones])
  const totalPasos = largo.minimo === largo.maximo ? largo.minimo : null

  // El paso de una decisión sin responder no cuenta como hecho aunque un
  // dato viejo lo tenga marcado: su respuesta es la que dice por dónde se
  // sigue (`hechosDeRuta`).
  const hechos = hechosDeRuta(ruta, progreso?.pasosHechos)
  const instruccionesHechas = new Set(progreso?.instruccionesHechas ?? [])
  const completados = pasos.filter((p) => hechos.has(p.id)).length
  const pasosCompletados = pasos.length > 0 && ruta.pendiente === null && completados === pasos.length
  const verificacionCompleta = verificacionFinalCompleta(progreso?.verificacionHecha, verificacionFinal.length)
  const todoCompletado = pasosCompletados && verificacionCompleta

  // Ids de los subprocedimientos vinculados de este nivel: se
  // consultan en vivo para saber cuales estan completos, porque un
  // paso no se da por terminado mientras su subprocedimiento siga
  // pendiente. Solo el nivel 0 los ejecuta inline; mas profundo se
  // muestran como enlace y no cuentan como trabajo del paso.
  //
  // Desde el 2026-09-09 la lista incluye tambien las guias con
  // intencion 'necesario' colgadas de una TAREA: se mostraban pero no
  // condicionaban nada, asi que "Marcar hecha" funcionaba con la guia
  // sin empezar (encargo, tarea 1). Y desde la tarea 302, las que abren
  // las respuestas de las decisiones. Se miran todos los pasos, no solo los
  // de la ruta: cambiar una respuesta no obliga a volver a leer nada.
  const subIds = useMemo(
    () =>
      nivel === 0
        ? [
            ...new Set([
              ...procedimiento.pasos.map((p) => p.subArticuloId).filter((id): id is string => Boolean(id)),
              ...procedimiento.pasos.flatMap((p) => idsGuiasObligatoriasDelPaso(p)),
              ...procedimiento.pasos.flatMap(guiasDeLasOpciones),
            ]),
          ]
        : [],
    [procedimiento.pasos, nivel],
  )
  const subArticulos = useLiveQuery(() => db.articulos.bulkGet(subIds), [subIds])
  // El avance de cada vinculo se lee de ESTA ejecucion, no de la fila
  // del articulo vinculado (tarea 2). Un vinculo sin entrada aqui esta
  // pendiente, aunque esa guia se haya completado antes en otro sitio.
  const vinculos = filaRaiz?.vinculos

  // ¿El subprocedimiento vinculado del paso ya no impone trabajo
  // pendiente? True cuando no hay subprocedimiento que ejecutar aqui
  // (sin vinculo, nivel profundo, vinculo roto o sin pasos) o cuando el
  // vinculado quedo completo. Version reactiva (live query) para decidir
  // que se muestra; mientras cargan los datos devuelve false para no
  // dar el paso por terminado antes de tiempo.
  // ¿Esta guia vinculada ya no impone trabajo? Una guia que no esta en
  // el dispositivo, o que no tiene pasos, cuenta como cumplida: no se
  // puede exigir lo que no se puede abrir, y bloquear ahi dejaria la
  // tarea sin salida (criterio A12). "Terminada" sobre su propia ruta: una
  // guía reutilizada también puede tener decisiones con opciones.
  function guiaCumplidaReactiva(guiaId: string): boolean {
    if (nivel >= 1) return true
    // Solo se espera al ARTICULO: sin el no se sabe si el vinculo
    // existe, y un vinculo roto no bloquea (criterio A12). El avance
    // ausente no es "cargando", es "sin empezar", que es la respuesta
    // correcta mientras la fila de la ejecucion no exista todavia.
    if (subArticulos === undefined) return false
    const idx = subIds.indexOf(guiaId)
    const articulo = idx >= 0 ? subArticulos[idx] : undefined
    if (!articulo || articulo.eliminadoEn) return true
    const proc = normalizarProcedimiento(articulo.procedimiento)
    if (!proc) return true
    const prog = vinculos?.[guiaId]
    return guiaTerminada(proc, prog?.pasosHechos, prog?.verificacionHecha, prog?.elecciones)
  }

  // La misma pregunta con lectura fresca, para decidir una escritura
  // sin depender de cuando refresque la live query.
  async function guiaCumplidaFresca(guiaId: string): Promise<boolean> {
    if (nivel >= 1) return true
    const articulo = await db.articulos.get(guiaId)
    if (!articulo || articulo.eliminadoEn) return true
    const proc = normalizarProcedimiento(articulo.procedimiento)
    if (!proc) return true
    const prog = (await db.progresoPasos.get(raizId))?.vinculos?.[guiaId]
    return guiaTerminada(proc, prog?.pasosHechos, prog?.verificacionHecha, prog?.elecciones)
  }

  /**
   * Las guias obligatorias que esta tarea todavia no ha cumplido, en el
   * orden del editor. Vacio cuando la tarea no exige ninguna o cuando
   * ya estan todas. Lo consultan las DOS vistas de ejecucion.
   */
  function guiasPendientesDeTarea(paso: PasoProcedimiento, tareaId: string) {
    if (nivel >= 1) return []
    return guiasObligatoriasPendientes(guiasObligatoriasDeTarea(paso, tareaId), guiaCumplidaReactiva)
  }

  function subSatisfechoReactivo(paso: PasoProcedimiento): boolean {
    if (!paso.subArticuloId || nivel >= 1) return true
    return guiaCumplidaReactiva(paso.subArticuloId)
  }

  // Misma pregunta pero con lecturas frescas de la base, para decidir
  // el completado sin depender del momento en que refrescan las live
  // queries (por ejemplo, justo cuando el subprocedimiento termina y
  // avisa hacia arriba).
  async function subSatisfechoFresco(paso: PasoProcedimiento): Promise<boolean> {
    if (!paso.subArticuloId || nivel >= 1) return true
    return guiaCumplidaFresca(paso.subArticuloId)
  }

  // LA GUÍA QUE ABRE LA RESPUESTA ELEGIDA (tarea 302): se hace en el flujo,
  // justo después de la decisión, y el paso no se cierra hasta terminarla,
  // igual que la guía del paso. Solo se exige la que se puede hacer aquí
  // (`guiaIntegrable`): la que no está en el dispositivo no bloquea (A12).
  function respuestaSatisfechaReactiva(paso: PasoProcedimiento): boolean {
    const guia = guiaDeLaRespuesta(paso, elecciones)
    return !guia || !guiaIntegrable(guia.articuloId) || guiaCumplidaReactiva(guia.articuloId)
  }

  async function respuestaSatisfechaFresca(paso: PasoProcedimiento, actuales: Elecciones | undefined): Promise<boolean> {
    const guia = guiaDeLaRespuesta(paso, actuales)
    return !guia || !guiaIntegrable(guia.articuloId) || guiaCumplidaFresca(guia.articuloId)
  }

  /** El nombre de la guía de la respuesta mientras siga sin terminar, o null: es lo que nombra el control del paso. */
  function guiaPendienteDeLaRespuesta(paso: PasoProcedimiento): string | null {
    const guia = guiaDeLaRespuesta(paso, elecciones)
    return guia && !respuestaSatisfechaReactiva(paso) ? guia.titulo : null
  }

  /**
   * ¿Hay algo hecho DESPUÉS de la decisión de este paso, en su ruta o en la
   * guía que abrió su respuesta? Cambiar la respuesta lo reinicia
   * (`aplicarEleccion`), así que se avisa antes de tocar otra opción.
   */
  function hayAvanceTrasLaDecision(paso: PasoProcedimiento): boolean {
    const desde = idsPasos.indexOf(paso.id)
    if (desde < 0) return false
    const enLaRuta = pasos
      .slice(desde + 1)
      .some((p) => hechos.has(p.id) || tareasDe(p.bloques).some((t) => instruccionesHechas.has(t.id)))
    const guia = guiaDeLaRespuesta(paso, elecciones)
    return enLaRuta || (guia !== null && hayAvanceEnEjecucion(vinculos?.[guia.articuloId]))
  }

  // ¿Se puede MARCAR esta tarea ahora mismo? Con lectura fresca, y con
  // una sola respuesta para las dos vistas: si la regla viviera en cada
  // pantalla, una podria validar y la otra no.
  async function tareaMarcable(paso: PasoProcedimiento, tareaId: string): Promise<boolean> {
    if (nivel >= 1) return true
    const guias = guiasObligatoriasDeTarea(paso, tareaId)
    for (const g of guias) {
      if (g.guiaArticuloId && !(await guiaCumplidaFresca(g.guiaArticuloId))) return false
    }
    return true
  }

  // Avance automatico despues de completar el paso del indice dado.
  //
  // SIN PASOS PENDIENTES TODAVIA NO SE TERMINO (encargo del 2026-09-09,
  // tarea 4). Aqui se avisaba al padre en cuanto caia el ultimo paso,
  // asi que una guia vinculada con comprobaciones finales daba por
  // cerrado el paso que la exigia sin que nadie las hiciera, y el
  // tecnico volvia al procedimiento principal sin haberlas visto. El
  // aviso hacia arriba espera ahora a que esten hechas; mientras tanto
  // `onAvanzar(null)` lleva a la pantalla que las pide.
  //
  // Sobre la ruta con las respuestas de AHORA (tarea 302), leídas de la
  // base y no de la última pintura: el índice del paso cerrado es el mismo
  // en las dos, porque una respuesta solo cambia lo que viene después de su
  // decisión.
  async function avanzarDespuesDe(indice: number, hechosNuevos: ReadonlySet<string>, actuales: Elecciones | undefined) {
    const rutaActual = rutaDe(procedimiento, actuales)
    const destino = siguientePasoPendiente(
      rutaActual.pasos.map((p) => p.id),
      hechosDeRuta(rutaActual, [...hechosNuevos]),
      indice,
    )
    if (destino !== null) {
      onAvanzar(destino)
      return
    }
    const prog = await leerAvance(clave)
    if (verificacionFinalCompleta(prog?.verificacionHecha, verificacionFinal.length)) {
      onCompletado?.()
    }
    onAvanzar(null)
  }

  /**
   * Marca o desmarca una comprobacion final y, si con eso el documento
   * queda terminado (pasos Y comprobaciones), avisa al procedimiento
   * que lo vincula. Es el ultimo tramo de la tarea 4: sin esto, hacer
   * la ultima comprobacion de una guia vinculada no devolvia el control
   * a la guia principal.
   */
  async function alternarVerificacion(indice: number) {
    await alternarVerificacionFinal(clave, indice)
    const prog = await leerAvance(clave)
    if (
      avanceDeLaRuta(procedimiento, prog).pasosListos &&
      verificacionFinalCompleta(prog?.verificacionHecha, verificacionFinal.length)
    ) {
      onCompletado?.()
    }
  }

  /**
   * Deshace el cierre de un paso ya hecho. Es lo UNICO que queda del
   * antiguo `alternarPaso` (tarea 3 del encargo): marcarlo con un toque
   * arrastraba tambien todas sus tareas, es decir daba por hecho un
   * trabajo que nadie hizo. Cerrar un paso pasa siempre por
   * `intentarCompletarPaso`, que exige lo que el paso exige.
   *
   * Desmarcar SI arrastra las tareas: quien desmarca se esta
   * corrigiendo, y dejar el paso pendiente con todo marcado lo volveria
   * a cerrar al primer cambio.
   */
  async function desmarcarPaso(paso: PasoProcedimiento) {
    if (!hechos.has(paso.id)) return
    await establecerPasoHecho(
      clave,
      paso.id,
      false,
      tareasDe(paso.bloques).map((t) => t.id),
    )
  }

  async function alternarTarea(indice: number, paso: PasoProcedimiento, tareaId: string) {
    // MARCAR exige tener hechas sus guias obligatorias; DESMARCAR no,
    // porque quien desmarca se esta corrigiendo. La comprobacion vive
    // aqui, en el unico punto por el que pasan las dos vistas, para que
    // no quede una ruta alternativa que la omita.
    if (!instruccionesHechas.has(tareaId) && !(await tareaMarcable(paso, tareaId))) return

    const tareasCompletas = await alternarInstruccionHecha(
      clave,
      paso.id,
      tareaId,
      tareasDe(paso.bloques).map((t) => t.id),
    )
    // Completar las tareas no avanza por si solo: el paso es un
    // contenedor y aun puede quedar un subprocedimiento o una pregunta
    // de error pendientes. intentarCompletarPaso decide.
    if (tareasCompletas) await intentarCompletarPaso(indice, paso)
  }

  // Intenta completar el paso tratandolo como un contenedor de tareas:
  // solo lo marca hecho y avanza cuando su trabajo previo (tareas
  // propias, subprocedimiento vinculado y la guía que abre la respuesta de
  // su decisión) esta completo. Una decisión con opciones sin responder
  // tampoco lo deja cerrar: lo que sigue depende de ella. Usa lecturas
  // frescas de la base.
  async function intentarCompletarPaso(indice: number, paso: PasoProcedimiento) {
    const progActual = await leerAvance(clave)
    const hechosActuales = progActual?.pasosHechos ?? []
    if (hechosActuales.includes(paso.id)) return

    const decision = decisionDeRuta(paso)
    if (decision && opcionElegida(decision, progActual?.elecciones) === null) return

    const idsTareas = tareasDe(paso.bloques).map((t) => t.id)
    const tareasMarcadas = contarInstruccionesHechas(progActual?.instruccionesHechas, idsTareas)
    const reutilizadoHecho =
      (await subSatisfechoFresco(paso)) && (await respuestaSatisfechaFresca(paso, progActual?.elecciones))
    if (!pasoTrabajoPrevioCompleto(idsTareas.length, tareasMarcadas, reutilizadoHecho)) return

    // Sin arrastrar tareas: llegado aqui ya estan todas marcadas, y
    // pasarlas seria conservar la unica via que completaba trabajo sin
    // hacerlo (tarea 3 del encargo).
    await establecerPasoHecho(clave, paso.id, true)
    await avanzarDespuesDe(indice, new Set([...hechosActuales, paso.id]), progActual?.elecciones)
  }

  // Completa el paso y sigue de largo, sin la validacion previa: lo usa
  // la contingencia que se resuelve cuando al paso ya no le quedaba
  // trabajo (quien llama lo comprueba antes). Tampoco arrastra tareas.
  async function completarPasoYAvanzar(indice: number, paso: PasoProcedimiento) {
    if (hechos.has(paso.id)) return
    await establecerPasoHecho(clave, paso.id, true)
    await avanzarDespuesDe(indice, new Set([...hechos, paso.id]), elecciones)
  }

  // RESPONDER UNA DECISIÓN CON OPCIONES (tarea 302). Se guarda la respuesta
  // (`aplicarEleccion`: cambiar una ya dada reinicia lo de después) y,
  // cuando la ruta viva ya la refleja, la ejecución sigue por ella: cierra
  // el paso y lleva al destino o, si el paso ya estaba cerrado, lleva al
  // siguiente pendiente de la ruta nueva. Esperar a la ruta viva evita
  // pintar un instante, con la ruta de antes, el paso de otro camino.
  const [trasResponder, setTrasResponder] = useState<{ pasoId: string; decisionId: string; opcionId: string } | null>(
    null,
  )

  async function elegirOpcion(paso: PasoProcedimiento, decisionId: string, opcionId: string) {
    const aplicada = aplicarEleccion(procedimiento, await leerAvance(clave), { decisionId, opcionId })
    await registrarEleccion(clave, aplicada)
    setTrasResponder({ pasoId: paso.id, decisionId, opcionId })
  }

  async function seguirTrasResponder(indice: number, paso: PasoProcedimiento) {
    const prog = await leerAvance(clave)
    if (!(prog?.pasosHechos ?? []).includes(paso.id)) {
      await intentarCompletarPaso(indice, paso)
      return
    }
    await avanzarDespuesDe(indice, new Set(prog?.pasosHechos), prog?.elecciones)
  }

  const respuestaEnRuta = trasResponder !== null && elecciones[trasResponder.decisionId] === trasResponder.opcionId
  useEffect(() => {
    if (!trasResponder || !respuestaEnRuta) return
    setTrasResponder(null)
    const indice = idsPasos.indexOf(trasResponder.pasoId)
    if (indice >= 0) void seguirTrasResponder(indice, pasos[indice])
    // Solo cuando la respuesta llega a la ruta: el resto se lee fresco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trasResponder, respuestaEnRuta])

  // `guiaDelPasoEnLinea` se retiro el 2026-09-10 (encargo, tarea 4):
  // existia para saber si la guia vinculada traia su propia zona de
  // acciones mientras compartia pantalla con la tarea. Ya no la
  // comparte: la sustituye, asi que nunca hay dos zonas que arbitrar.

  // ¿La guia vinculada del paso esta EN ESTE DISPOSITIVO? Distinta
  // pregunta que `subSatisfechoReactivo`, que responde true tambien
  // cuando el vinculo esta roto (para no dejar el paso sin salida).
  // Quien pinta necesita separarlas: un vinculo roto no bloquea, pero
  // tiene que verse y explicarse (criterio A12).
  function guiaDelPasoDisponible(paso: PasoProcedimiento): boolean {
    if (!paso.subArticuloId || nivel >= 1) return true
    if (subArticulos === undefined) return true
    const idx = subIds.indexOf(paso.subArticuloId)
    const articulo = idx >= 0 ? subArticulos[idx] : undefined
    return Boolean(articulo && !articulo.eliminadoEn)
  }

  // ¿Una guía que esta ejecución reutiliza se HACE AQUÍ, como parte de este
  // flujo (tarea 289, fase 3)? Solo en la ejecución principal, con la guía
  // en el dispositivo y con pasos que ejecutar: es la misma condición que
  // `modoVinculo` llama "expandible". Vale para la guía de un paso, para la
  // que una tarea exige ('necesario') y para la que abre una respuesta. Si
  // no, se ofrece para consultarla aparte, o se explica que no está.
  function guiaIntegrable(guiaId: string): boolean {
    if (nivel >= 1 || subArticulos === undefined) return false
    const idx = subIds.indexOf(guiaId)
    const articulo = idx >= 0 ? subArticulos[idx] : undefined
    if (!articulo || articulo.eliminadoEn) return false
    return procedimientoEjecutable(normalizarProcedimiento(articulo.procedimiento))
  }

  function guiaDelPasoIntegrable(paso: PasoProcedimiento): boolean {
    return paso.subArticuloId ? guiaIntegrable(paso.subArticuloId) : false
  }

  return {
    avanceCargado,
    // Las guías que reutiliza esta ejecución ya se leyeron: hasta entonces
    // no se sabe si un paso las hace aquí o las ofrece aparte, y decidirlo
    // a medias haría saltar la pantalla de una forma a la otra.
    vinculosCargados: subArticulos !== undefined,
    progreso,
    // La ruta de esta ejecución (tarea 302): sus pasos son los que las
    // vistas recorren y numeran, y `totalPasos` el total que se puede
    // afirmar (null mientras dependa de una respuesta).
    ruta,
    pasos,
    totalPasos,
    elecciones,
    hechos,
    instruccionesHechas,
    completados,
    pasosCompletados,
    verificacionCompleta,
    todoCompletado,
    subSatisfechoReactivo,
    respuestaSatisfechaReactiva,
    guiaPendienteDeLaRespuesta,
    hayAvanceTrasLaDecision,
    guiaCumplida: guiaCumplidaReactiva,
    guiaDelPasoDisponible,
    guiaIntegrable,
    guiaDelPasoIntegrable,
    guiasPendientesDeTarea,
    desmarcarPaso,
    alternarTarea,
    alternarVerificacion,
    intentarCompletarPaso,
    completarPasoYAvanzar,
    elegirOpcion,
  }
}
