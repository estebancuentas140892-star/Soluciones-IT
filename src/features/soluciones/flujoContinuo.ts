import type { BloquePaso, PasoAdjunto, VinculoProtegido } from '../../lib/db'

// UN SOLO FLUJO, AUNQUE POR DENTRO SE REUTILICEN OTRAS GUÍAS (tarea 289,
// fase 3).
//
// La complejidad pertenece al sistema, no al técnico. Un procedimiento
// puede reutilizar otros procedimientos internamente, pero el técnico
// experimenta un único flujo continuo.
//
// Hasta ahora, el paso que reutilizaba otra guía era una tarjeta
// ("Guía necesaria", "Abrir guía") y abrirla cambiaba la pantalla a otra
// guía, con su cabecera ("Estás realizando «X» para continuar con «Y»"),
// su numeración ("Paso 1 de 3"), sus requisitos, su "Completar y
// terminar" a mitad del recorrido y un "Volver a la guía principal". El
// técnico tenía que entender cómo estaba construida la guía para seguir.
//
// Ahora las acciones de la guía reutilizada se hacen EN EL SITIO del paso
// que la reutiliza, como acciones de ese paso:
//
//   - la guía que se abrió sigue siendo la identidad visible: su nombre y
//     su contador "1/7" en la cabecera, su ruta en escritorio;
//   - sin tarjeta, sin cabecera propia y sin numeración propia: cada
//     acción dice su título en voz baja, como cualquier otra;
//   - sin requisitos a mitad del recorrido: lo que hace falta se pide
//     antes de empezar, y es lo que escribió el autor de la guía que se
//     abrió; lo que pide la reutilizada no pasa solo (`requisitosEfectivos`);
//   - el "Dónde" y el "Debes ver" del paso acompañan a la primera y a la
//     última acción reutilizada cuando estas no traen los suyos;
//   - "Anterior" desde la primera acción vuelve al paso anterior, y
//     terminar la última sigue con lo que venga ("Completar y seguir"),
//     salvo que con eso termine de verdad la guía que se abrió;
//   - "Tengo un problema" habla del paso de la guía que se abrió, y
//     saltar lleva a su paso siguiente.
//
// El avance no cambia: lo reutilizado se guarda donde siempre, en la fila
// de la ejecución (`vinculos[guiaId]`), así que retomar sigue en la acción
// exacta y la guía reutilizada sigue siendo una sola para todas las que la
// usan. Nada se copia dentro de la guía que la reutiliza.
//
// Lo mismo para el destino del "No" de una decisión: es el camino que
// toca, así que sus acciones siguen en el sitio y, al terminarlas, el
// recorrido continúa con la acción siguiente a la decisión. Y para la
// guía que una TAREA exige antes de marcarse ("necesario"): sus acciones
// se hacen justo antes de la de esa tarea, en el mismo flujo.
//
// LO QUE EL PASO TRAÍA PARA SU PRIMERA ACCIÓN NO SE PIERDE. Un paso que
// reutiliza otra guía puede llevar su propio "para qué" (lo llevan los 13
// pasos así de las guías reales), un aviso, una imagen o una credencial.
// Antes se leían en la pantalla de la tarjeta, antes de abrirla; ahora esa
// pantalla no existe, así que acompañan a la primera acción reutilizada,
// igual que el "Dónde" (`ApoyosDelFlujo`).
//
// Lo que SÍ sigue siendo un desvío es lo opcional: una consulta ("Si lo
// necesitas") o una contingencia ("Si esto falla"). El técnico la abre
// porque quiere; se abre en el mismo sitio, dice qué es y vuelve al paso
// exacto, pero sin vocabulario interno.

/**
 * Lo que el paso que reutiliza otra guía enseñaría con su primera acción
 * (sus avisos, imágenes, archivos, credencial y "para qué"), prestado a la
 * primera acción reutilizada para que no se pierda en el flujo.
 */
