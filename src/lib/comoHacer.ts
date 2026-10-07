import type { BloquePaso, MicroPasoComoHacer } from './db'
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
// mantener. Aquí vive todo lo que no es dibujar: crear, normalizar y leer
// la lista, y las dos formas de decirla.
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

// Sin acción ni elemento no hay gesto que enseñar: es una fila a medio
// crear o un dato que llegó roto. La ubicación sola no dice qué hacer.
function diceAlgo(accion: string, elemento: string): boolean {
  return accion.trim() !== '' || elemento.trim() !== ''
}

/**
 * Las microacciones tal como llegan del JSON, toleradas. Lo que no es una
 * lista, lo que no es un objeto y la microacción sin acción ni elemento se
 * descartan; un campo que no es texto cuenta como vacío. El texto se
 * conserva como se escribió (se recorta al guardar). Un id que falta o que
 * se repite se renueva: el editor mueve y quita por id, y dos iguales
 * serían una sola. Los demás ids no se tocan nunca.
 */
export function normalizarComoHacer(valor: unknown): MicroPasoComoHacer[] {
  if (!Array.isArray(valor)) return []
  const vistos = new Set<string>()
  return valor.flatMap((item): MicroPasoComoHacer[] => {
    if (!item || typeof item !== 'object') return []
    const origen = item as Record<string, unknown>
    const accion = texto(origen.accion)
    const elemento = texto(origen.elemento)
    if (!diceAlgo(accion, elemento)) return []
    const declarado = typeof origen.id === 'string' && origen.id !== '' ? origen.id : null
    const id = declarado && !vistos.has(declarado) ? declarado : crypto.randomUUID()
    vistos.add(id)
    const ubicacion = texto(origen.ubicacion)
    return [{ id, accion, elemento, ...(ubicacion.trim() !== '' ? { ubicacion } : {}) }]
  })
}

/**
 * EL "CÓMO HACERLO" DE UNA TAREA, listo para enseñar y para guardar: cada
 * microacción recortada, sin las vacías y sin `ubicacion` si no la tiene;
 * `[]` si no tiene ninguna o si el bloque no es una tarea de acción. Toda
 * vista lo lee de aquí (también "Probar", que enseña lo que está a medio
 * escribir) y el guardado guarda exactamente esto.
 */
export function comoHacerDe(bloque: BloquePaso): MicroPasoComoHacer[] {
  if (!admiteComoHacer(bloque) || !bloque.comoHacer) return []
  return bloque.comoHacer.flatMap((micro): MicroPasoComoHacer[] => {
    const accion = micro.accion.trim()
    const elemento = micro.elemento.trim()
    if (!diceAlgo(accion, elemento)) return []
    const ubicacion = micro.ubicacion?.trim() ?? ''
    return [{ id: micro.id, accion, elemento, ...(ubicacion !== '' ? { ubicacion } : {}) }]
  })
}

/**
 * Lo que la ruta rápida dice de una microacción: su elemento, que es lo que
 * el técnico busca en la pantalla. Si solo se escribió la acción, la acción:
 * un hueco en la ruta sería peor que un verbo.
 */
export function segmentoDeRuta(micro: MicroPasoComoHacer): string {
  return micro.elemento.trim() || micro.accion.trim()
}

/** Una microacción dicha como frase, sin el punto final: "Abre Fichero". */
export function fraseDeMicroPaso(micro: MicroPasoComoHacer): string {
  return [micro.accion.trim(), micro.elemento.trim()].filter(Boolean).join(' ')
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
