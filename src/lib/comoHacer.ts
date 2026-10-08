import type { BloquePaso, MicroPasoComoHacer, PasoProcedimiento } from './db'
import { texto } from './texto'

// "CÓMO HACERLO" DE UNA ACCIÓN (tarea 303, regla 27 c, AD-067).
//
// Una pantalla de la ejecución es un momento de trabajo con un solo
// objetivo inmediato: la instrucción ("Abre un registro nuevo"). Dentro de
// la misma ventana o contexto, hacerla puede pedir varios gestos seguidos,
// y cada uno es una MICROACCIÓN (`MicroPasoComoHacer`: acción, elemento y,
// si hace falta, ubicación). La lista pertenece al bloque 'tarea' de tipo
// 'accion' (`BloquePaso.comoHacer`) y alimenta las dos lecturas de la
// ejecución:
//
//   - la RUTA RÁPIDA, para el técnico que ya sabe orientarse: la secuencia
//     ejecutable condensada, cada microacción con su verbo ("Abre Fichero ›
//     Selecciona Cliente › Selecciona Nuevo"). Desde la tarea 309 no es una
//     lista de nombres: "carpeta de la persona › archivo .pst › archivo .pst"
//     perdía justo lo que dice qué hacer (abrir, copiar, pegar);
//   - el PASO A PASO, plegado, para quien llega nuevo: las mismas frases,
//     numeradas, con la ubicación debajo. Solo existe cuando dice algo que la
//     ruta no dice (`pasoAPasoAportaAlgo`).
//
// Un solo contenido y dos niveles de lectura: nunca dos textos que
// mantener, y las dos dicen cada microacción con la misma frase
// (`fraseDeMicroPaso`). Aquí vive todo lo que no es dibujar: crear,
// normalizar, leer y validar la lista, qué se enseña y cómo se dice.
//
// UNA MICROACCIÓN VÁLIDA TIENE SIEMPRE ACCIÓN Y ELEMENTO; la ubicación es
// opcional. Las dos lecturas los necesitan: cada una dice acción más
// elemento. Por eso no hay sustituto: nada inventa el campo que falta. Una a
// medias no se lee (el normalizador la descarta y las vistas no la ven) y el
// editor no la deja guardar.
//
// "CÓMO HACERLO" ES UNA DESCOMPOSICIÓN (tarea 309): con una sola microacción
// no hay nada que descomponer, y esa microacción pertenece a la instrucción
// principal. No se enseña (`comoHacerQueSeEnsena`), pero el dato se conserva
// tal cual: ni se borra ni se convierte. Por eso el editor tampoco la deja
// guardar (`tieneUnaSolaMicroaccion`): cero o al menos dos. Decide quien
// escribe, nunca la aplicación: llevarla a la instrucción o añadir otra.
//
// NADA SE DEDUCE DEL TEXTO. Ni flechas, ni ">", ni frases que "parecen una
// ruta": una microacción existe porque alguien la escribió como tal. Un
// "Cómo hacerlo" que llegue como texto suelto (la forma que se descartó)
// no se convierte en microacciones: se ignora.

/** El nombre visible del campo, en el editor, en las vistas y en la asistencia. */
export const ROTULO_COMO_HACERLO = 'Cómo hacerlo'

/** El nombre de la lectura compacta de las microacciones. */
export const ROTULO_RUTA_RAPIDA = 'Ruta rápida'

/** Una microacción nueva, vacía, con el id que conservará siempre. */
export function crearMicroPaso(): MicroPasoComoHacer {
  return { id: crypto.randomUUID(), accion: '', elemento: '' }
}

/**
 * ¿Este bloque admite "Cómo hacerlo"? Solo una tarea de acción. Una tarea
 * sin tipo (de antes de la clasificación) es una acción, como en el resto
 * de la app.
 */
export function admiteComoHacer(bloque: Pick<BloquePaso, 'tipo' | 'tipoTarea'>): boolean {
  return bloque.tipo === 'tarea' && (bloque.tipoTarea ?? 'accion') === 'accion'
}