export interface ApoyosDelFlujo {
  /** Precaución e importante: antes de la instrucción. */
  alertas: BloquePaso[]
  /** Datos técnicos: a la vista. */
  datos: BloquePaso[]
  /** Información y consejos: en "Más información". */
  plegados: BloquePaso[]
  imagenes: BloquePaso[]
  archivos: PasoAdjunto[]
  /** Términos, atajos y comandos del Centro de consulta enlazados al paso. */
  referencias: BloquePaso[]
  vinculoProtegido: VinculoProtegido | null
  /** El "para qué" del paso, en "Más información". */
  objetivo: string
}

/** ¿Hay algo que prestar? Sin nada, no se pasa nada. */
export function hayApoyosDelFlujo(apoyos: ApoyosDelFlujo): boolean {
  return (
    apoyos.alertas.length > 0 ||
    apoyos.datos.length > 0 ||
    apoyos.plegados.length > 0 ||
    apoyos.imagenes.length > 0 ||
    apoyos.archivos.length > 0 ||
    apoyos.referencias.length > 0 ||
    apoyos.vinculoProtegido !== null ||
    apoyos.objetivo.trim() !== ''
  )
}

/** Lo que la guía que se abrió le dice a la que reutiliza para que se recorra como parte suya. */
export interface IntegracionEnFlujo {
  /** Número del paso de la guía que se abrió: el que dice "Tengo un problema". */
  numeroPaso: number
  /** "Dónde" del paso que reutiliza la guía, para la primera acción si no trae el suyo. */
  lugar: string
  /** "Debes ver" del paso, para la última acción si no trae el suyo. */
  resultado: string
  /** Lo que el paso traía para su primera acción, para la primera acción reutilizada. */
  apoyos?: ApoyosDelFlujo | null
  /** ¿Terminar lo reutilizado termina también la guía que se abrió? Solo entonces se dice "terminar". */
  terminaLaGuia: boolean
  /** "Anterior" desde la primera acción reutilizada. Sin él, no hay a dónde volver. */
  alRetroceder?: () => void
  /** Se hizo algo dentro: lo que la guía que se abrió tenga que saberlo (la línea de "Retomando"). */
  alActuar?: () => void
  /** Saltar el paso de la guía que se abrió, o null si no hay a dónde saltar. */
  alSaltar?: (() => void) | null
}

/** Lo que la ejecución principal tiene que decir de lo que reutiliza, al pedir que se ejecute en el sitio. */
export type EnFlujo = Pick<IntegracionEnFlujo, 'lugar' | 'resultado' | 'apoyos' | 'terminaLaGuia' | 'alRetroceder'>

// Los rótulos de lo que se ofrece desde una acción, por su papel. Nunca
// "guía vinculada", "subguía" ni "procedimiento relacionado": dicen para
// qué sirve, no cómo está construido.
export const ROTULO_NECESARIO = 'Necesario para seguir'
export const ROTULO_CONSULTA = 'Si lo necesitas'
export const ROTULO_CONTINGENCIA = 'Si esto falla'
// El paso que reutiliza una guía que aquí no se puede hacer (más de un
// nivel de anidamiento, o una guía sin pasos): se ofrece para leerla.
export const ROTULO_DEL_PASO = 'Para este paso'
// El camino del "No" de una decisión, donde hace falta nombrarlo (la vista
// de paso entero): es la otra vía, no una falla.
export const ROTULO_SI_NO = 'Si la respuesta es no'

export function rotuloDeIntencion(intencion: BloquePaso['intencionGuia'] | 'necesario'): string {
  if (intencion === 'consulta') return ROTULO_CONSULTA
  if (intencion === 'contingencia') return ROTULO_CONTINGENCIA
  return ROTULO_NECESARIO
}

/** Lo que ya no puede verse nunca en la pantalla de quien ejecuta: palabras de la arquitectura. */
export const TERMINOS_INTERNOS = /subgu[ií]a|gu[ií]as? vinculadas?|procedimientos? vinculados?|sub-?art[ií]culo|gu[ií]a principal/i
