import type { AutorizacionFacturacion, EstadoAutorizacion } from './db'
import { fechaConAnio } from './mantenimientos'

// AUTORIZACIONES DE FACTURACION: LO QUE TAMBIEN USA EL REPOSITORIO (tarea
// 321). Las etiquetas de cada estado, los numeros como se leen en
// Colombia y el resumen de una autorizacion para el historial de sus POS.
// La Agenda, las validaciones y la ficha viven en
// src/features/facturacion/autorizacion.ts.

export const ESTADOS_AUTORIZACION: readonly EstadoAutorizacion[] = ['documentada', 'confirmada', 'conflicto', 'reemplazada']

const ETIQUETA_ESTADO: Record<EstadoAutorizacion, string> = {
  // "Por validar" dicho sin ambigüedad: lo dice un documento y nadie lo
  // ha comprobado con una fuente actual.
  documentada: 'Documentada, por validar',
  confirmada: 'Confirmada',
  conflicto: 'En conflicto',
  reemplazada: 'Reemplazada',
}

/** Cómo se dice el estado en la interfaz y en el historial. */
export function etiquetaEstadoAutorizacion(estado: EstadoAutorizacion): string {
  return ETIQUETA_ESTADO[estado] ?? estado
}

/**
 * Si la autorización pide que alguien la revise: lo documentado sin
 * comprobar y lo que está en conflicto. Una confirmada o una reemplazada
 * no piden nada.
 */
export function necesitaRevision(autorizacion: Pick<AutorizacionFacturacion, 'estado'>): boolean {
  return autorizacion.estado === 'documentada' || autorizacion.estado === 'conflicto'
}

/**
 * Un entero con el punto de miles, como se escribe en Colombia
 * ("90.000"). Sin `Intl` a propósito: con el locale 'es' algunas
 * versiones de ICU no agrupan los de cuatro cifras ("4100" junto a
 * "52.300"), y la misma pantalla diría distinto lo mismo según el
 * teléfono.
 */
export function formatearNumero(numero: number): string {
  const signo = numero < 0 ? '-' : ''
  return signo + String(Math.abs(Math.trunc(numero))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** "4.100 a 90.000", o '' si el rango no está completo. */
export function textoRango(autorizacion: Pick<AutorizacionFacturacion, 'rangoDesde' | 'rangoHasta'>): string {
  const { rangoDesde, rangoHasta } = autorizacion
  if (rangoDesde === null || rangoHasta === null) return ''
  return `${formatearNumero(rangoDesde)} a ${formatearNumero(rangoHasta)}`
}

type Resumible = Pick<
  AutorizacionFacturacion,
  | 'prefijo'
  | 'rangoDesde'
  | 'rangoHasta'
  | 'estado'
  | 'vencimientoConfirmado'
  | 'consecutivoActual'
  | 'consecutivoLeidoEn'
>

/**
 * Una línea que describe la autorización tal como está, para el
 * historial de sus POS: "PRB · 4.100 a 90.000 · Confirmada · vence el
 * 14 may 2028 · consecutivo 12.345 leído el 3 oct 2026". Dos guardados
 * con el mismo resumen no cambiaron nada que el historial deba contar;
 * una lectura nueva del consecutivo, sí (queda quién la registró y
 * cuándo).
 */
export function resumenAutorizacion(autorizacion: Resumible): string {
  const partes = [autorizacion.prefijo.trim()]
  const rango = textoRango(autorizacion)
  if (rango) partes.push(rango)
  partes.push(etiquetaEstadoAutorizacion(autorizacion.estado))
  if (autorizacion.vencimientoConfirmado) partes.push(`vence el ${fechaConAnio(autorizacion.vencimientoConfirmado)}`)
  if (autorizacion.consecutivoActual !== null && autorizacion.consecutivoLeidoEn) {
    partes.push(
      `consecutivo ${formatearNumero(autorizacion.consecutivoActual)} leído el ${fechaConAnio(autorizacion.consecutivoLeidoEn)}`,
    )
  }
  return partes.join(' · ')
}