// ¿Vale esta microacción? Con acción Y elemento. Sin uno de los dos no hay
// gesto completo que enseñar: ni la ruta (elementos) ni el paso a paso
// (acción más elemento) pueden decirla.
function estaCompleta(accion: string, elemento: string): boolean {
  return accion.trim() !== '' && elemento.trim() !== ''
}

/**
 * Las microacciones tal como llegan del JSON, toleradas. Lo que no es una
 * lista, lo que no es un objeto y la microacción a la que le falta la
 * acción o el elemento se descartan, igual que una tarea sin texto: no se
 * enseña a medias ni se completa inventando el campo que falta. Un campo
 * que no es texto cuenta como vacío. El texto se conserva como se escribió
 * (se recorta al guardar). Un id que falta o que se repite se renueva: el
 * editor mueve y quita por id, y dos iguales serían una sola. Los demás
 * ids no se tocan nunca.
 */
export function normalizarComoHacer(valor: unknown): MicroPasoComoHacer[] {
  if (!Array.isArray(valor)) return []
  const vistos = new Set<string>()
  return valor.flatMap((item): MicroPasoComoHacer[] => {
    if (!item || typeof item !== 'object') return []
    const origen = item as Record<string, unknown>
    const accion = texto(origen.accion)
    const elemento = texto(origen.elemento)
    if (!estaCompleta(accion, elemento)) return []
    const declarado = typeof origen.id === 'string' && origen.id !== '' ? origen.id : null
    const id = declarado && !vistos.has(declarado) ? declarado : crypto.randomUUID()
    vistos.add(id)
    const ubicacion = texto(origen.ubicacion)
    return [{ id, accion, elemento, ...(ubicacion.trim() !== '' ? { ubicacion } : {}) }]
  })
}

/**
 * EL "CÓMO HACERLO" DE UNA TAREA, listo para enseñar y para guardar: solo
 * las microacciones completas (acción y elemento), recortadas y sin
 * `ubicacion` si no la tienen; `[]` si no tiene ninguna o si el bloque no
 * es una tarea de acción. Toda vista lo lee de aquí (también "Probar", que
 * enseña lo que está a medio escribir: una fila a medias no aparece) y el
 * guardado guarda exactamente esto. El editor no deja llegar hasta aquí una
 * microacción a medias ni una sola (`problemasDeComoHacer`).
 */
export function comoHacerDe(bloque: BloquePaso): MicroPasoComoHacer[] {
  if (!admiteComoHacer(bloque) || !bloque.comoHacer) return []
  return bloque.comoHacer.flatMap((micro): MicroPasoComoHacer[] => {
    const accion = micro.accion.trim()
    const elemento = micro.elemento.trim()
    if (!estaCompleta(accion, elemento)) return []
    const ubicacion = micro.ubicacion?.trim() ?? ''
    return [{ id: micro.id, accion, elemento, ...(ubicacion !== '' ? { ubicacion } : {}) }]
  })
}

/**
 * Una microacción dicha como frase, sin el punto final: "Abre Fichero". Es la
 * única forma de decirla: la ruta rápida, el paso a paso, el computador
 * atendido y "¿Qué hace?" la leen de aquí.
 */
export function fraseDeMicroPaso(micro: MicroPasoComoHacer): string {
  return `${micro.accion.trim()} ${micro.elemento.trim()}`
}

/**
 * LO QUE "CÓMO HACERLO" ENSEÑA (tarea 309): las microacciones si son dos o
 * más; si no, ninguna. "Cómo hacerlo" descompone una acción en sus gestos, y
 * una sola microacción no descompone nada: es la instrucción principal dicha
 * otra vez (y antes, dos veces más: como ruta y como paso a paso). Las vistas
 * de la ejecución, la lectura, "Probar" y el computador atendido pasan por
 * aquí. No toca el dato: una guía antigua con una sola la conserva tal cual,
 * solo no la enseña (y el editor no deja volver a guardarla así).
 */
