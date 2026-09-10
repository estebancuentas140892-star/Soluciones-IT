import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type PasoProcedimiento, type Procedimiento } from '../../lib/db'
import {
  normalizarProcedimiento,
  pasoTrabajoPrevioCompleto,
  siguientePasoPendiente,
  tareasDe,
} from '../../lib/procedimiento'
import {
  alternarInstruccionHecha,
  avanceDe,
  contarHechos,
  contarInstruccionesHechas,
  establecerPasoHecho,
  leerAvance,
  raizDe,
  verificacionFinalCompleta,
} from '../../lib/progresoPasos'
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
  // A que paso ir (o null si el procedimiento ya no tiene pendientes).
  // Quien use el hook decide que significa eso en su interfaz: la
  // lista lo expande y hace scroll, el asistente cambia de pantalla.
  onAvanzar: (destino: number | null) => void
}

// Logica de ejecucion de un procedimiento, compartida entre la vista
// de lista ("mapa" del procedimiento, ProcedimientoVista.tsx) y el modo
// asistente (un paso a la vez, AsistenteVista.tsx). Un paso es un
// contenedor de tareas: no se da por completado ni avanza hasta
// terminar TODO su contenido (sus tareas propias, su subprocedimiento
// vinculado y, si aplica, responder la pregunta de error).
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
  const filaRaiz = useLiveQuery(() => db.progresoPasos.get(raizId), [raizId])
  const progreso = avanceDe(filaRaiz, clave)
  const { pasos, verificacionFinal } = procedimiento
  const idsPasos = useMemo(() => pasos.map((p) => p.id), [pasos])

  const hechos = new Set(progreso?.pasosHechos ?? [])
  const instruccionesHechas = new Set(progreso?.instruccionesHechas ?? [])
  const completados = contarHechos(progreso?.pasosHechos ?? [], idsPasos)
  const pasosCompletados = pasos.length > 0 && completados === pasos.length
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
  // sin empezar (encargo, tarea 1).
  const subIds = useMemo(
    () =>
      nivel === 0
        ? [
            ...new Set([
              ...pasos.map((p) => p.subArticuloId).filter((id): id is string => Boolean(id)),
              ...pasos.flatMap((p) => idsGuiasObligatoriasDelPaso(p)),
            ]),
          ]
        : [],
    [pasos, nivel],
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
  // tarea sin salida (criterio A12).
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
    const hechosSub = contarHechos(prog?.pasosHechos ?? [], proc.pasos.map((p) => p.id))
    return hechosSub === proc.pasos.length
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
    const hechosSub = contarHechos(prog?.pasosHechos ?? [], proc.pasos.map((p) => p.id))
    return hechosSub === proc.pasos.length
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

  // Avance automatico despues de completar el paso del indice dado. Si
  // no queda ninguno pendiente, el procedimiento termino: se avisa al
  // padre (por si este hook describe un subprocedimiento o solucion
  // vinculados a un paso de otro procedimiento) y se avisa a quien usa
  // el hook con destino null.
  function avanzarDespuesDe(indice: number, hechosNuevos: ReadonlySet<string>) {
    const destino = siguientePasoPendiente(idsPasos, hechosNuevos, indice)
    if (destino === null) onCompletado?.()
    onAvanzar(destino)
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
  // propias + subprocedimiento vinculado) esta completo y no tiene una
  // solucion de error vinculada. Si tiene solucion, no avanza aqui:
  // aparece la pregunta "¿Ocurrio algun error?" y el paso se completa
  // al responderla. Usa lecturas frescas de la base.
  async function intentarCompletarPaso(indice: number, paso: PasoProcedimiento) {
    const progActual = await leerAvance(clave)
    const hechosActuales = progActual?.pasosHechos ?? []
    if (hechosActuales.includes(paso.id)) return

    const idsTareas = tareasDe(paso.bloques).map((t) => t.id)
    const tareasMarcadas = contarInstruccionesHechas(progActual?.instruccionesHechas, idsTareas)
    const trabajoPrevio = pasoTrabajoPrevioCompleto(
      idsTareas.length,
      tareasMarcadas,
      await subSatisfechoFresco(paso),
    )
    if (!trabajoPrevio) return

    // Sin arrastrar tareas: llegado aqui ya estan todas marcadas, y
    // pasarlas seria conservar la unica via que completaba trabajo sin
    // hacerlo (tarea 3 del encargo).
    await establecerPasoHecho(clave, paso.id, true)
    avanzarDespuesDe(indice, new Set([...hechosActuales, paso.id]))
  }

  // Completa el paso y sigue de largo, sin la validacion previa: lo usa
  // la contingencia que se resuelve cuando al paso ya no le quedaba
  // trabajo (quien llama lo comprueba antes). Tampoco arrastra tareas.
  async function completarPasoYAvanzar(indice: number, paso: PasoProcedimiento) {
    if (hechos.has(paso.id)) return
    await establecerPasoHecho(clave, paso.id, true)
    avanzarDespuesDe(indice, new Set([...hechos, paso.id]))
  }

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

  return {
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
    desmarcarPaso,
    alternarTarea,
    intentarCompletarPaso,
    completarPasoYAvanzar,
  }
}
