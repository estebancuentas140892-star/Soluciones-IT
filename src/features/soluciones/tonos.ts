import type { ComponentType } from 'react'
import { Code, Info, Lightbulb, Warning, WarningOctagon, type IconoProps } from '../../components/iconos'
import type { TonoAviso } from '../../lib/db'

// Metadatos visuales de cada tono de un bloque de aviso: etiqueta para
// el editor, icono Phosphor y clases de color para la vista. Compartido
// entre PasosEditor (selector) y ProcedimientoVista (render) para que
// ambos usen exactamente los mismos tonos, iconos y colores. Los
// colores son los estados del sistema Nocturne (08_ESTILO.md): panel
// con fondo al 10% y borde al 30% del color del estado, icono en el
// color pleno y texto normal.
export interface TonoInfo {
  valor: TonoAviso
  etiqueta: string
  Icono: ComponentType<IconoProps>
  clasesPanel: string
  claseIcono: string
}

export const TONOS_AVISO: TonoInfo[] = [
  {
    valor: 'info',
    etiqueta: 'Información',
    Icono: Info,
    clasesPanel: 'border-noct-accent/30 bg-noct-accent/10',
    claseIcono: 'text-noct-accent',
  },
  {
    valor: 'precaucion',
    etiqueta: 'Precaución',
    Icono: Warning,
    clasesPanel: 'border-noct-precaucion/30 bg-noct-precaucion/10',
    claseIcono: 'text-noct-precaucion',
  },
  {
    valor: 'importante',
    etiqueta: 'Importante',
    Icono: WarningOctagon,
    clasesPanel: 'border-noct-error/30 bg-noct-error/10',
    claseIcono: 'text-noct-error',
  },
  {
    valor: 'consejo',
    etiqueta: 'Consejo',
    Icono: Lightbulb,
    clasesPanel: 'border-noct-exito/30 bg-noct-exito/10',
    claseIcono: 'text-noct-exito',
  },
  {
    valor: 'dato',
    etiqueta: 'Dato técnico',
    Icono: Code,
    clasesPanel: 'border-noct-neutral-500/30 bg-noct-neutral-500/10',
    claseIcono: 'text-noct-neutral-400',
  },
]

export function tonoInfo(tono: TonoAviso | null): TonoInfo {
  return TONOS_AVISO.find((t) => t.valor === tono) ?? TONOS_AVISO[0]
}
