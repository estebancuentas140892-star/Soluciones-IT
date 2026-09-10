import type { BloquePaso, IntencionGuia, PasoProcedimiento, TipoTarea, VinculoProtegido } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'
import { apoyosDelPaso, apoyosDeTarea } from './apoyosTarea'
import { guiasObligatoriasDeTarea } from './guiasObligatorias'

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

// LOS AVISOS TAMBIEN SON ELEMENTOS DEL RECORRIDO (encargo del
// 2026-09-10, tarea 1).
//
// Hasta ahora un aviso era un APOYO PASIVO: se pintaba pegado a la
// tarea que lo llevaba (o dentro del panel "Informacion del paso") y el
// recorrido pasaba por encima de el sin detenerse. Un aviso que
// comparte pantalla con la instruccion siguiente no advierte: el ojo va
// al titular de 30 px y al boton de 76.
//
// Ahora cada aviso ocupa su propio turno de la secuencia:
//
//   - el aviso del PASO va una sola vez, delante de todo lo demas;
//   - el aviso de una TAREA va inmediatamente antes de esa tarea;
//   - ninguno se repite en las demas tareas, y ninguno se deduplica por
//     texto: el bloque conserva su identidad (`id`) y su posicion
//     estable, porque el anclaje sigue siendo `alcance`/`tareaId`, no la
//     posicion dentro de `bloques`.
//
// Confirmarlo deja pasar al elemento siguiente, pero NO cuenta como
// tarea hecha: su id no es el de un bloque 'tarea', asi que no entra ni
// en el avance guardado ni en el cierre del paso.

export type ClaseTareaFoco =
  // Un bloque 'tarea' del paso.
  | 'tarea'
  // Paso sin tareas: se presenta como una sola, con el titulo del paso.
  | 'paso-entero'
  // La guia vinculada del paso (`subArticuloId`), como primera tarea.
  | 'guia-del-paso'
  // Un bloque 'aviso', con su turno propio en la secuencia.
  | 'aviso'

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
  // TODAS las guias con intencion 'necesario' colgadas de esta tarea,
  // en el orden del editor (encargo del 2026-09-09, tarea 1). Antes se
  // tomaba solo la primera con `.find`, asi que una tarea con dos guias
  // necesarias enseñaba una y exigia ninguna.
  guiasObligatorias: BloquePaso[]
  // El bloque de aviso cuando `clase` es 'aviso'; null en el resto. Se
  // lleva el bloque entero para no perder su tono ni su `alcance`.
  aviso: BloquePaso | null
}

// Campos que no aplican a una entrada sintetica, para no repetirlos en
// cada constructor.
type CamposVacios = Pick<
  TareaFoco,
  | 'tipoTarea'
  | 'guiaId'
  | 'guiaTitulo'
  | 'intencionGuia'
  | 'decisionGuiaId'
  | 'decisionGuiaTitulo'
  | 'guiasObligatorias'
  | 'aviso'
>

// Es una funcion y no una constante para que cada entrada reciba su
// propio array: una constante compartida haria que todas apuntaran al
// mismo `guiasObligatorias`.
function camposVacios(): CamposVacios {
  return {
    tipoTarea: null,
    guiaId: null,
    guiaTitulo: '',
    intencionGuia: null,
    decisionGuiaId: null,
    decisionGuiaTitulo: '',
    guiasObligatorias: [],
    aviso: null,
  }
}

// La entrada de un aviso. El id ES el del bloque: identidad estable
// aunque el autor reordene las tareas del paso, y sin choque posible
// con el id de una tarea (el avance se guarda por id de bloque).
function entradaAviso(aviso: BloquePaso): TareaFoco {
  return {
    ...camposVacios(),
    id: aviso.id,
    texto: aviso.texto,
    clase: 'aviso',
    esPasoEntero: false,
    // Un aviso no abre una credencial: lo unico que ofrece es leerlo y
    // confirmarlo.
    vinculoProtegido: null,
    aviso,
  }
}

/** Prefijo del id sintetico de la guia del paso dentro del recorrido. */
export function idTareaGuiaDelPaso(pasoId: string): string {
  return `guia:${pasoId}`
}

