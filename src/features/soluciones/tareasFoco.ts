import type { BloquePaso, IntencionGuia, PasoProcedimiento, TipoTarea, VinculoProtegido } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'

// LO QUE EL MODO FOCO RECORRE (tarea 217, hallazgo G-18; ampliado el
// 2026-09-09 con la correccion de H05).
//
// Hasta la 217 el foco solo se montaba si el paso tenia tareas: un paso
// sin ellas expulsaba al tecnico a la vista completa a mitad de
// procedimiento. Con el foco convertido en la ejecucion por defecto eso
// rompia el modo, asi que el paso sin tareas se presenta como UNA sola
// tarea: su titulo, a los mismos 30 px, y marcarla completa el paso.
//
// LO QUE SE CORRIGE AHORA (H05, criterios A09 y A10). Un paso podia
// depender de OTRA GUIA (`subArticuloId`) y el foco no la mostraba en
// ningun sitio: solo escribia "Termina el procedimiento vinculado para
// poder avanzar" bajo un boton apagado. La guia existia, estaba
// vinculada y era alcanzable desde la vista completa, pero el recorrido
// visible no llevaba a ella, asi que en el modo por defecto el paso no
// tenia salida.
//
// La correccion es de recorrido, no de aviso: la guia vinculada ES una
// tarea del paso, y la primera, porque es su prerrequisito. Asi el
// tecnico la ve, la abre, la hace y el paso sigue. El mismo trato
// reciben las guias vinculadas a una TAREA concreta con intencion
// 'necesario' (bloques 'guia'): no se convierten en tareas propias,
// pero si condicionan la suya.

export type ClaseTareaFoco =
  // Un bloque 'tarea' del paso.
  | 'tarea'
  // Paso sin tareas: se presenta como una sola, con el titulo del paso.
  | 'paso-entero'
  // La guia vinculada del paso (`subArticuloId`), como primera tarea.
  | 'guia-del-paso'

export interface TareaFoco {
  id: string
  texto: string
  clase: ClaseTareaFoco
  // true solo en el paso sin tareas y sin guia: no hay bloque que
  // marcar, asi que el boton grande completa el paso directamente.
  esPasoEntero: boolean
  vinculoProtegido: VinculoProtegido | null
  // Clasificacion de la tarea (accion, verificacion, decision), para
  // que la vista no trate una comprobacion igual que una instruccion
  // (hallazgo H08). null en las entradas sinteticas.
  tipoTarea: TipoTarea | null
  // Guia que hay que completar en esta tarea, o null. En
  // 'guia-del-paso' es la del paso; en una tarea normal, la del bloque
  // 'guia' con intencion 'necesario' que le pertenezca.
  guiaId: string | null
  guiaTitulo: string
  intencionGuia: IntencionGuia | null
  // A donde lleva el "No" de una tarea de tipo 'decision', si el autor
  // le dio destino. El modo de una tarea a la vez lo necesita para
  // ofrecer las DOS respuestas con su consecuencia escrita: hasta el
  // 2026-09-09 una decision se pintaba ahi como una accion cualquiera,
  // con "Marcar hecha", asi que responder que si y responder que no
  // eran el mismo gesto y el destino del "no" no existia.
  decisionGuiaId: string | null
  decisionGuiaTitulo: string
}

/** Prefijo del id sintetico de la guia del paso dentro del recorrido. */
export function idTareaGuiaDelPaso(pasoId: string): string {
  return `guia:${pasoId}`
}

// La guia 'necesario' que cuelga de una tarea concreta, si la hay. Las
// de intencion 'consulta' y 'contingencia' NO se buscan aqui a
// proposito: por definicion no condicionan el avance (punto 6 de la
// seccion 5 del encargo), asi que son apoyo y no prerrequisito.
function guiaNecesariaDe(bloques: BloquePaso[], tareaId: string): BloquePaso | null {
  return (
    bloques.find(
      (b) =>
        b.tipo === 'guia' &&
        b.guiaArticuloId !== null &&
        b.intencionGuia === 'necesario' &&
        b.alcance === 'tarea' &&
        b.tareaId === tareaId,
    ) ?? null
  )
}

