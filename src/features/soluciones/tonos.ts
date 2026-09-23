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

// Las descripciones dicen también CÓMO se verá el aviso al ejecutar
// (encargo del 2026-09-17): quien escribe la guía decide si algo
// interrumpe o no eligiendo el tono, así que tiene que saberlo al elegir.
export const TONOS_AVISO: TonoInfo[] = [
  // Información y consejo NO llevan color (encargo del 2026-09-22,
  // sección 4): en una guía los colores significan, y ni una explicación
  // ni un consejo son un lugar, una acción, un resultado o un riesgo. Se
  // distinguen por su icono y su palabra.
  {
    valor: 'info',
    etiqueta: 'Información',
    corto: 'Info',
    descripcion: 'Explicación o contexto. Al ejecutar queda plegado en «Más información»',
    Icono: Info,
    clasesPanel: 'border-noct-divider bg-noct-text/[.04]',
    claseIcono: 'text-noct-neutral-300',
    claseBarra: 'border-noct-neutral-500',
    claseFondo: 'bg-noct-text/[.04]',
  },
  {
    valor: 'precaucion',
    etiqueta: 'Precaución',
    corto: 'Cuidado',
    descripcion: 'Algo que puede salir mal en esta acción. Se ve como alerta junto a ella',
    Icono: Warning,
    // UN RIESGO VA EN ROJO (encargo del 2026-09-22, sección 4). Era
    // ámbar, y dentro de una guía el amarillo pasa a significar "lugar
    // que hay que localizar". Precaución e Importante son los dos riesgos
    // reales: la precaución lleva el rojo con borde y fondo suave; lo
    // importante, el rojo pleno. Los distingue además su icono y su
    // palabra, nunca solo el color.
    clasesPanel: 'border-noct-error/35 bg-noct-error/[.07]',
    claseIcono: 'text-noct-error',
    claseBarra: 'border-noct-error/70',
    claseFondo: 'bg-noct-error/[.07]',
  },
  {
    valor: 'importante',
    etiqueta: 'Importante',
    corto: 'Alerta',
    descripcion: 'Riesgo real: pérdida de datos, ventas o facturación, o algo irreversible. Alerta destacada',
    Icono: WarningOctagon,
    clasesPanel: 'border-noct-error/60 bg-noct-error/[.16]',
    claseIcono: 'text-noct-error',
    claseBarra: 'border-noct-error',
    claseFondo: 'bg-noct-error/[.16]',
  },
  {
    valor: 'consejo',
    etiqueta: 'Consejo',
    corto: 'Consejo',
    descripcion: 'Atajo o buena práctica. Al ejecutar queda plegado en «Más información»',
    Icono: Lightbulb,
    clasesPanel: 'border-noct-divider bg-noct-text/[.04]',
    claseIcono: 'text-noct-neutral-300',
    claseBarra: 'border-noct-neutral-500',
    claseFondo: 'bg-noct-text/[.04]',
  },
  {
    valor: 'dato',
    etiqueta: 'Dato técnico',
    corto: 'Dato',
    descripcion: 'Un valor exacto que hace falta para la acción. Se ve a la vista, sin color de alerta',
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

// CÓMO APARECE CADA AVISO MIENTRAS SE EJECUTA (encargo del 2026-09-17,
// secciones 6 a 8).
//
// Hasta hoy todo aviso era una alerta: con fondo de color y, en la
// ejecución, con su propia pantalla y un "Entendido · continuar" que
// había que tocar antes de seguir, fuera una precaución o un consejo.
// Con cinco o seis por guía el técnico aprendía a tocar sin leer, que
// es justo lo contrario de lo que un aviso quiere.
//
// Ahora el tono decide el trato, y nada detiene el recorrido:
//
//   - 'alerta': precaución e importante. Riesgos reales. Se ven junto a
//     la acción a la que pertenecen, antes de la instrucción y con su
//     color, y como son pocos, destacan.
//   - 'dato': un valor que hace falta para ejecutar la acción. A la
//     vista, pero sin color de alerta.
//   - 'plegado': información y consejo. Sirven para entender, no para
//     hacer: quedan bajo "Más información", cerrado por defecto.
export type PresenciaAviso = 'alerta' | 'dato' | 'plegado'

export function presenciaDeAviso(tono: TonoAviso | null): PresenciaAviso {
  if (tono === 'precaucion' || tono === 'importante') return 'alerta'
  if (tono === 'dato') return 'dato'
  return 'plegado'
}
