import type { Dispositivo, Mantenimiento } from '../../lib/db'
import { estaAbierto, nombreMantenimiento } from '../../lib/mantenimientos'
import { diasDeCalendario, DIAS_AVISO_VENCIMIENTO, fechaCorta } from '../../lib/vencimiento'
import type { ItemPendiente } from '../inicio/pendientes'

// MANTENIMIENTOS EN LA AGENDA Y EN LA FICHA (tarea 320).
//
// La Agenda no gana un gestor de tareas: deriva los mantenimientos de la
// fecha programada de los que siguen abiertos, igual que deriva un
// acceso que vence. Entra solo lo que de verdad se puede fechar:
//   - abierto ('programado' o 'pospuesto'), confirmado y sin eliminar;
//   - con una fecha programada legible;
//   - de un equipo que existe y no se elimino.
// Un antecedente sacado de documentacion historica ('documentado por
// validar') NUNCA entra: que un cronograma antiguo lo marcara no dice
// que siga pendiente hoy.
//
// Vencidos sin limite (un mantenimiento atrasado sigue ahi hasta que se
// cierra, se pospone o se cancela), hoy, y proximos dentro del mismo
// aviso que un acceso (`DIAS_AVISO_VENCIMIENTO`, 30 dias): uno para
// dentro de tres meses no pide nada hoy.

type MantenimientoDeAgenda = Pick<
  Mantenimiento,
  'id' | 'dispositivoId' | 'tipo' | 'fechaProgramada' | 'estado' | 'validacion' | 'eliminadoEn'
>
type EquipoDeAgenda = Pick<Dispositivo, 'id' | 'nombre' | 'eliminadoEn'>

/** Si un mantenimiento se puede fechar en la Agenda (sin mirar la ventana de aviso). */
export function entraEnAgenda(mantenimiento: MantenimientoDeAgenda): boolean {
  return (
    !mantenimiento.eliminadoEn &&
    estaAbierto(mantenimiento) &&
    mantenimiento.validacion === 'confirmado' &&
    Boolean(mantenimiento.fechaProgramada)
  )
}

function dias(n: number): string {
  return n === 1 ? '1 día' : `${n} días`
}

/** "Atrasado 3 días", "Toca hoy", "Toca mañana", "Toca el 20 oct". Corto: es la razón de una fila en el teléfono. */
export function textoProgramado(fecha: string, diasRestantes: number): string {
  if (diasRestantes < 0) return `Atrasado ${dias(-diasRestantes)}`
  if (diasRestantes === 0) return 'Toca hoy'
  if (diasRestantes === 1) return 'Toca mañana'
  return `Toca el ${fechaCorta(fecha)}`
}

/**
 * Los mantenimientos que la Agenda tiene que mostrar hoy: el título es el
 * equipo (lo que hay que atender, nunca recortado), la razón cuándo toca
 * y el origen qué mantenimiento es. Lleva a la pantalla del mantenimiento,
 * donde se registra cómo terminó.
 */
export function mantenimientosEnAgenda(
  mantenimientos: MantenimientoDeAgenda[],
  dispositivos: EquipoDeAgenda[],
  hoy: Date = new Date(),
): ItemPendiente[] {
  const equipos = new Map(dispositivos.map((d) => [d.id, d]))
  return mantenimientos.filter(entraEnAgenda).flatMap((m): ItemPendiente[] => {
    const equipo = equipos.get(m.dispositivoId)
    if (!equipo || equipo.eliminadoEn) return []
    const fecha = m.fechaProgramada as string
    const restantes = diasDeCalendario(fecha, hoy)
    if (restantes === null || restantes > DIAS_AVISO_VENCIMIENTO) return []
    return [
      {
        clave: `mantenimiento:${m.id}`,
        titulo: equipo.nombre,
        detalle: textoProgramado(fecha, restantes),
        ruta: `/dispositivos/${m.dispositivoId}/mantenimientos/${m.id}`,
        tono: restantes <= 0 ? 'precaucion' : 'neutro',
        categoria: 'mantenimiento',
        fecha,
        diasRestantes: restantes,
        origen: nombreMantenimiento(m.tipo),
      },
    ]
  })
}

/**
 * Lo que dice la fila plegada "Mantenimiento" de la ficha: el abierto más
 * cercano ("Atrasado", "Hoy", "20 oct") o "Ninguno". Los antecedentes por
 * validar no cuentan: no son trabajo pendiente.
 */
export function conteoDeMantenimientos(mantenimientos: MantenimientoDeAgenda[], hoy: Date = new Date()): string {
  const fechas = mantenimientos
    .filter(entraEnAgenda)
    .map((m) => m.fechaProgramada as string)
    .sort()
  const primera = fechas[0]
  if (!primera) return 'Ninguno'
  const restantes = diasDeCalendario(primera, hoy)
  if (restantes === null) return 'Ninguno'
  if (restantes < 0) return 'Atrasado'
  if (restantes === 0) return 'Hoy'
  return fechaCorta(primera)
}

// ----------------------------------------------------------------
// Lo que pide cada gesto antes de guardar
// ----------------------------------------------------------------
//
// Devuelven el mensaje que se enseña junto al botón, o null si se puede
// guardar. Las fechas llegan como las da un <input type="date">
// ("YYYY-MM-DD"); `hoy` es el día del teléfono.

function esFecha(texto: string): boolean {
  return diasDeCalendario(texto, new Date()) !== null
}

/** Programar: una fecha de hoy en adelante. */
export function errorDeProgramacion(fechaProgramada: string, hoy: Date = new Date()): string | null {
  if (!fechaProgramada) return 'Elige la fecha en que toca.'
  if (!esFecha(fechaProgramada)) return 'La fecha no es válida.'
  if ((diasDeCalendario(fechaProgramada, hoy) as number) < 0) return 'La fecha no puede ser anterior a hoy.'
  return null
}

/** Cerrar como realizado: cuándo se hizo (hasta hoy), quién lo hizo y qué se hizo. */
export function errorDeCierre(
  datos: { fechaRealizada: string; tecnico: string; resultado: string },
  hoy: Date = new Date(),
): string | null {
  if (!datos.fechaRealizada) return 'Di en qué fecha se hizo.'
  if (!esFecha(datos.fechaRealizada)) return 'La fecha no es válida.'
  if ((diasDeCalendario(datos.fechaRealizada, hoy) as number) > 0) return 'No puede haberse hecho en una fecha futura.'
  if (!datos.tecnico.trim()) return 'Di quién lo hizo.'
  if (!datos.resultado.trim()) return 'Di qué se hizo y cómo quedó.'
  return null
}

/** Posponer: una fecha nueva, de hoy en adelante y distinta de la que tenía. */
export function errorDePosposicion(
  nuevaFecha: string,
  fechaActual: string | null,
  hoy: Date = new Date(),
): string | null {
  const error = errorDeProgramacion(nuevaFecha, hoy)
  if (error) return error
  if (nuevaFecha === fechaActual) return 'Elige una fecha distinta de la que tenía.'
  return null
}

/** Cancelar: siempre con el motivo, que queda en el historial del equipo. */
export function errorDeCancelacion(motivo: string): string | null {
  return motivo.trim() ? null : 'Di por qué se cancela.'
}

/** La fecha de hoy como la escribe un <input type="date">: "YYYY-MM-DD", en el día del teléfono. */
export function hoyIso(hoy: Date = new Date()): string {
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mm}-${dd}`
}
