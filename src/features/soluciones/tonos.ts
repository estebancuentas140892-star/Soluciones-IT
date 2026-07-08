import type { TonoAviso } from '../../lib/db'

// Metadatos visuales de cada tono de un bloque de aviso: etiqueta para
// el editor, icono y clases de color para la vista. Compartido entre
// PasosEditor (selector) y ProcedimientoVista (render) para que ambos
// usen exactamente los mismos tonos, iconos y colores.
export interface TonoInfo {
  valor: TonoAviso
  etiqueta: string
  icono: string
  clases: string
}

export const TONOS_AVISO: TonoInfo[] = [
  {
    valor: 'info',
    etiqueta: 'Información',
    icono: 'ℹ️',
    clases: 'border-sky-900/60 bg-sky-950/30 text-sky-200',
  },
  {
    valor: 'precaucion',
    etiqueta: 'Precaución',
    icono: '⚠️',
    clases: 'border-amber-900/60 bg-amber-950/30 text-amber-200',
  },
  {
    valor: 'importante',
    etiqueta: 'Importante',
    icono: '⛔',
    clases: 'border-red-900/60 bg-red-950/30 text-red-200',
  },
  {
    valor: 'consejo',
    etiqueta: 'Consejo',
    icono: '💡',
    clases: 'border-emerald-900/60 bg-emerald-950/30 text-emerald-200',
  },
  {
    valor: 'dato',
    etiqueta: 'Dato técnico',
    icono: '🔧',
    clases: 'border-violet-900/60 bg-violet-950/30 text-violet-200',
  },
]

export function tonoInfo(tono: TonoAviso | null): TonoInfo {
  return TONOS_AVISO.find((t) => t.valor === tono) ?? TONOS_AVISO[0]
}
