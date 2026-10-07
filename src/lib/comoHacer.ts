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
//   - la RUTA RÁPIDA, para el técnico que ya conoce el sitio: los
//     elementos en orden ("Fichero › Cliente › Fichero › Nuevo");
//   - el PASO A PASO, plegado, para quien llega nuevo: cada microacción
//     como una frase numerada ("Abre Fichero."), con su ubicación debajo.
//
// Un solo contenido y dos niveles de lectura: nunca dos textos que
// mantener. Aquí vive todo lo que no es dibujar: crear, normalizar, leer y
// validar la lista, y las dos formas de decirla.
//
// UNA MICROACCIÓN VÁLIDA TIENE SIEMPRE ACCIÓN Y ELEMENTO; la ubicación es
// opcional. Las dos lecturas los necesitan: la ruta rápida está hecha de
// elementos, y el paso a paso, de acción más elemento. Por eso no hay
// sustituto: la ruta nunca enseña una acción en lugar de un elemento, y
// nada inventa el campo que falta. Una a medias no se lee (el normalizador
// la descarta y las vistas no la ven) y el editor no la deja guardar.
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
 * microacción a medias (`microaccionesIncompletas`).
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

/** Una microacción dicha como frase, sin el punto final: "Abre Fichero". */
export function fraseDeMicroPaso(micro: MicroPasoComoHacer): string {
  return `${micro.accion.trim()} ${micro.elemento.trim()}`
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

/**
 * Lo que le falta a una microacción del editor para valer: sus campos
 * obligatorios vacíos, en el orden del formulario. Una fila del todo vacía
 * (sin acción, elemento ni ubicación) todavía no es una microacción: no le
 * falta nada, no se guarda y no impide guardar.
 */
export function camposQueFaltan(micro: MicroPasoComoHacer): CampoObligatorio[] {
  const conAccion = micro.accion.trim() !== ''
  const conElemento = micro.elemento.trim() !== ''
  const conUbicacion = (micro.ubicacion ?? '').trim() !== ''
  if (!conAccion && !conElemento && !conUbicacion) return []
  const faltan: CampoObligatorio[] = []
  if (!conAccion) faltan.push('accion')
  if (!conElemento) faltan.push('elemento')
  return faltan
}

/** Lo que falta, dicho junto a la fila: "Falta el elemento." */
export function textoDeLoQueFalta(faltan: CampoObligatorio[]): string {
  if (faltan.length > 1) return 'Faltan la acción y el elemento.'
  return faltan[0] === 'accion' ? 'Falta la acción.' : 'Falta el elemento.'
}

/** Una microacción a medias, con lo que hace falta para llevar al autor a ella. */
export interface MicroaccionIncompleta {
  pasoId: string
  tareaId: string
  /** El texto de la acción a la que pertenece, para nombrarla. */
  tareaTexto: string
  microPasoId: string
  /** Su número en la lista del editor, empezando en 1. */
  numero: number
  faltan: CampoObligatorio[]
}

/**
 * Las microacciones a medias de una guía, tal como están en el editor (sin
 * limpiar, para que los números sean los que ve el autor), en el orden de
 * los pasos. Solo las de tareas de acción: las demás no se guardan.
 */
export function microaccionesIncompletas(pasos: PasoProcedimiento[]): MicroaccionIncompleta[] {
  return pasos.flatMap((paso) =>
    paso.bloques
      .filter((bloque) => admiteComoHacer(bloque))
      .flatMap((tarea) =>
        (tarea.comoHacer ?? []).flatMap((micro, indice): MicroaccionIncompleta[] => {
          const faltan = camposQueFaltan(micro)
          if (faltan.length === 0) return []
          return [
            {
              pasoId: paso.id,
              tareaId: tarea.id,
              tareaTexto: tarea.texto.trim(),
              microPasoId: micro.id,
              numero: indice + 1,
              faltan,
            },
          ]
        }),
      ),
  )
}

/** El aviso de "Antes de guardar": "A la microacción 2 de «Abre…» le falta el elemento." */
export function mensajeMicroaccionIncompleta(problema: MicroaccionIncompleta): string {
  const deQue = problema.tareaTexto ? ` de «${problema.tareaTexto}»` : ''
  const loQueFalta =
    problema.faltan.length > 1
      ? 'le faltan la acción y el elemento'
      : problema.faltan[0] === 'accion'
        ? 'le falta la acción'
        : 'le falta el elemento'
  return `A la microacción ${problema.numero}${deQue} ${loQueFalta}.`
}
