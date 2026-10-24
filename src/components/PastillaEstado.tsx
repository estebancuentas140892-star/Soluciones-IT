import type { ComponentType, ReactNode } from 'react'
import type { EstadoArticulo } from '../lib/db'
import { estadoConEtiqueta, tonoEstado } from '../features/red/topologiaVisual'
import { PencilSimple, type IconoProps } from './iconos'

// UNA sola forma para todo estado que acompaña a una fila: pastilla de
// contorno (borde teñido sobre el fondo, sin relleno). Nace de la
// auditoría de Soluciones, decisión P1-7 ("estado en una sola forma") y
// P4-8 ("estado de equipo como pastilla de contorno, la misma forma que
// Borrador y Obsoleto en la lista"), y es el `IndicadorEstado` que
// COMPONENTES_UI.md pedía como candidato CAND-1.
//
// El problema que cierra: el mismo tipo de dato se dibujaba de tres
// maneras distintas a la vez. "Borrador" iba con borde punteado y
// relleno ámbar, "Obsoleto" con relleno neutro sólido y sin borde, y el
// estado de un equipo como punto de color más etiqueta. Con una sola
// forma el técnico aprende a leer la ranura derecha de la fila una vez.
//
// Por qué contorno y no relleno: es la regla de Nocturne para el acento
// y aquí aplica igual. Un relleno saturado en cada fila de la lista
// compite con el título, que es lo único que se lee de verdad.

export type TonoPastilla = 'precaucion' | 'neutro' | 'exito' | 'error'

// Las clases van COMPLETAS y literales en un Record, nunca construidas
// como `border-noct-${tono}`: Tailwind analiza el código como texto y no
// genera las utilidades que no encuentre escritas enteras. Misma razón
// que documentan coloresCategoria.ts e iconosSoluciones.ts.
//
// El texto va en el color pleno del estado (o en neutral-300 el neutro)
// y NUNCA en neutral-600: con 11 px esa rampa da 4.0:1 sobre el fondo y
// AA pide 4.5 (regla R2 de la auditoría). neutral-600 queda solo para
// bordes, donde el contraste de texto no aplica.
const CLASES_POR_TONO: Record<TonoPastilla, string> = {
  precaucion: 'border-noct-precaucion/45 text-noct-precaucion',
  neutro: 'border-noct-neutral-600 text-noct-neutral-300',
  exito: 'border-noct-exito/45 text-noct-exito',
  error: 'border-noct-error/45 text-noct-error',
}

const BASE =
  'inline-flex shrink-0 items-center gap-[5px] rounded-full border px-[9px] py-[3px] text-[11px] max-md:text-[12px] font-medium leading-[1.35]'

// LA PASTILLA CON PUNTO DEL TELÉFONO (tarea 342, carnet del handoff móvil
// "1b Pulgar"): la palabra a 12/600 y un punto de 6 px delante, así el estado
// no se lee solo por el color de la palabra. Desde la tarea 352, con el tinte
// de su estado y sin borde, como la pastilla de la tarjeta de Equipos del
// prototipo «Ventana» (`FilaDispositivo`, tarea 350): el mismo estado tiene
// la misma forma en la lista, en la ficha, en el mantenimiento y en la
// facturación. Desde 768 es la pastilla de siempre, sin punto.
const CLASES_PUNTO_TELEFONO: Record<TonoPastilla, string> = {
  precaucion: 'max-md:border-transparent max-md:bg-noct-precaucion-tinte',
  neutro: 'max-md:border-transparent max-md:bg-noct-neutral-900',
  exito: 'max-md:border-transparent max-md:bg-noct-exito-tinte',
  error: 'max-md:border-transparent max-md:bg-noct-error-tinte',
}

export function PastillaEstado({
  tono,
  Icono,
  conPunto = false,
  children,
  className = '',
}: {
  tono: TonoPastilla
  // Icono opcional a la izquierda del rótulo. Va a 10 px: la pastilla es
  // una etiqueta, no un control, así que el glifo acompaña al texto en
  // vez de sustituirlo.
  Icono?: ComponentType<IconoProps>
  /** El punto de color delante de la palabra, solo en el teléfono (tarea 342). */
  conPunto?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`${BASE} ${CLASES_POR_TONO[tono]} ${
        conPunto ? `max-md:px-2.5 max-md:font-bold ${CLASES_PUNTO_TELEFONO[tono]}` : ''
      } ${className}`}
    >
      {conPunto && <span data-punto-estado aria-hidden className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-current max-md:block" />}
      {Icono && <Icono size={10} aria-hidden />}
      {children}
    </span>
  )
}

// EL ESTADO DE UN EQUIPO, en la misma pastilla (tarea 207, hallazgo
// M-017). Se dibujaba a mano en seis sitios como punto de color más
// texto teñido de 11,5 px, mientras la ficha usaba una pastilla con
// punto: el mismo dato cambiaba de forma al cambiar de pantalla, y el
// componente que los unifica llevaba desde la tarea 171 esperando (era
// el candidato CAND-1 de COMPONENTES_UI.md).
//
// El punto suelto SIGUE existiendo en el árbol de topología y en el de
// dependencias: ahí la fila no lleva el rótulo del estado, solo su
// color, y una pastilla por nodo sería ruido en un árbol de veinte.
export function PastillaEstadoDispositivo({
  estado,
  conPunto = false,
  className = '',
}: {
  estado: string
  /** Con el punto del carnet en el teléfono (la ficha del equipo, tarea 342). */
  conPunto?: boolean
  className?: string
}) {
  const { etiqueta } = estadoConEtiqueta(estado)
  return (
    <PastillaEstado tono={tonoEstado(etiqueta)} conPunto={conPunto} className={className}>
      {etiqueta}
    </PastillaEstado>
  )
}

// El estado de un artículo, ya resuelto a tono y rótulo. Devuelve null
// en 'publicado': es el estado normal y no merece ocupar la ranura
// derecha de la fila (si todo lleva pastilla, la pastilla no informa).
export function PastillaEstadoArticulo({
  estado,
  className = '',
}: {
  estado: EstadoArticulo
  className?: string
}) {
  if (estado === 'borrador') {
    return (
      <PastillaEstado tono="precaucion" Icono={PencilSimple} className={className}>
        Borrador
      </PastillaEstado>
    )
  }
  if (estado === 'obsoleto') {
    return (
      <PastillaEstado tono="neutro" className={className}>
        Obsoleto
      </PastillaEstado>
    )
  }
  return null
}
