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