// El titulo llega ya resuelto por quien llama (`paso.titulo` puede
// estar vacio y caer en el del subarticulo o en "Paso N"), para no
// duplicar aqui esa cadena de respaldos.
export function tareasParaFoco(paso: PasoProcedimiento, tituloPaso: string): TareaFoco[] {
  // El TRABAJO del paso: la guia vinculada y sus tareas, cada una
  // precedida por sus propios avisos.
  const trabajo: TareaFoco[] = []

  // La guia vinculada del paso va PRIMERA: es lo que hay que tener
  // hecho para que el resto del paso tenga sentido, y es justo lo que
  // antes bloqueaba sin dejarse abrir.
  if (paso.subArticuloId) {
    trabajo.push({
      ...camposVacios(),
      id: idTareaGuiaDelPaso(paso.id),
      texto: paso.subArticuloTitulo || 'Completar la guía vinculada',
      clase: 'guia-del-paso',
      esPasoEntero: false,
      vinculoProtegido: paso.vinculoProtegido,
      guiaId: paso.subArticuloId,
      guiaTitulo: paso.subArticuloTitulo,
      intencionGuia: 'necesario',
    })
  }

  const tareas = tareasDe(paso.bloques)
  for (const t of tareas) {
    const obligatorias = guiasObligatoriasDeTarea(paso, t.id)
    // Los avisos de ESTA tarea, justo antes de ella: es el unico sitio
    // donde advierten a tiempo.
    for (const aviso of apoyosDeTarea(paso, t.id).avisos) trabajo.push(entradaAviso(aviso))
    trabajo.push({
      id: t.id,
      texto: t.texto,
      clase: 'tarea',
      esPasoEntero: false,
      vinculoProtegido: t.vinculoProtegido ?? paso.vinculoProtegido,
      tipoTarea: t.tipoTarea ?? 'accion',
      guiaId: obligatorias[0]?.guiaArticuloId ?? null,
      guiaTitulo: obligatorias[0]?.guiaArticuloTitulo ?? '',
      intencionGuia: obligatorias.length > 0 ? 'necesario' : null,
      guiasObligatorias: obligatorias,
      decisionGuiaId: t.tipoTarea === 'decision' ? t.decisionArticuloId : null,
      decisionGuiaTitulo: t.tipoTarea === 'decision' ? t.decisionArticuloTitulo : '',
      aviso: null,
    })
  }

  // Un paso cuyo unico contenido son avisos NO se queda sin forma de
  // cerrarse: sigue teniendo su tarea unica, detras de ellos.
  if (trabajo.length === 0) {
    trabajo.push({
      ...camposVacios(),
      id: `paso:${paso.id}`,
      texto: tituloPaso,
      clase: 'paso-entero',
      esPasoEntero: true,
      vinculoProtegido: paso.vinculoProtegido,
    })
  }

  // Los avisos del paso completo, UNA sola vez y delante de todo: son
  // las condiciones bajo las que se hace el paso entero, asi que se
  // leen antes de la primera tarea y no vuelven a interrumpir.
  return [...apoyosDelPaso(paso).avisos.map(entradaAviso), ...trabajo]
}

/**
 * ¿Esta tarea del recorrido esta cumplida?
 *
 * Las tareas normales se leen del avance marcado. La guia del paso NO
 * se marca a mano: se cumple cuando la guia vinculada esta completa, y
 * ese dato lo resuelve quien llama (`subSatisfecho`). Asi no existe
 * forma de dar por hecha una guia que no se hizo, que es el criterio
 * A10: volver de ella sin terminarla no la registra como completada.
 *
 * Un AVISO se cumple al confirmarlo, y esa confirmacion NO se guarda en
 * el avance: vive en la ejecucion en curso (`avisosConfirmados`), asi
 * que repetir la guia vuelve a mostrarlo. Dentro de la misma ejecucion
 * se puede volver a el con las flechas sin que pida confirmarlo otra
 * vez.
 */
export function tareaFocoHecha(
  tarea: TareaFoco,
  hechas: ReadonlySet<string>,
  subSatisfecho: boolean,
  avisosConfirmados?: ReadonlySet<string>,
): boolean {
  if (tarea.clase === 'guia-del-paso') return subSatisfecho
  if (tarea.clase === 'aviso') return avisosConfirmados?.has(tarea.id) ?? false
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
  avisosConfirmados?: ReadonlySet<string>,
): AccionFoco {
  // El paso sin tareas puede llevar avisos delante: lo que decide es
  // que su unico TRABAJO sea la tarea unica, no que el recorrido tenga
  // un solo elemento. Los avisos no cambian esa respuesta porque un
  // aviso trae su propio boton, no el de cerrar el paso.
  const trabajo = tareas.filter((t) => t.clase !== 'aviso')
  if (trabajo.length === 1 && trabajo[0].esPasoEntero) return 'completar'
  return tareas.every((t) => tareaFocoHecha(t, hechas, subSatisfecho, avisosConfirmados))
    ? 'completar'
    : 'marcar'
}
