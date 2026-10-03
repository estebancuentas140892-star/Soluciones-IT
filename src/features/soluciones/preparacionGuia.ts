import type { Procedimiento } from '../../lib/db'
import { normalizarTexto } from './iconosSoluciones'

// ANTES DEL PRIMER PASO: QUÉ VOY A RESOLVER Y QUÉ NECESITO (tarea 289,
// fase 2).
//
// Hasta ahora abrir una guía era empezarla en su primera acción (AD-040), y
// los requisitos salían en esa misma pantalla, junto a la acción: preparar y
// ejecutar mezclados. El técnico nuevo no sabía, antes de tocar nada, para
// qué era la guía ni qué tenía que tener a mano.
//
// La preparación son dos pantallas, cada una con un solo propósito, y solo
// cuando tienen algo que decir:
//
//   1. ORIENTAR: qué vas a hacer (el título), cuándo usarla (el "¿Cuándo
//      usar este procedimiento?" que ya escribe el autor, `descripcion`) y
//      el objetivo (`objetivoGeneral`). Sin pasos, sin requisitos, sin
//      credenciales: se lee en un vistazo.
//   2. PREPARAR: los requisitos reales, juntos, y una sola acción para
//      empezar.
//
// No hay campos nuevos: se componen con los que ya existen, así que no hay
// dos verdades para lo mismo. Una guía sin "cuándo usar" ni objetivo no
// tiene orientación; una sin requisitos no tiene preparación; una sin
// ninguna de las dos abre en su primera acción, como siempre.

// "Usa esta guía cuando…", "Usar cuando…", "Utiliza este procedimiento
// únicamente cuando…": el comienzo que repite lo que ya dice el rótulo
// "Cuándo usarla". Solo al principio del texto y solo esa forma; cualquier
// otro comienzo se muestra tal cual.
const COMIENZO_CUANDO =
  /^(?:usa|usar|utiliza|utilizar|úsala|usala|úsalo|usalo)\s+(?:(?:esta|la)\s+gu[ií]a\s+|este\s+procedimiento\s+)?(únicamente\s+|unicamente\s+|solo\s+|sólo\s+|solamente\s+)?cuando\s+/i

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * El "cuándo usar" de una guía tal como se lee bajo "Cuándo usarla":
 * "Usa esta guía cuando necesites X" pasa a "Cuando necesites X"; el resto
 * del texto no se toca. Nunca inventa: solo quita la fórmula repetida.
 */
export function cuandoUsarParaMostrar(descripcion: string): string {
  const limpio = descripcion.trim()
  const coincidencia = COMIENZO_CUANDO.exec(limpio)
  if (!coincidencia) return limpio
  const adverbio = coincidencia[1]?.trim()
  const resto = limpio.slice(coincidencia[0].length)
  return adverbio ? `${mayuscula(adverbio)} cuando ${resto}` : `Cuando ${resto}`
}

export interface Orientacion {
  /** Lo que va bajo "Cuándo usarla", o '' si la guía no lo dice. */
  cuandoUsar: string
  /** El objetivo general, o '' si la guía no lo tiene. */
  objetivo: string
}

/** La orientación de una guía, o null si no tiene nada que orientar. */
export function orientacionDe(procedimiento: Procedimiento): Orientacion | null {
  const cuandoUsar = cuandoUsarParaMostrar(procedimiento.descripcion)
  const objetivo = procedimiento.objetivoGeneral.trim()
  if (cuandoUsar === '' && objetivo === '') return null
  return { cuandoUsar, objetivo }
}

// Dos requisitos son el mismo si solo cambian mayúsculas, tildes, espacios o
// el punto final.
function claveRequisito(texto: string): string {
  return normalizarTexto(texto).replace(/[\s.;:,]+$/u, '').replace(/\s+/g, ' ').trim()
}

