import type { Mantenimiento, TipoMantenimiento } from './db'
import { fechaCorta } from './vencimiento'

// LO QUE UN MANTENIMIENTO DICE DE SI MISMO (tarea 320).
//
// Logica pura del modelo, sin React ni base local. Vive en src/lib y no
// en src/features porque el repositorio la necesita para escribir el
// historial (src/lib nunca importa de src/features), igual que
// `resumenConexion` en conexiones.ts. Lo que es de la Agenda o de una
// pantalla esta en src/features/mantenimientos.

export const ETIQUETA_TIPO_MANTENIMIENTO: Record<TipoMantenimiento, string> = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
}

type ConEstado = Pick<Mantenimiento, 'estado'>
type ConValidacion = Pick<Mantenimiento, 'validacion'>

/** Abierto: todavia hay que hacerlo ('programado', o 'pospuesto' con su fecha nueva). */
export function estaAbierto(mantenimiento: ConEstado): boolean {
  return mantenimiento.estado === 'programado' || mantenimiento.estado === 'pospuesto'
}

/** Un antecedente sacado de documentacion historica, sin confirmar. */
export function esPorValidar(mantenimiento: ConValidacion): boolean {
  return mantenimiento.validacion === 'documentado_por_validar'
}

/** "Mantenimiento preventivo". */
export function nombreMantenimiento(tipo: TipoMantenimiento): string {
  return `Mantenimiento ${ETIQUETA_TIPO_MANTENIMIENTO[tipo].toLowerCase()}`
}

/**
 * "2026-10-20" como "20 oct 2026": el historial es para siempre, y "20
 * oct" sin año deja de decir cuándo en cuanto cambia el año. Cadena
 * vacía si no es una fecha.
 */
export function fechaConAnio(fecha: string): string {
  const corta = fechaCorta(fecha)
  return corta ? `${corta} ${fecha.slice(0, 4)}` : ''
}

/** Cómo termina el resumen de un antecedente: nadie debe leerlo como confirmado. */
export const SUFIJO_POR_VALIDAR = ' (documentado, por validar)'

type Resumible = Pick<
  Mantenimiento,
  'tipo' | 'estado' | 'fechaProgramada' | 'fechaRealizada' | 'validacion'
>

/**
 * Una línea que describe el mantenimiento tal como está, para el
 * historial del equipo: "Preventivo para el 20 oct 2026", "Preventivo,
 * pospuesto al 3 nov 2026", "Preventivo para el 20 oct 2026, cancelado",
 * "Preventivo, realizado el 12 oct 2026". Un antecedente lo dice
 * ("documentado, por validar") para que nadie lo lea como confirmado.
 * Dos mantenimientos con el mismo resumen no cambiaron nada que el
 * historial deba contar.
 */
export function resumenMantenimiento(mantenimiento: Resumible): string {
  const tipo = ETIQUETA_TIPO_MANTENIMIENTO[mantenimiento.tipo] ?? mantenimiento.tipo
  const programada = mantenimiento.fechaProgramada ? fechaConAnio(mantenimiento.fechaProgramada) : ''
  const realizada = mantenimiento.fechaRealizada ? fechaConAnio(mantenimiento.fechaRealizada) : ''
  let texto: string
  switch (mantenimiento.estado) {
    case 'pospuesto':
      texto = programada ? `${tipo}, pospuesto al ${programada}` : `${tipo}, pospuesto`
      break
    case 'cancelado':
      texto = programada ? `${tipo} para el ${programada}, cancelado` : `${tipo}, cancelado`
      break
    case 'realizado':
      texto = realizada ? `${tipo}, realizado el ${realizada}` : `${tipo}, realizado`
      break
    default:
      texto = programada ? `${tipo} para el ${programada}` : `${tipo}, sin fecha`
  }
  return esPorValidar(mantenimiento) ? `${texto}${SUFIJO_POR_VALIDAR}` : texto
}

/**
 * Lo que queda escrito en el historial del equipo al cerrar un
 * mantenimiento como realizado: la intervención real, con quién la hizo,
 * cuándo y qué se hizo. Es la evidencia de lo ocurrido; la evidencia en
 * archivo (fotos, actas) cuelga de esta misma entrada.
 */
export function textoIntervencionDeMantenimiento(datos: {
  tipo: TipoMantenimiento
  fechaRealizada: string
  tecnico: string
  resultado: string
}): string {
  const cuando = fechaConAnio(datos.fechaRealizada)
  const quien = datos.tecnico.trim()
  const cabecera = `${nombreMantenimiento(datos.tipo)} realizado el ${cuando}${quien ? ` por ${quien}` : ''}`
  return `${cabecera}: ${datos.resultado.trim()}`
}
