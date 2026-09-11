// Vencimiento de una credencial (fase B2): logica pura para decidir
// si avisar (ambar, se acerca) o alertar (rojo, ya vencio). La fecha
// vive sin cifrar a proposito (Credencial.venceEn): permite avisar sin
// desbloquear la boveda.

// Dias de anticipacion para el aviso ambar antes del vencimiento real.
export const DIAS_AVISO_VENCIMIENTO = 30

export type EstadoVencimiento = 'vencida' | 'proxima' | null

const MS_DIA = 24 * 60 * 60 * 1000
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

// EL CONTEO ES DE DIAS DE CALENDARIO, NO DE HORAS TRANSCURRIDAS.
//
// El defecto que cierra (encargo del 2026-09-09, cambio 6): las dos
// funciones de abajo restaban dos instantes LOCALES y dividian entre 24
// horas. Entre dos medianoches locales no siempre hay 24 horas: en un
// huso con horario de verano hay 23 o 25 el dia del cambio, asi que
// `Math.floor` se dejaba un dia por el camino. Medido: de 2026-09-01 a
// 2026-09-20 hay 19 dias, y en America/Santiago (que cambia la hora en
// septiembre) la formula anterior devolvia 18.
//
// La correccion es aritmetica de calendario: se toman los tres campos
// de la fecha (año, mes, dia) y se comparan en UTC, que no tiene
// horario de verano, asi que la diferencia es siempre un multiplo
// exacto de 24 horas y el resultado no depende del huso.
//
// De `hoy` se lee su fecha LOCAL a proposito: "hoy" es el dia que el
// tecnico tiene en el telefono, no el dia UTC.

/** El dia de una fecha "YYYY-MM-DD" como instante UTC, o null si no lo es. */
function diaDeIso(iso: string): number | null {
  const partes = PATRON_FECHA.exec(iso)
  if (!partes) return null
  const anio = Number(partes[1])
  const mes = Number(partes[2]) - 1
  const dia = Number(partes[3])
  const instante = Date.UTC(anio, mes, dia)
  const fecha = new Date(instante)
  // Rechaza lo imposible: "2026-02-31" se desbordaria a marzo en
  // silencio y describiria un vencimiento que nadie escribio.
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes || fecha.getUTCDate() !== dia) {
    return null
  }
  return instante
}

/** El dia local de `hoy` como instante UTC, para compararlo con el anterior. */
function diaDeHoy(hoy: Date): number {
  return Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
}

/**
 * Dias de calendario entre una fecha "YYYY-MM-DD" y el dia de `hoy`.
 * Positivo si la fecha esta por delante, negativo si ya paso, 0 el
 * mismo dia. `null` si la fecha no es una fecha.
 *
 * Se exporta para poder probar la propiedad que importa: el resultado
 * depende solo de los dias, nunca del huso ni de la hora.
 */
export function diasDeCalendario(fechaIso: string, hoy: Date = new Date()): number | null {
  const dia = diaDeIso(fechaIso)
  if (dia === null) return null
  return Math.round((dia - diaDeHoy(hoy)) / MS_DIA)
}

// null si no hay fecha o falta para vencer mas alla del aviso.
// venceEn en formato "YYYY-MM-DD"; `hoy` es inyectable para pruebas.
export function estadoVencimiento(venceEn: string | null, hoy: Date = new Date()): EstadoVencimiento {
  if (!venceEn) return null
  // Dias completos hasta el vencimiento (inclusive): 0 significa que
  // vence hoy, negativo que ya paso.
  const diasRestantes = diasDeCalendario(venceEn, hoy)
  if (diasRestantes === null) return null

  if (diasRestantes < 0) return 'vencida'
  if (diasRestantes <= DIAS_AVISO_VENCIMIENTO) return 'proxima'
  return null
}

