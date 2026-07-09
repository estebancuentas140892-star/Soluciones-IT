// Estados sugeridos y su representacion visual (fase Dis1, punto 4 de
// PROPUESTA_MODULOS.md): un color e icono por estado conocido para
// identificarlo de un vistazo sin leer texto. El campo sigue siendo
// texto libre (datalist, no un enum cerrado): un estado que el equipo
// escriba distinto de los sugeridos se muestra en gris neutro, sin
// romper nada.

export const ESTADOS_SUGERIDOS = ['Operativo', 'En mantenimiento', 'Fuera de servicio', 'De baja']

export interface EstadoInfo {
  icono: string
  clases: string
}

const NEUTRO: EstadoInfo = { icono: '⚪', clases: 'border-slate-700 bg-slate-800/60 text-slate-300' }

const INFO_POR_ESTADO: Record<string, EstadoInfo> = {
  Operativo: { icono: '🟢', clases: 'border-emerald-800 bg-emerald-950/40 text-emerald-400' },
  'En mantenimiento': { icono: '🟡', clases: 'border-amber-800 bg-amber-950/40 text-amber-400' },
  'Fuera de servicio': { icono: '🔴', clases: 'border-red-800 bg-red-950/40 text-red-400' },
  'De baja': { icono: '⚫', clases: 'border-slate-700 bg-slate-900 text-slate-500' },
}

// Info visual para un estado dado, o el neutro si no es uno de los
// sugeridos (comparacion insensible a mayusculas: "operativo" cuenta
// igual que "Operativo").
export function infoDeEstado(estado: string): EstadoInfo {
  const clave = Object.keys(INFO_POR_ESTADO).find((e) => e.toLowerCase() === estado.trim().toLowerCase())
  return clave ? INFO_POR_ESTADO[clave] : NEUTRO
}
