import { comoHacerDe } from '../../lib/comoHacer'
import type {
  BloquePaso,
  IntencionGuia,
  MicroPasoComoHacer,
  OpcionDecision,
  PasoProcedimiento,
  ResultadoVisual,
  TipoTarea,
  VinculoProtegido,
} from '../../lib/db'
import { resultadoVisualDe } from '../../lib/resultadoVisual'
import { tareasDe } from '../../lib/procedimiento'
import { decisionDeRuta, guiaDeLaRespuesta, type Elecciones } from '../../lib/rutaProcedimiento'
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
//   - como se ve lo decide el tono (`presenciaDeAviso`): los datos, a la
//     vista con su accion, y los riesgos reales, ANTES de ella, en su propia
//     pantalla (tarea 311, la advertencia previa: advertenciaPrevia.ts). Hasta
//     la 311 iban bajo la instruccion. La informacion y los consejos
//     heredados no se muestran (tarea 307).
//
// La advertencia previa NO es volver a lo del 10 de septiembre: solo los
// riesgos reales la tienen, los de una misma accion van juntos en una sola,
// y no es una entrada de este recorrido (no cuenta, no se marca). Ninguno
// se deduplica por texto y ninguno retiene el avance.

export type ClaseTareaFoco =
  // Un bloque 'tarea' del paso.
  | 'tarea'
  // Paso sin tareas: se presenta como una sola, con el titulo del paso.
  | 'paso-entero'
  // La guia vinculada del paso (`subArticuloId`), como primera tarea.
  | 'guia-del-paso'
  // Una guia que una TAREA exige ('necesario') y que se puede hacer aqui,
  // justo antes de esa tarea (tarea 289, fase 3): sus acciones son parte
  // del flujo, no una tarjeta que abrir.
  | 'guia-de-tarea'
  // La guia que abre la respuesta elegida en una decision con opciones
  // (tarea 302), justo DESPUES de la decision: es el camino de esa
  // respuesta, y se hace en el flujo antes de cerrar el paso.
  | 'guia-de-respuesta'

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
  // 'guia-del-paso' es la del paso; en 'guia-de-tarea', la que exige su
  // tarea; en una tarea normal, la del bloque 'guia' con intencion
  // 'necesario' que le pertenezca.
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
  // Las respuestas de una decision CON OPCIONES (tarea 302), en su orden;
  // vacio en todo lo demas, incluidas las decisiones de Si/No.
  opciones: OpcionDecision[]
  // "Como hacerlo" de la tarea (tarea 303): las microacciones que hacen
  // esta accion, ya limpias (`comoHacerDe`). Vacio en las entradas
  // sinteticas, en las comprobaciones y decisiones y en las acciones que
  // no lo tienen.
  comoHacer: MicroPasoComoHacer[]
  // "Debes ver" de la tarea (tarea 307): la imagen de como debe quedar la
  // pantalla cuando esta accion salio bien (`resultadoVisualDe`). null en
  // las entradas sinteticas, en las decisiones y en las tareas sin imagen.
  resultadoVisual: ResultadoVisual | null
  // TODAS las guias con intencion 'necesario' colgadas de esta tarea,
  // en el orden del editor (encargo del 2026-09-09, tarea 1). Antes se
  // tomaba solo la primera con `.find`, asi que una tarea con dos guias
  // necesarias enseñaba una y exigia ninguna.
  guiasObligatorias: BloquePaso[]
  // En 'guia-de-tarea', la tarea que la exige (la entrada que va justo
  // despues). null en el resto.
  tareaDeLaGuia: string | null
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
  | 'opciones'
  | 'comoHacer'
  | 'resultadoVisual'
  | 'guiasObligatorias'
  | 'tareaDeLaGuia'
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
    opciones: [],
    comoHacer: [],
    resultadoVisual: null,
    guiasObligatorias: [],
    tareaDeLaGuia: null,
  }
}

/** Prefijo del id sintetico de la guia del paso dentro del recorrido. */
export function idTareaGuiaDelPaso(pasoId: string): string {
  return `guia:${pasoId}`
}

/** Id sintetico de la guia que exige una tarea, por el bloque que la cuelga. */
export function idTareaGuiaDeTarea(pasoId: string, bloqueId: string): string {
  return `guia:${pasoId}:${bloqueId}`
}

/** Id sintetico de la guia que abre la respuesta de la decision del paso. */
export function idTareaGuiaDeRespuesta(pasoId: string): string {
  return `guia:${pasoId}:respuesta`
}