export function comoHacerQueSeEnsena(microPasos: MicroPasoComoHacer[]): MicroPasoComoHacer[] {
  return microPasos.length >= 2 ? microPasos : []
}

/**
 * ¿"Ver paso a paso" dice algo que la ruta rápida no dice? (tarea 309) Las
 * dos lecturas dicen cada microacción con la misma frase (`fraseDeMicroPaso`),
 * así que lo único que el paso a paso añade es la UBICACIÓN, el único campo
 * de una microacción que la ruta no enseña. Sin ninguna, desplegarlo
 * repetiría la ruta con números: no se ofrece. Se decide por estructura,
 * nunca comparando textos.
 */
export function pasoAPasoAportaAlgo(microPasos: MicroPasoComoHacer[]): boolean {
  return microPasos.some((micro) => (micro.ubicacion ?? '').trim() !== '')
}

/**
 * ¿Hace falta el punto que cierra la frase? No si el autor ya la cerró
 * ("¿Guardar los cambios?"): dos signos seguidos se leen como un error.
 */
export function llevaPuntoFinal(frase: string): boolean {
  return !/[.!?…:;]$/.test(frase.trim())
}

/**
 * El paso a paso como texto, una línea por microacción ("1. Abre Fichero
 * (Barra superior)."), para lo que solo puede llevar texto: el computador
 * atendido recibe así el "Cómo hacerlo" de una acción.
 */
export function textoPasoAPaso(microPasos: MicroPasoComoHacer[]): string {
  return microPasos
    .map((micro, indice) => {
      const ubicacion = micro.ubicacion?.trim()
      const frase = `${fraseDeMicroPaso(micro)}${ubicacion ? ` (${ubicacion})` : ''}`
      return `${indice + 1}. ${frase}${llevaPuntoFinal(frase) ? '.' : ''}`
    })
    .join('\n')
}

// ---------------------------------------------------------------------
// LO QUE EL EDITOR NO DEJA GUARDAR
// ---------------------------------------------------------------------

/** Un campo sin el que una microacción no vale. La ubicación no lo es. */
export type CampoObligatorio = 'accion' | 'elemento'

// Una fila del editor sin nada escrito (ni acción, ni elemento, ni
// ubicación) todavía no es una microacción: no se guarda y no cuenta.
function estaEnBlanco(micro: MicroPasoComoHacer): boolean {
  return micro.accion.trim() === '' && micro.elemento.trim() === '' && (micro.ubicacion ?? '').trim() === ''
}

/**
 * Lo que le falta a una microacción del editor para valer: sus campos
 * obligatorios vacíos, en el orden del formulario. Una fila del todo vacía
 * (sin acción, elemento ni ubicación) todavía no es una microacción: no le
 * falta nada, no se guarda y no impide guardar.
 */
export function camposQueFaltan(micro: MicroPasoComoHacer): CampoObligatorio[] {
  if (estaEnBlanco(micro)) return []
  const faltan: CampoObligatorio[] = []
  if (micro.accion.trim() === '') faltan.push('accion')
  if (micro.elemento.trim() === '') faltan.push('elemento')
  return faltan
}

/** Lo que falta, dicho junto a la fila: "Falta el elemento." */
export function textoDeLoQueFalta(faltan: CampoObligatorio[]): string {
  if (faltan.length > 1) return 'Faltan la acción y el elemento.'
  return faltan[0] === 'accion' ? 'Falta la acción.' : 'Falta el elemento.'
}

/**
 * ¿Se guardaría "Cómo hacerlo" con UNA sola microacción? (tarea 309) Es lo
 * que la ejecución no enseña (`comoHacerQueSeEnsena`): guardarla sería
 * escribir una instrucción que el técnico nunca verá. Cuenta lo que el
 * autor escribió, tal como está en el editor: una fila del todo vacía no
 * cuenta (no se guarda), y si la única escrita está a medias, lo que hay que
 * corregir primero es lo que le falta (`camposQueFaltan`), no esto. Con una
 * completa y otra a medias tampoco: esa otra es la segunda que se está
 * escribiendo.
 */
