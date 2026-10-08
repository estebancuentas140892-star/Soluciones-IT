import type { ComponentType } from 'react'
import { Code, Info, Lightbulb, Warning, WarningOctagon, type IconoProps } from '../../components/iconos'
import type { TonoAviso, TonoAvisoVigente } from '../../lib/db'

// Metadatos visuales de cada tono de un bloque de aviso: etiqueta para
// el editor, icono Phosphor y clases de color para la vista. Compartido
// entre PasosEditor (selector) y las vistas de la ejecución para que
// todos usen exactamente los mismos tonos, iconos y colores. Los
// colores son los estados del sistema Nocturne (08_ESTILO.md): panel
// con fondo al 10% y borde al 30% del color del estado, icono en el
// color pleno y texto normal.
interface TonoBase {
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
  // La pastilla y el campo del aviso en el editor.
  clasesPanel: string
  claseIcono: string
}

export interface TonoInfo extends TonoBase {
  valor: TonoAvisoVigente
  // Barra lateral y fondo del aviso en la vista de ejecución (M-012,
  // regla M-R11, tablero `3b`). La advertencia es LO ÚNICO del cuerpo de
  // un paso que conserva color de fondo, así que su borde va a color pleno
  // y solo a la izquierda: se lee como una advertencia y no como otro
  // marco más.
  claseBarra: string
  claseFondo: string
}

// LOS TONOS QUE SE OFRECEN (tarea 307). Un aviso es un riesgo real o un
// valor exacto; nada más. Las descripciones dicen CÓMO se verá al ejecutar
// (encargo del 2026-09-17): quien escribe la guía decide si algo
// interrumpe eligiendo el tono, así que tiene que saberlo al elegir, y qué
// NO va en cada uno (regla 27).
export const TONOS_AVISO: TonoInfo[] = [
  {
    valor: 'precaucion',
    etiqueta: 'Precaución',
    corto: 'Cuidado',
    // Desde la tarea 311 un riesgo se lee ANTES de su acción, en su propia
    // pantalla: lo dice al elegirlo.
    descripcion: 'Un riesgo real. Al ejecutar se mostrará antes de la acción.',
    Icono: Warning,
    // UN RIESGO VA EN ROJO (encargo del 2026-09-22, sección 4). Era
    // ámbar, y en una guía el ámbar no dice "riesgo" (con texto, desde la
    // sección 13 de la auditoría UX, es "requiere atención"). Precaución e
    // Importante son los dos riesgos reales: la precaución lleva el rojo
    // con borde y fondo suave; lo importante, el rojo pleno. Los distingue
    // además su icono y su palabra, nunca solo el color.
    clasesPanel: 'border-noct-error/35 bg-noct-error/[.07]',
    claseIcono: 'text-noct-error',
    claseBarra: 'border-noct-error/70',
    claseFondo: 'bg-noct-error/[.07]',
  },
  {
    valor: 'importante',
    etiqueta: 'Importante',
    corto: 'Alerta',
    descripcion: 'Riesgo grave o irreversible. Se mostrará como alerta antes de la acción.',
    Icono: WarningOctagon,
    clasesPanel: 'border-noct-error/60 bg-noct-error/[.16]',
    claseIcono: 'text-noct-error',
    claseBarra: 'border-noct-error',
    claseFondo: 'bg-noct-error/[.16]',
  },
  {
    valor: 'dato',
    etiqueta: 'Dato técnico',
    corto: 'Dato',
    descripcion:
      'Un valor exacto que la acción necesita (IP, puerto, ruta, comando, nombre de archivo), no los pasos para hacerla: esos van en «Cómo hacerlo» de la acción. Se ve bajo la acción, sin color de alerta',
    Icono: Code,
    clasesPanel: 'border-noct-neutral-500/30 bg-noct-neutral-500/10',
    claseIcono: 'text-noct-neutral-400',
    claseBarra: 'border-noct-neutral-500',
    claseFondo: 'bg-noct-neutral-500/10',
  },
]

// LOS TONOS HEREDADOS (obsoletos desde la tarea 307, AD-068). Información
// y Consejo explicaban sin hacer falta para actuar, y su único sitio en la
// ejecución era "Más información", que se retiró: durante la ejecución se
// trabaja, y lo que hay que leer para hacer bien la acción no es "más
// información" (es una advertencia, un dato o "Cómo hacerlo"). Los avisos
// que ya los tienen se siguen leyendo y guardando, y el editor los enseña
// con su palabra y lo que pasa con ellos para que el autor decida; ni la
// ejecución los muestra ni el editor los ofrece para un aviso nuevo.
export const TONOS_RETIRADOS: TonoBase[] = [
  {
    valor: 'info',
    etiqueta: 'Información',
    corto: 'Info',
    descripcion: 'Ya no se muestra al ejecutar',
    Icono: Info,
    clasesPanel: 'border-noct-divider bg-noct-text/[.04]',
    claseIcono: 'text-noct-neutral-300',
  },
  {
    valor: 'consejo',
    etiqueta: 'Consejo',
    corto: 'Consejo',
    descripcion: 'Ya no se muestra al ejecutar',
    Icono: Lightbulb,
    clasesPanel: 'border-noct-divider bg-noct-text/[.04]',
    claseIcono: 'text-noct-neutral-300',
  },
]

/** El tono vigente de un aviso, o null si es uno heredado (o no tiene). */
export function tonoVigente(tono: TonoAviso | null): TonoInfo | null {
  return TONOS_AVISO.find((t) => t.valor === tono) ?? null
}

/**
 * Cómo se presenta un aviso en el editor, sea cual sea su tono: los
 * heredados también tienen que poder verse y cambiarse. Un tono que no se
 * reconoce se trata como Información, igual que lo lee el normalizador.
 */
export function tonoDelEditor(tono: TonoAviso | null): TonoBase {
  return tonoVigente(tono) ?? TONOS_RETIRADOS.find((t) => t.valor === tono) ?? TONOS_RETIRADOS[0]
}

// CÓMO APARECE CADA AVISO MIENTRAS SE EJECUTA (encargo del 2026-09-17,
// secciones 6 a 8; tarea 307).
//
// El tono decide el trato:
//
//   - 'alerta': precaución e importante. Riesgos reales. Son lo único que
//     detiene el recorrido: se leen ANTES de la acción a la que pertenecen,
//     en su propia pantalla, con "Entiendo, continuar" (tarea 311, la
//     advertencia previa de advertenciaPrevia.ts). Hasta la 311 iban a la
//     vista bajo la instrucción. Nunca plegados.
//   - 'dato': un valor que hace falta para ejecutar la acción. A la
//     vista, subordinado a la instrucción (su rótulo y monoespaciada,
//     tarea 303), sin color de alerta.
//   - null: información y consejo, heredados. No se muestran (tarea 307):
//     no se pliegan en ningún sitio ni dejan un hueco.
export type PresenciaAviso = 'alerta' | 'dato'

export function presenciaDeAviso(tono: TonoAviso | null): PresenciaAviso | null {
  if (tono === 'precaucion' || tono === 'importante') return 'alerta'
  if (tono === 'dato') return 'dato'
  return null
}
