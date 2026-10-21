import { useLiveQuery } from 'dexie-react-hooks'
import { alternarFavorito, esFavorito, type TipoFavorito } from '../lib/favoritos'
import { Star, StarFill } from './iconos'
import { BTN_ICONO_SECUNDARIO, BTN_SECUNDARIO, FILA_ACCION_HOJA } from './nocturne'

// Estrella para marcar una ficha como favorita (fase J1). Dos formas:
// - 'cabecera': boton cuadrado con borde, para la fila de acciones de
//   una ficha (junto a Compartir, Editar, "···").
// - 'fila': solo el icono con tinte al pasar por encima, para una fila
//   de lista (los diagnosticos no tienen ficha propia de consulta).
// El color del estado activo va en el ICONO y no en el boton: una
// clase de color escrita despues de una constante BTN_* no gana (mismo
// empate de especificidad documentado en nocturne.tsx), pero el color
// puesto directamente sobre el svg siempre le gana al heredado.
export function BotonFavorito({
  tipo,
  entidadId,
  variante = 'cabecera',
}: {
  tipo: TipoFavorito
  entidadId: string
  /**
   * `menu` (tarea 329): un botón con su palabra, para el menú "···" de una
   * ficha ("Marcar como favorito" / "Quitar de favoritos"). `hoja` (tarea
   * 342): lo mismo como fila del menú en hoja del teléfono.
   */
  variante?: 'cabecera' | 'fila' | 'menu' | 'hoja'
}) {
  const marcado = useLiveQuery(() => esFavorito(tipo, entidadId), [tipo, entidadId]) ?? false
  const etiqueta = marcado ? 'Quitar de favoritos' : 'Marcar como favorito'
  const Icono = marcado ? StarFill : Star

  if (variante === 'hoja') {
    return (
      <button
        type="button"
        onClick={() => void alternarFavorito(tipo, entidadId)}
        aria-pressed={marcado}
        className={FILA_ACCION_HOJA}
      >
        <Icono size={19} className={`shrink-0 ${marcado ? 'text-noct-accent' : 'text-noct-neutral-300'}`} aria-hidden />
        {etiqueta}
      </button>
    )
  }

  if (variante === 'menu') {
    return (
      <button
        type="button"
        onClick={() => void alternarFavorito(tipo, entidadId)}
        aria-pressed={marcado}
        className={`shrink-0 ${BTN_SECUNDARIO}`}
      >
        <Icono size={14} className={marcado ? 'text-noct-accent' : undefined} aria-hidden />
        {etiqueta}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void alternarFavorito(tipo, entidadId)}
      aria-label={etiqueta}
      aria-pressed={marcado}
      title={etiqueta}
      className={
        variante === 'cabecera'
          ? BTN_ICONO_SECUNDARIO
          : // `toque-amplio` (tarea 349): 44 px de toque en el teléfono, sin
            // cambiar los 34 que se ven ni el hueco de la fila.
            'toque-amplio relative flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded text-noct-neutral-500 hover:bg-noct-text/[.07] active:bg-noct-text/15'
      }
    >
      <Icono size={17} className={marcado ? 'text-noct-accent' : undefined} aria-hidden />
    </button>
  )
}