// El titulo llega ya resuelto por quien llama (`paso.titulo` puede
// estar vacio y caer en el del subarticulo o en "Paso N"), para no
// duplicar aqui esa cadena de respaldos.
//
// `sePuedeHacerAqui` dice si una guia que exige una tarea se ejecuta en
// este flujo (tarea 289, fase 3): en la ejecucion principal, con la guia en
// el dispositivo y con pasos. Solo entonces se vuelve una entrada del
// recorrido, justo antes de su tarea; si no, la tarea la sigue ofreciendo
// aparte (o explicando que no esta), como hasta ahora. Sin el predicado,
// ninguna se vuelve entrada.
//
// Con `elecciones` (tarea 302), la respuesta elegida en la decision del
// paso que abre otra guia suma esa guia justo despues de la decision, si
// se puede hacer aqui: es el camino de la respuesta. Las demas respuestas
// no suman nada: su destino es otro paso, y eso lo decide la ruta.
export function tareasParaFoco(
  paso: PasoProcedimiento,
  tituloPaso: string,
  sePuedeHacerAqui: (guiaId: string) => boolean = () => false,
  elecciones?: Elecciones,
): TareaFoco[] {
  const trabajo: TareaFoco[] = []
  // Una guia se hace una sola vez por paso: si la reutiliza el paso entero
  // o ya la exigio una tarea anterior, la siguiente que la pida la
  // encuentra hecha (el avance es por guia, `vinculos[guiaId]`).
  const guiasEnElRecorrido = new Set<string>()

  // La guia vinculada del paso va PRIMERA: es lo que hay que tener
  // hecho para que el resto del paso tenga sentido, y es justo lo que
  // antes bloqueaba sin dejarse abrir.
  if (paso.subArticuloId) {
    guiasEnElRecorrido.add(paso.subArticuloId)
    trabajo.push({
      ...camposVacios(),
      id: idTareaGuiaDelPaso(paso.id),
      // Por el paso, no por la guía de dentro: es lo que el técnico ve y lo
      // que nombra "Tengo un problema" (tarea 289).
      texto: tituloPaso || paso.subArticuloTitulo,
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
    // Lo que la tarea exige y se puede hacer aqui va JUSTO ANTES de ella,
    // en el orden del editor: es lo que hay que tener hecho para poder
    // hacerla, como la guia del paso va antes que sus tareas.
    for (const g of obligatorias) {
      const guiaId = g.guiaArticuloId
      if (!guiaId || guiasEnElRecorrido.has(guiaId) || !sePuedeHacerAqui(guiaId)) continue
      guiasEnElRecorrido.add(guiaId)
      trabajo.push({
        ...camposVacios(),
        id: idTareaGuiaDeTarea(paso.id, g.id),
        texto: g.guiaArticuloTitulo,
        clase: 'guia-de-tarea',
        esPasoEntero: false,
        vinculoProtegido: null,
        guiaId,
        guiaTitulo: g.guiaArticuloTitulo,
        intencionGuia: 'necesario',
        tareaDeLaGuia: t.id,
      })
    }
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
      opciones: t.tipoTarea === 'decision' ? (t.opciones ?? []) : [],
      comoHacer: comoHacerDe(t),
      resultadoVisual: resultadoVisualDe(t),
      tareaDeLaGuia: null,
    })
    const respuesta = decisionDeRuta(paso)?.id === t.id ? guiaDeLaRespuesta(paso, elecciones) : null
    if (respuesta && !guiasEnElRecorrido.has(respuesta.articuloId) && sePuedeHacerAqui(respuesta.articuloId)) {
      guiasEnElRecorrido.add(respuesta.articuloId)
      trabajo.push({
        ...camposVacios(),
        id: idTareaGuiaDeRespuesta(paso.id),
        texto: respuesta.titulo,
        clase: 'guia-de-respuesta',
        esPasoEntero: false,
        vinculoProtegido: null,
        guiaId: respuesta.articuloId,
        guiaTitulo: respuesta.titulo,
        intencionGuia: 'necesario',
      })
    }
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
  /** Precaución e importante: su advertencia previa, antes de la acción (tarea 311). */
  alertas: BloquePaso[]
  /** Datos técnicos: a la vista, sin color de alerta. */
  datos: BloquePaso[]
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

  // La información y los consejos heredados no van a ningún sitio: la
  // ejecución mínima no los muestra (tarea 307).
  const repartidos: AvisosDeTarea = { alertas: [], datos: [] }
  for (const aviso of avisos) {
    const presencia = presenciaDeAviso(aviso.tono)
    if (presencia === 'alerta') repartidos.alertas.push(aviso)
    else if (presencia === 'dato') repartidos.datos.push(aviso)
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
 * La guia que exige una tarea, igual: la resuelve `guiaCumplida`.
 */
export function tareaFocoHecha(
  tarea: TareaFoco,
  hechas: ReadonlySet<string>,
  subSatisfecho: boolean,
  guiaCumplida: (guiaId: string) => boolean = () => false,
): boolean {
  if (tarea.clase === 'guia-del-paso') return subSatisfecho
  if (tarea.clase === 'guia-de-tarea' || tarea.clase === 'guia-de-respuesta') {
    return tarea.guiaId !== null && guiaCumplida(tarea.guiaId)
  }
  return hechas.has(tarea.id)
}

/** ¿La entrada es una guia que se hace en el sitio (la del paso, la que exige una tarea o la de una respuesta)? */
export function esGuiaDelRecorrido(tarea: TareaFoco): boolean {
  return tarea.clase === 'guia-del-paso' || tarea.clase === 'guia-de-tarea' || tarea.clase === 'guia-de-respuesta'
}

/** ¿La entrada es una decision con opciones con nombre (tarea 302)? */
export function esDecisionConOpcionesFoco(tarea: TareaFoco): boolean {
  return tarea.clase === 'tarea' && tarea.tipoTarea === 'decision' && tarea.opciones.length > 0
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
  guiaCumplida?: (guiaId: string) => boolean,
): AccionFoco {
  if (tareas.length === 1 && tareas[0].esPasoEntero) return 'completar'
  return tareas.every((t) => tareaFocoHecha(t, hechas, subSatisfecho, guiaCumplida)) ? 'completar' : 'marcar'
}