// El titulo llega ya resuelto por quien llama (`paso.titulo` puede
// estar vacio y caer en el del subarticulo o en "Paso N"), para no
// duplicar aqui esa cadena de respaldos.
export function tareasParaFoco(paso: PasoProcedimiento, tituloPaso: string): TareaFoco[] {
  const recorrido: TareaFoco[] = []

  // La guia vinculada del paso va PRIMERA: es lo que hay que tener
  // hecho para que el resto del paso tenga sentido, y es justo lo que
  // antes bloqueaba sin dejarse abrir.
  if (paso.subArticuloId) {
    recorrido.push({
      id: idTareaGuiaDelPaso(paso.id),
      texto: paso.subArticuloTitulo || 'Completar la guía vinculada',
      clase: 'guia-del-paso',
      esPasoEntero: false,
      vinculoProtegido: paso.vinculoProtegido,
      tipoTarea: null,
      guiaId: paso.subArticuloId,
      guiaTitulo: paso.subArticuloTitulo,
      intencionGuia: 'necesario',
      decisionGuiaId: null,
      decisionGuiaTitulo: '',
    })
  }

  const tareas = tareasDe(paso.bloques)
  for (const t of tareas) {
    const guia = guiaNecesariaDe(paso.bloques, t.id)
    recorrido.push({
      id: t.id,
      texto: t.texto,
      clase: 'tarea',
      esPasoEntero: false,
      vinculoProtegido: t.vinculoProtegido ?? paso.vinculoProtegido,
      tipoTarea: t.tipoTarea ?? 'accion',
      guiaId: guia?.guiaArticuloId ?? null,
      guiaTitulo: guia?.guiaArticuloTitulo ?? '',
      intencionGuia: guia ? 'necesario' : null,
      decisionGuiaId: t.tipoTarea === 'decision' ? t.decisionArticuloId : null,
      decisionGuiaTitulo: t.tipoTarea === 'decision' ? t.decisionArticuloTitulo : '',
    })
  }

  if (recorrido.length > 0) return recorrido

  return [
    {
      id: `paso:${paso.id}`,
      texto: tituloPaso,
      clase: 'paso-entero',
      esPasoEntero: true,
      vinculoProtegido: paso.vinculoProtegido,
      tipoTarea: null,
      guiaId: null,
      guiaTitulo: '',
      intencionGuia: null,
      decisionGuiaId: null,
      decisionGuiaTitulo: '',
    },
  ]
}

/**
 * ¿Esta tarea del recorrido esta cumplida?
 *
 * Las tareas normales se leen del avance marcado. La guia del paso NO
 * se marca a mano: se cumple cuando la guia vinculada esta completa, y
 * ese dato lo resuelve quien llama (`subSatisfecho`). Asi no existe
 * forma de dar por hecha una guia que no se hizo, que es el criterio
 * A10: volver de ella sin terminarla no la registra como completada.
 */
export function tareaFocoHecha(
  tarea: TareaFoco,
  hechas: ReadonlySet<string>,
  subSatisfecho: boolean,
): boolean {
  if (tarea.clase === 'guia-del-paso') return subSatisfecho
  return hechas.has(tarea.id)
}

// Que hace el boton grande del foco. `marcar` mientras queden tareas
// del paso sin cumplir; `completar` cuando ya no queda ninguna, que es
// cuando el gesto siguiente es cerrar el paso y pasar al que sigue.
// El paso sin tareas es `completar` desde el principio: no hay nada
// intermedio que marcar.
export type AccionFoco = 'marcar' | 'completar'

export function accionFoco(
  tareas: TareaFoco[],
  hechas: ReadonlySet<string>,
  subSatisfecho = true,
): AccionFoco {
  if (tareas.length === 1 && tareas[0].esPasoEntero) return 'completar'
  return tareas.every((t) => tareaFocoHecha(t, hechas, subSatisfecho)) ? 'completar' : 'marcar'
}
