import type { Procedimiento } from '../../lib/db'
import { presenciaDeAviso } from './tonos'

// LAS NOTAS Y LOS CONSEJOS DE UNA GUÍA, BAJO DEMANDA (tarea 354; Fase 1 del
// prototipo de Claude Design: «Las notas y consejos de las guías se
// retiraron de la vista (307). Pueden volver bajo demanda», y Fase 4:
// «Orientación y notas pasan a Detalles. Nada se elimina»).
//
// Desde la tarea 307 la ejecución no enseña los avisos de tono Información
// ni Consejo (tampoco uno sin tono, que se lee como Información): la ventana
// responde «¿qué hago ahora?» y esos avisos no lo responden. Siguen
// guardados en las guías reales, y ahora se leen en «Detalles», agrupados
// por la ventana a la que pertenecen, cuando el técnico los busca. La
// ventana no cambia.

export type TonoNota = 'info' | 'consejo'

export interface NotaDeGuia {
  id: string
  tono: TonoNota
  texto: string
}

export interface NotasDeVentana {
  /** La posición del paso en la guía, desde 1 («Ventana 2»). */
  numero: number
  titulo: string
  notas: NotaDeGuia[]
}

/**
 * Las notas y los consejos de cada paso, en el orden de la guía. Solo los
 * pasos que tienen alguna, y solo las que dicen algo (sin texto, nada).
 */
export function notasDeLaGuia(procedimiento: Procedimiento | null | undefined): NotasDeVentana[] {
  if (!procedimiento) return []
  const resultado: NotasDeVentana[] = []
  procedimiento.pasos.forEach((paso, indice) => {
    const notas: NotaDeGuia[] = []
    for (const bloque of paso.bloques) {
      if (bloque.tipo !== 'aviso' || presenciaDeAviso(bloque.tono) !== null) continue
      const texto = bloque.texto.trim()
      if (!texto) continue
      notas.push({ id: bloque.id, tono: bloque.tono === 'consejo' ? 'consejo' : 'info', texto })
    }
    if (notas.length > 0) resultado.push({ numero: indice + 1, titulo: paso.titulo, notas })
  })
  return resultado
}
