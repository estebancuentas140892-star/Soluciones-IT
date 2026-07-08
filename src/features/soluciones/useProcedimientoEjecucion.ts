import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type PasoProcedimiento, type Procedimiento } from '../../lib/db'
import {
  normalizarProcedimiento,
  pasoSeCompletaSolo,
  pasoTrabajoPrevioCompleto,
  siguientePasoPendiente,
  tareasDe,
} from '../../lib/procedimiento'
import {
  alternarInstruccionHecha,
  contarHechos,
  contarInstruccionesHechas,
  establecerPasoHecho,
  verificacionFinalCompleta,
} from '../../lib/progresoPasos'

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
  const progreso = useLiveQuery(() => db.progresoPasos.get(articuloId), [articuloId])
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
  const subIds = useMemo(
    () =>
      nivel === 0
        ? [...new Set(pasos.map((p) => p.subArticuloId).filter((id): id is string => Boolean(id)))]
        : [],
    [pasos, nivel],
  )
  const subArticulos = useLiveQuery(() => db.articulos.bulkGet(subIds), [subIds])
  const subProgresos = useLiveQuery(() => db.progresoPasos.bulkGet(subIds), [subIds])

  // ¿El subprocedimiento vinculado del paso ya no impone trabajo
  // pendiente? True cuando no hay subprocedimiento que ejecutar aqui
  // (sin vinculo, nivel profundo, vinculo roto o sin pasos) o cuando el
  // vinculado quedo completo. Version reactiva (live query) para decidir
  // que se muestra; mientras cargan los datos devuelve false para no
  // dar el paso por terminado antes de tiempo.
  function subSatisfechoReactivo(paso: PasoProcedimiento): boolean {
    if (!paso.subArticuloId || nivel >= 1) return true
    if (subArticulos === undefined || subProgresos === undefined) return false
    const idx = subIds.indexOf(paso.subArticuloId)
    const articulo = idx >= 0 ? subArticulos[idx] : undefined
    if (!articulo || articulo.eliminadoEn) return true
    const proc = normalizarProcedimiento(articulo.procedimiento)
    if (!proc) return true
    const prog = idx >= 0 ? subProgresos[idx] : undefined
    const hechosSub = contarHechos(prog?.pasosHechos ?? [], proc.pasos.map((p) => p.id))
    return hechosSub === proc.pasos.length
  }

  // Misma pregunta pero con lecturas frescas de la base, para decidir
  // el completado sin depender del momento en que refrescan las live
  // queries (por ejemplo, justo cuando el subprocedimiento termina y
  // avisa hacia arriba).
  async function subSatisfechoFresco(paso: PasoProcedimiento): Promise<boolean> {
    if (!paso.subArticuloId || nivel >= 1) return true
    const articulo = await db.articulos.get(paso.subArticuloId)
    if (!articulo || articulo.eliminadoEn) return true
    const proc = normalizarProcedimiento(articulo.procedimiento)
    if (!proc) return true
    const prog = await db.progresoPasos.get(paso.subArticuloId)
    const hechosSub = contarHechos(prog?.pasosHechos ?? [], proc.pasos.map((p) => p.id))
    return hechosSub === proc.pasos.length
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

  async function alternarPaso(indice: number, paso: PasoProcedimiento) {
    const hecho = hechos.has(paso.id)
    await establecerPasoHecho(
      articuloId,
      paso.id,
      !hecho,
      tareasDe(paso.bloques).map((t) => t.id),
    )
    if (!hecho) avanzarDespuesDe(indice, new Set([...hechos, paso.id]))
  }

  async function alternarTarea(indice: number, paso: PasoProcedimiento, tareaId: string) {
    const tareasCompletas = await alternarInstruccionHecha(
      articuloId,
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
    const progActual = await db.progresoPasos.get(articuloId)
    const hechosActuales = progActual?.pasosHechos ?? []
    if (hechosActuales.includes(paso.id)) return

    const idsTareas = tareasDe(paso.bloques).map((t) => t.id)
    const tareasMarcadas = contarInstruccionesHechas(progActual?.instruccionesHechas, idsTareas)
    const trabajoPrevio = pasoTrabajoPrevioCompleto(
      idsTareas.length,
      tareasMarcadas,
      await subSatisfechoFresco(paso),
    )
    if (!pasoSeCompletaSolo(trabajoPrevio, Boolean(paso.solucionArticuloId))) return

    await establecerPasoHecho(articuloId, paso.id, true, idsTareas)
    avanzarDespuesDe(indice, new Set([...hechosActuales, paso.id]))
  }

  // Completa el paso y sigue de largo, sin la validacion previa: lo
  // usan la respuesta "No" a la pregunta de error y la solucion que se
  // completa despues de un error (la pregunta solo aparece cuando el
  // trabajo previo del paso ya esta completo).
  async function completarPasoYAvanzar(indice: number, paso: PasoProcedimiento) {
    if (hechos.has(paso.id)) return
    await establecerPasoHecho(
      articuloId,
      paso.id,
      true,
      tareasDe(paso.bloques).map((t) => t.id),
    )
    avanzarDespuesDe(indice, new Set([...hechos, paso.id]))
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
    alternarPaso,
    alternarTarea,
    intentarCompletarPaso,
    completarPasoYAvanzar,
  }
}
