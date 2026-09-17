import type { BloquePaso, IntencionGuia, PasoProcedimiento, TipoTarea, VinculoProtegido } from '../../lib/db'
import { tareasDe } from '../../lib/procedimiento'
import { apoyosDelPaso, apoyosDeTarea } from './apoyosTarea'
import { guiasObligatoriasDeTarea } from './guiasObligatorias'
import { presenciaDeAviso } from './tonos'

// LO QUE EL MODO FOCO RECORRE (tarea 217, hallazgo G-18; ampliado el
// 2026-09-09 con la correccion de H05).
//
// Hasta la 217 el foco solo se montaba si el paso tenia tareas: un paso
// sin ellas expulsaba al tecnico a la vista completa a mitad de
// procedimiento. Con el foco convertido en la ejecucion por defecto eso
// rompia el modo, asi que el paso sin tareas se presenta como UNA sola
// tarea: su titulo, y marcarla completa el paso.
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

// LOS AVISOS YA NO SON PARADAS DEL RECORRIDO (encargo del 2026-09-17,
// secciones 6 y 7; deshace la tarea 1 del encargo del 2026-09-10).
//
// Desde el 10 de septiembre cada aviso ocupaba su propio turno: una
// pantalla entera con el texto y un "Entendido · continuar" que habia
// que tocar antes de ver la accion siguiente, fuera una precaucion real
// o un consejo. En una guia usada de verdad (la de la resolucion DIAN)
// eso era una interrupcion cada pocas acciones, y el tecnico acababa
// tocando "Entendido" sin leer, que es lo contrario de advertir.
//
// Ahora el recorrido es solo TRABAJO (la guia del paso, sus tareas o la
// tarea unica del paso) y los avisos acompañan a la accion a la que
// pertenecen, en la misma pantalla:
//
//   - el aviso de una TAREA va con esa tarea y con ninguna otra;
//   - el aviso del PASO (o heredado sin asignar) va con la PRIMERA
//     entrada del paso, una sola vez: son las condiciones del paso
//     entero, asi que se leen al entrar y no vuelven a repetirse;
//   - como se ve lo decide el tono (`presenciaDeAviso`): los riesgos
//     como alerta antes de la instruccion, los datos a la vista y la
//     informacion y los consejos plegados.
//
// Ninguno se deduplica por texto y ninguno retiene el avance.

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
  // TODAS las guias con intencion 'necesario' colgadas de esta tarea,
  // en el orden del editor (encargo del 2026-09-09, tarea 1). Antes se
  // tomaba solo la primera con `.find`, asi que una tarea con dos guias
  // necesarias enseñaba una y exigia ninguna.
  guiasObligatorias: BloquePaso[]
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

  for (const t of tareasDe(paso.bloques)) {
    const obligatorias = guiasObligatoriasDeTarea(paso, t.id)
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
    })
  }

  // Un paso sin tareas (y sin guia) no se queda sin forma de cerrarse:
  // su titulo es la tarea unica, aunque el paso solo lleve avisos.
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

  return trabajo
}

/** Los avisos que acompañan a una entrada del recorrido, ya repartidos por cómo se ven. */
export interface AvisosDeTarea {
  /** Precaución e importante: antes de la instrucción, con su color. */
  alertas: BloquePaso[]
  /** Datos técnicos: a la vista, sin color de alerta. */
  datos: BloquePaso[]
  /** Información y consejos: plegados en "Más información". */
  plegados: BloquePaso[]
}

/**
 * Los avisos de la entrada `indice` del recorrido de `paso`.
 *
 * Los de la tarea van con ella; los del paso (y los heredados sin
 * asignar), solo con la PRIMERA entrada, sea la guia del paso, la
 * primera tarea o la tarea unica. Dentro de cada grupo, primero los del
 * paso, que son las condiciones de todo lo que sigue, y despues los de
 * la tarea, cada uno en el orden del autor.
 */
export function avisosDeTareaFoco(paso: PasoProcedimiento, tareas: TareaFoco[], indice: number): AvisosDeTarea {
  const tarea = tareas[indice]
  const avisos: BloquePaso[] = []
  if (indice === 0) avisos.push(...apoyosDelPaso(paso).avisos)
  if (tarea?.clase === 'tarea') avisos.push(...apoyosDeTarea(paso, tarea.id).avisos)

  const repartidos: AvisosDeTarea = { alertas: [], datos: [], plegados: [] }
  for (const aviso of avisos) {
    const presencia = presenciaDeAviso(aviso.tono)
    if (presencia === 'alerta') repartidos.alertas.push(aviso)
    else if (presencia === 'dato') repartidos.datos.push(aviso)
    else repartidos.plegados.push(aviso)
  }
  return repartidos
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
export function tareaFocoHecha(tarea: TareaFoco, hechas: ReadonlySet<string>, subSatisfecho: boolean): boolean {
  if (tarea.clase === 'guia-del-paso') return subSatisfecho
  return hechas.has(tarea.id)
}

// Que hace el boton grande del foco. `marcar` mientras queden tareas
// del paso sin cumplir; `completar` cuando ya no queda ninguna, que es
// cuando el gesto siguiente es cerrar el paso y pasar al que sigue.
// El paso sin tareas es `completar` desde el principio: no hay nada
// intermedio que marcar.
export type AccionFoco = 'marcar' | 'completar'

export function accionFoco(tareas: TareaFoco[], hechas: ReadonlySet<string>, subSatisfecho = true): AccionFoco {
  if (tareas.length === 1 && tareas[0].esPasoEntero) return 'completar'
  return tareas.every((t) => tareaFocoHecha(t, hechas, subSatisfecho)) ? 'completar' : 'marcar'
}
