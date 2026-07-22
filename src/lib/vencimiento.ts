// Vencimiento de una credencial (fase B2): logica pura para decidir
// si avisar (ambar, se acerca) o alertar (rojo, ya vencio). La fecha
// vive sin cifrar a proposito (Credencial.venceEn): permite avisar sin
// desbloquear la boveda.

// Dias de anticipacion para el aviso ambar antes del vencimiento real.
export const DIAS_AVISO_VENCIMIENTO = 30

export type EstadoVencimiento = 'vencida' | 'proxima' | null

// null si no hay fecha o falta para vencer mas alla del aviso.
// venceEn en formato "YYYY-MM-DD"; `hoy` es inyectable para pruebas.
export function estadoVencimiento(venceEn: string | null, hoy: Date = new Date()): EstadoVencimiento {
  if (!venceEn) return null
  const fechaVencimiento = new Date(`${venceEn}T00:00:00`)
  if (Number.isNaN(fechaVencimiento.getTime())) return null

  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  // Dias completos hasta el vencimiento (inclusive): 0 significa que
  // vence hoy, negativo que ya paso.
  const diasRestantes = Math.floor((fechaVencimiento.getTime() - inicioHoy.getTime()) / (24 * 60 * 60 * 1000))

  if (diasRestantes < 0) return 'vencida'
  if (diasRestantes <= DIAS_AVISO_VENCIMIENTO) return 'proxima'
  return null
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
