import { BookBookmark, Keyboard, TerminalWindow, Wrench, type IconoProps } from '../../components/iconos'
import type { TipoReferencia } from '../../lib/db'

// EL GLIFO DE CADA TIPO DEL CENTRO DE CONSULTA, EN UN SOLO SITIO.
//
// Estaba repetido en cinco componentes (la lista, la ficha, el editor,
// el selector de las guias y la hoja de consulta), cada uno con su
// propio ternario. Con un cuarto tipo, cualquiera de esas copias que se
// olvidara dibujaria una herramienta con el libro del glosario. Cada
// tipo lleva su glifo propio y no solo su color (regla R16).

type Icono = (props: IconoProps) => React.JSX.Element

export const ICONO_POR_TIPO: Record<TipoReferencia, Icono> = {
  herramienta: Wrench,
  termino: BookBookmark,
  atajo: Keyboard,
  comando: TerminalWindow,
}

/**
 * Glifo de un tipo que puede no saberse: una ficha que no está en este
 * dispositivo, o una fila escrita por una versión más nueva de la app.
 */
export function iconoDeReferencia(tipo: TipoReferencia | null | undefined): Icono {
  return (tipo && ICONO_POR_TIPO[tipo]) || BookBookmark
}