export function tieneUnaSolaMicroaccion(microPasos: MicroPasoComoHacer[]): boolean {
  const escritas = microPasos.filter((micro) => !estaEnBlanco(micro))
  return escritas.length === 1 && camposQueFaltan(escritas[0]).length === 0
}

/** Lo que dice el editor, junto a "Cómo hacerlo", mientras tenga una sola microacción. */
export const AVISO_UNA_SOLA_MICROACCION = `${ROTULO_COMO_HACERLO} necesita al menos 2 acciones. Si solo hay una, escríbela directamente en la instrucción principal.`

/**
 * Lo que no deja guardar el "Cómo hacerlo" de una acción, con lo que hace
 * falta para llevar al autor a ello:
 *   - 'incompleta': una microacción con algo escrito pero sin acción o sin
 *     elemento (tarea 303);
 *   - 'unaSola': la acción tiene una sola microacción, completa (tarea 309).
 * En una misma acción nunca coinciden: si hay una a medias, eso es lo que se
 * corrige primero (`tieneUnaSolaMicroaccion`).
 */
export type ProblemaComoHacer = {
  pasoId: string
  tareaId: string
  /** El texto de la acción a la que pertenece, para nombrarla. */
  tareaTexto: string
  /** La microacción a medias o la única. */
  microPasoId: string
  /** Su número en la lista del editor, empezando en 1. */
  numero: number
} & ({ tipo: 'incompleta'; faltan: CampoObligatorio[] } | { tipo: 'unaSola' })

/**
 * Lo que no deja guardar el "Cómo hacerlo" de una guía, tal como está en el
 * editor (sin limpiar, para que los números sean los que ve el autor), en el
 * orden de los pasos. Solo las tareas de acción: las demás no lo guardan.
 */
export function problemasDeComoHacer(pasos: PasoProcedimiento[]): ProblemaComoHacer[] {
  return pasos.flatMap((paso) =>
    paso.bloques
      .filter((bloque) => admiteComoHacer(bloque))
      .flatMap((tarea): ProblemaComoHacer[] => {
        const microPasos = tarea.comoHacer ?? []
        const deLaTarea = { pasoId: paso.id, tareaId: tarea.id, tareaTexto: tarea.texto.trim() }
        if (tieneUnaSolaMicroaccion(microPasos)) {
          const indice = microPasos.findIndex((micro) => !estaEnBlanco(micro))
          return [{ ...deLaTarea, tipo: 'unaSola', microPasoId: microPasos[indice].id, numero: indice + 1 }]
        }
        return microPasos.flatMap((micro, indice): ProblemaComoHacer[] => {
          const faltan = camposQueFaltan(micro)
          if (faltan.length === 0) return []
          return [{ ...deLaTarea, tipo: 'incompleta', microPasoId: micro.id, numero: indice + 1, faltan }]
        })
      }),
  )
}

/**
 * El aviso de "Antes de guardar": "A la microacción 2 de «Abre…» le falta el
 * elemento." o "«Abre…» tiene una sola microacción en Cómo hacerlo: …".
 */
export function mensajeProblemaComoHacer(problema: ProblemaComoHacer): string {
  if (problema.tipo === 'unaSola') {
    const quien = problema.tareaTexto ? `«${problema.tareaTexto}»` : 'Una acción'
    return `${quien} tiene una sola microacción en ${ROTULO_COMO_HACERLO}: escríbela en la instrucción principal o añade otra.`
  }
  const deQue = problema.tareaTexto ? ` de «${problema.tareaTexto}»` : ''
  const loQueFalta =
    problema.faltan.length > 1
      ? 'le faltan la acción y el elemento'
      : problema.faltan[0] === 'accion'
        ? 'le falta la acción'
        : 'le falta el elemento'
  return `A la microacción ${problema.numero}${deQue} ${loQueFalta}.`
}