/**
 * LO QUE HAY QUE TENER ANTES DE EMPEZAR: los requisitos que escribió el
 * autor de ESTA guía, sin repetidos ni líneas vacías.
 *
 * REGLA DEFINITIVA (tarea 289, criterio adicional de la fase 4): un
 * requisito de una guía reutilizada NO se convierte automáticamente en
 * requisito de la guía que la reutiliza, tampoco el de la guía del paso 1.
 * Que algo tenga que estar listo antes de empezar depende del contexto:
 * puede que Soluciones IT ya lo dé donde se necesita (una credencial, una
 * IP), que sea una acción del propio procedimiento, que sea lo básico que el
 * equipo de Sistemas ya tiene (acceso al computador, Windows, la contraseña
 * de Soluciones IT) o que solo aplique a la otra guía en otros casos (tener
 * Internet, en una guía que diagnostica que no hay Internet). Eso lo decide
 * el autor de esta guía, con lo que piden las otras delante en el editor
 * (`requisitosPorRevisar`), y lo que decide queda escrito aquí: una sola
 * verdad. Hasta este criterio, los de la guía del paso 1 se sumaban solos.
 *
 * Se quitan los repetidos (mismo texto salvo mayúsculas, tildes, espacios
 * y punto final), conservando la primera forma y el orden.
 */
export function requisitosEfectivos(propios: string[]): string[] {
  const vistos = new Set<string>()
  const resultado: string[] = []
  for (const requisito of propios) {
    const texto = requisito.trim()
    const clave = claveRequisito(texto)
    if (clave === '' || vistos.has(clave)) continue
    vistos.add(clave)
    resultado.push(texto)
  }
  return resultado
}

/** Lo que pide una guía que el procedimiento reutiliza: referencia para el autor, nunca un requisito solo. */
export interface RequisitosPorRevisar {
  /** Paso (1, 2, 3...) que la reutiliza. */
  pasoNumero: number
  guiaId: string
  guiaTitulo: string
  /** Sus requisitos que esta guía todavía no pide, sin repetidos. */
  requisitos: string[]
}

/**
 * LO QUE PIDEN LAS GUÍAS QUE ESTA REUTILIZA, COMO REFERENCIA PARA EL AUTOR
 * (tarea 289): todas, la del paso 1 incluida, y las que exige una tarea.
 * Nada de esto pasa solo a "Antes de empezar" (`requisitosEfectivos`): el
 * editor lo enseña plegado y con el criterio para decidir, y solo lo que el
 * autor elige, de uno en uno, se añade a los requisitos de esta guía.
 *
 * De cada guía (una sola vez, en el orden en que se usa) quedan los
 * requisitos que esta guía todavía no pide, y cada uno una sola vez aunque
 * lo pidan dos guías. Una guía que no está en el dispositivo
 * (`requisitosDe` devuelve null) o que no pide nada nuevo no aparece.
 */
export function requisitosPorRevisar(
  procedimiento: Pick<Procedimiento, 'pasos' | 'requisitos'>,
  requisitosDe: (guiaId: string) => { titulo: string; requisitos: string[] } | null,
): RequisitosPorRevisar[] {
  const yaVistos = new Set(requisitosEfectivos(procedimiento.requisitos).map(claveRequisito))
  const guiasVistas = new Set<string>()
  const resultado: RequisitosPorRevisar[] = []
  procedimiento.pasos.forEach((paso, indice) => {
    const deTareas = paso.bloques
      .filter((b) => b.tipo === 'guia' && b.intencionGuia === 'necesario' && b.guiaArticuloId)
      .map((b) => b.guiaArticuloId as string)
    const guias = [...(paso.subArticuloId ? [paso.subArticuloId] : []), ...deTareas]
    for (const guiaId of guias) {
      if (guiasVistas.has(guiaId)) continue
      guiasVistas.add(guiaId)
      const guia = requisitosDe(guiaId)
      if (!guia) continue
      const nuevos = requisitosEfectivos(guia.requisitos).filter((r) => !yaVistos.has(claveRequisito(r)))
      if (nuevos.length === 0) continue
      for (const r of nuevos) yaVistos.add(claveRequisito(r))
      resultado.push({ pasoNumero: indice + 1, guiaId, guiaTitulo: guia.titulo, requisitos: nuevos })
    }
  })
  return resultado
}

export type PantallaPreparacion = 'orientacion' | 'requisitos'

/** Las pantallas de preparación que tiene una guía, en orden. Vacío: abre en su primera acción. */
export function pantallasDePreparacion(orientacion: Orientacion | null, requisitos: string[]): PantallaPreparacion[] {
  const pantallas: PantallaPreparacion[] = []
  if (orientacion) pantallas.push('orientacion')
  if (requisitos.length > 0) pantallas.push('requisitos')
  return pantallas
}