// Cuánto hace que venció, para la fila de la lista de la Bóveda
// (hallazgo M-021 de la auditoría móvil, mockup `9b`). Antes la fila
// vencida solo decía "Vencida", una pastilla que no distingue "venció
// ayer" de "venció hace medio año", cuando la urgencia real es muy
// distinta: solo se llama con un `venceEn` ya vencido, así que no
// vuelve a validar el estado por su cuenta.
export function descripcionVencida(venceEn: string, hoy: Date = new Date()): string {
  const restantes = diasDeCalendario(venceEn, hoy)
  // Una fecha ilegible no puede inventarse una antiguedad: antes salia
  // "Venció hace NaN días" en la fila de la Boveda.
  if (restantes === null) return 'Venció'
  const dias = -restantes
  if (dias <= 0) return 'Venció hoy'
  if (dias === 1) return 'Venció hace 1 día'
  return `Venció hace ${dias} días`
}

// Meses en español, fijos y no localizados por el entorno: `Intl` con
// locale 'es' devuelve "sept." o "sept" según la version de ICU, y la
// agenda de Inicio necesita el mismo texto en todos los telefonos
// ("Vence el 18 sep"), no uno distinto por dispositivo.
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09-18" como "18 sep". Cadena vacia si la fecha no es una fecha. */
function fechaCorta(venceEn: string): string {
  const partes = PATRON_FECHA.exec(venceEn)
  if (!partes) return ''
  const mes = MESES_CORTOS[Number(partes[2]) - 1]
  if (!mes) return ''
  return `${Number(partes[3])} ${mes}`
}

// Como se dice una fecha de vencimiento en la agenda de Inicio.
//
// `descripcionVencida` solo sabe hablar de lo ya vencido (se llama
// unicamente desde la fila de la Boveda, que ya filtro por estado), asi
// que decia "Venció hoy" para cualquier fecha no pasada. En una agenda
// eso es un error visible: una clave que vence dentro de una semana
// aparecia como si hubiera vencido hoy. Aqui cada caso tiene su frase y
// "Venció hoy" no existe: una fecha anterior dice cuanto hace.
export function textoVencimiento(venceEn: string, hoy: Date = new Date()): string {
  const restantes = diasDeCalendario(venceEn, hoy)
  if (restantes === null) return 'Sin fecha'
  if (restantes < 0) {
    const dias = -restantes
    return dias === 1 ? 'Venció hace 1 día' : `Venció hace ${dias} días`
  }
  if (restantes === 0) return 'Vence hoy'
  if (restantes === 1) return 'Vence mañana'
  return `Vence el ${fechaCorta(venceEn)}`
}

// Dias sugeridos al renovar el vencimiento tras detectar que la
// contraseña rotó (hallazgo S1 de AUDITORIA_FLUJOS_TI.md): 90 dias es
// una politica de rotacion tipica; el tecnico puede ajustar la fecha a
// mano despues, el campo sigue siendo un input de fecha normal.
export const DIAS_RENOVACION_VENCIMIENTO = 90

// Proxima fecha de vencimiento sugerida al rotar, en formato
// "YYYY-MM-DD". `hoy` inyectable para pruebas.
export function proximoVencimiento(hoy: Date = new Date()): string {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_RENOVACION_VENCIMIENTO)
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mm}-${dd}`
}

// ¿El vencimiento quedó desactualizado tras rotar la contraseña?
// Verdadero cuando la contraseña cambió respecto a la que se cargó al
// abrir el editor y el vencimiento sigue siendo el mismo que ya estaba
// guardado (el técnico aún no lo tocó desde entonces). Antes de esto,
// rotar una contraseña no reseteaba `venceEn`: el secreto seguía
// "Vencida" o "Próxima" sin que nada avisara que la fecha ya no
// describe la contraseña actual.
export function vencimientoDesactualizado({
  contrasenaActual,
  contrasenaOriginal,
  venceEnActual,
  venceEnOriginal,
}: {
  contrasenaActual: string
  contrasenaOriginal: string
  venceEnActual: string
  venceEnOriginal: string
}): boolean {
  return (
    contrasenaActual.trim() !== '' &&
    contrasenaActual !== contrasenaOriginal &&
    venceEnOriginal !== '' &&
    venceEnActual === venceEnOriginal
  )
}
