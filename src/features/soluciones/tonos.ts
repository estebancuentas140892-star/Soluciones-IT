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
  // Etiqueta de una palabra corta para la pastilla del editor (tarea
  // 209): la pastilla mide 56 px de alto pero compite por el ancho con
  // el texto del aviso, asi que "Precaución" no cabe y "Cuidado" si.
  // La palabra larga (`etiqueta`) sigue siendo la que lee el tecnico en
  // la vista de ejecucion, donde ocupa una linea entera.
  corto: string
  // Que significa el tono, para la hoja que lo elige. Antes el tono se
  // ciclaba a ciegas con un icono de 18 px: habia que tocar cinco veces
  // para ver los cinco y ninguno decia para que servia.
  descripcion: string
  Icono: ComponentType<IconoProps>
  clasesPanel: string
  claseIcono: string
  // Barra lateral del aviso en la vista de ejecución (M-012, regla
  // M-R11, tablero `3b`). El aviso es LO ÚNICO del cuerpo de un paso
  // que conserva color de fondo, así que su borde va a color pleno y
  // solo a la izquierda: se lee como una advertencia y no como otro
  // marco más entre los marcos de los vínculos, que ya no existen.
  claseBarra: string
  claseFondo: string
}

export const TONOS_AVISO: TonoInfo[] = [
  {
    valor: 'info',
    etiqueta: 'Información',
    corto: 'Info',
    descripcion: 'Contexto que ayuda a entender el paso',
    Icono: Info,
    clasesPanel: 'border-noct-accent/30 bg-noct-accent/10',
    claseIcono: 'text-noct-accent',
    claseBarra: 'border-noct-accent',
    claseFondo: 'bg-noct-accent/10',
  },
  {
    valor: 'precaucion',
    etiqueta: 'Precaución',
    corto: 'Cuidado',
    descripcion: 'Algo que puede salir mal si no se tiene en cuenta',
    Icono: Warning,
    clasesPanel: 'border-noct-precaucion/30 bg-noct-precaucion/10',
    claseIcono: 'text-noct-precaucion',
    claseBarra: 'border-noct-precaucion',
    claseFondo: 'bg-noct-precaucion/10',
  },
  {
    valor: 'importante',
    etiqueta: 'Importante',
    corto: 'Alerta',
    descripcion: 'Riesgo real: hay que leerlo antes de continuar',
    Icono: WarningOctagon,
    clasesPanel: 'border-noct-error/30 bg-noct-error/10',
    claseIcono: 'text-noct-error',
    claseBarra: 'border-noct-error',
    claseFondo: 'bg-noct-error/10',
  },
  {
    valor: 'consejo',
    etiqueta: 'Consejo',
    corto: 'Consejo',
    descripcion: 'Atajo o buena práctica del equipo',
    Icono: Lightbulb,
    clasesPanel: 'border-noct-exito/30 bg-noct-exito/10',
    claseIcono: 'text-noct-exito',
    claseBarra: 'border-noct-exito',
    claseFondo: 'bg-noct-exito/10',
  },
  {
    valor: 'dato',
    etiqueta: 'Dato técnico',
    corto: 'Dato',
    descripcion: 'Un valor, un comando o una referencia exacta',
    Icono: Code,
    clasesPanel: 'border-noct-neutral-500/30 bg-noct-neutral-500/10',
    claseIcono: 'text-noct-neutral-400',
    claseBarra: 'border-noct-neutral-500',
    claseFondo: 'bg-noct-neutral-500/10',
  },
]

export function tonoInfo(tono: TonoAviso | null): TonoInfo {
  return TONOS_AVISO.find((t) => t.valor === tono) ?? TONOS_AVISO[0]
}
