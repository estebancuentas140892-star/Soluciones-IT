import type { Dispositivo, Tarea } from '../../lib/db'
import { diasDeCalendario } from '../../lib/vencimiento'
import type { ItemPendiente } from './pendientes'

// LAS TAREAS PROPIAS EN LA AGENDA (tarea 365, D5 de la auditoría de Resolver,
// Equipos y Agenda del 2026-10-27, AD-100).
//
// La Agenda solo leía datos que nacen en otras pantallas (la clave que vence,
// el ingreso de una persona, el mantenimiento programado): no se podía
// registrar nada. Una tarea es lo mínimo para no olvidar algo: qué, para
// cuándo (si se sabe), con qué equipo (si lo hay) y una nota. Con fecha entra
// en Vencidos, Para hoy o Próximos junto a lo demás, por su día; sin fecha, en
// «Sin fecha». Hecha, sale de la lista (con «Deshacer», sin historial a la
// vista).
//
// Lógica pura, sin React ni base de datos, para probarla sola.

const SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** "YYYY-MM-DD" del día local de `fecha`. */
export function isoDelDia(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mm}-${dd}`
}

function diaMas(hoy: Date, dias: number): Date {
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias)
}

/**
 * Por qué está la tarea en la lista, dicho en palabras: «Era para ayer»,
 * «Para hoy», «Para el viernes 30» (esta semana), «Para el 8 nov» o «Sin
 * fecha». Es la razón de su fila, en el color de su estado.
 */
export function razonTarea(dias: number | null, hoy: Date = new Date()): string {
  if (dias === null) return 'Sin fecha'
  if (dias < -1) return `Era para hace ${-dias} días`
  if (dias === -1) return 'Era para ayer'
  if (dias === 0) return 'Para hoy'
  if (dias === 1) return 'Para mañana'
  const dia = diaMas(hoy, dias)
  if (dias <= 6) return `Para el ${SEMANA[dia.getDay()]} ${dia.getDate()}`
  return `Para el ${dia.getDate()} ${MESES[dia.getMonth()]}`
}

/** El tono de su fila: vencida en error, de hoy en precaución, lo demás neutro. */
export function tonoTarea(dias: number | null): ItemPendiente['tono'] {
  if (dias === null) return 'neutro'
  return dias < 0 ? 'error' : dias === 0 ? 'precaucion' : 'neutro'
}

/** ¿Sigue pendiente? Ni hecha ni eliminada. */
export function tareaAbierta(tarea: Pick<Tarea, 'hechaEn' | 'eliminadoEn'>): boolean {
  return !tarea.hechaEn && !tarea.eliminadoEn
}

/**
 * Las tareas abiertas como asuntos de la Agenda. El origen es el equipo, si
 * lo tiene y sigue vivo: es lo que la sitúa («· PC-COMPRAS-04»). Todas las de
 * fecha entran, también las lejanas: son recordatorios propios, no avisos del
 * sistema con su periodo de aviso.
 */
export function tareasEnAgenda(
  tareas: Tarea[],
  dispositivos: Pick<Dispositivo, 'id' | 'nombre' | 'eliminadoEn'>[],
  hoy: Date = new Date(),
): ItemPendiente[] {
  const equipos = new Map(dispositivos.map((d) => [d.id, d]))
  return tareas.filter(tareaAbierta).map((tarea) => {
    const dias = tarea.fecha ? diasDeCalendario(tarea.fecha, hoy) : null
    const equipo = tarea.dispositivoId ? equipos.get(tarea.dispositivoId) : undefined
    return {
      clave: `tarea:${tarea.id}`,
      titulo: tarea.titulo,
      detalle: razonTarea(dias, hoy),
      ruta: '/agenda',
      tono: tonoTarea(dias),
      categoria: 'tarea',
      fecha: dias === null ? null : tarea.fecha,
      diasRestantes: dias,
      origen: equipo && !equipo.eliminadoEn ? equipo.nombre : '',
      tareaId: tarea.id,
    }
  })
}

// ----------------------------------------------------------------
// LA HOJA «NUEVA TAREA»
// ----------------------------------------------------------------

/** Las opciones de «¿Cuándo?». */
export type Cuando = 'hoy' | 'manana' | 'viernes' | 'fecha' | 'sin'

/**
 * Las opciones de «¿Cuándo?», en el orden del prototipo: Hoy, Mañana, el
 * viernes de esta semana («Viernes 30») si cae después de mañana, Otra fecha
 * y Sin fecha. Un mantenimiento necesita fecha: sin «Sin fecha».
 */
export function opcionesCuando(hoy: Date = new Date(), conSinFecha = true): { valor: Cuando; texto: string }[] {
  const hastaViernes = (5 - hoy.getDay() + 7) % 7
  const viernes = diaMas(hoy, hastaViernes)
  return [
    { valor: 'hoy' as const, texto: 'Hoy' },
    { valor: 'manana' as const, texto: 'Mañana' },
    ...(hastaViernes >= 2 ? [{ valor: 'viernes' as const, texto: `Viernes ${viernes.getDate()}` }] : []),
    { valor: 'fecha' as const, texto: 'Otra fecha' },
    ...(conSinFecha ? [{ valor: 'sin' as const, texto: 'Sin fecha' }] : []),
  ]
}

/**
 * La fecha que guarda la elección: "YYYY-MM-DD", null (sin fecha) o
 * undefined si eligió «Otra fecha» y todavía no la escribió.
 */
export function fechaDeCuando(cuando: Cuando, otraFecha: string, hoy: Date = new Date()): string | null | undefined {
  switch (cuando) {
    case 'hoy':
      return isoDelDia(hoy)
    case 'manana':
      return isoDelDia(diaMas(hoy, 1))
    case 'viernes':
      return isoDelDia(diaMas(hoy, (5 - hoy.getDay() + 7) % 7))
    case 'fecha':
      return otraFecha || undefined
    case 'sin':
      return null
  }
}

/** Al editar, la opción que corresponde a la fecha guardada. */
export function cuandoDeFecha(fecha: string | null, hoy: Date = new Date()): { cuando: Cuando; otraFecha: string } {
  if (!fecha) return { cuando: 'sin', otraFecha: '' }
  if (fecha === isoDelDia(hoy)) return { cuando: 'hoy', otraFecha: '' }
  if (fecha === isoDelDia(diaMas(hoy, 1))) return { cuando: 'manana', otraFecha: '' }
  return { cuando: 'fecha', otraFecha: fecha }
}

/**
 * Lo que falta para guardar, dicho en una frase (regla 31 b: lo que no se
 * puede, dice por qué), o null si se puede.
 */
export function errorDeTarea({
  titulo,
  cuando,
  otraFecha,
  mantenimiento,
}: {
  titulo: string
  cuando: Cuando
  otraFecha: string
  mantenimiento: boolean
}): string | null {
  if (!mantenimiento && !titulo.trim()) return 'Escribe qué hay que hacer.'
  if (cuando === 'fecha' && !otraFecha) return 'Elige la fecha.'
  if (mantenimiento && cuando === 'sin') return 'Un mantenimiento necesita fecha.'
  return null
}

/**
 * «Después: …» o «Y N más en la Agenda», bajo las filas de «Tu trabajo de
 * hoy» (D6). Con más urgentes de los que caben, cuántos faltan; si no, lo
 * próximo, en una línea; si no hay nada próximo, nada.
 */
export function lineaDespues(
  urgentesOcultos: number,
  primeroProximo: Pick<ItemPendiente, 'titulo' | 'detalle'> | null,
): { prefijo: string; texto: string } | null {
  if (urgentesOcultos > 0) return { prefijo: '', texto: `Y ${urgentesOcultos} más en la Agenda` }
  if (!primeroProximo) return null
  const razon = primeroProximo.detalle.charAt(0).toLowerCase() + primeroProximo.detalle.slice(1)
  return { prefijo: 'Después: ', texto: `${primeroProximo.titulo} · ${razon}` }
}
