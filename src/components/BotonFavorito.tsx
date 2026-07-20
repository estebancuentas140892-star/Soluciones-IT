import { useLiveQuery } from 'dexie-react-hooks'
import { alternarFavorito, esFavorito, type TipoFavorito } from '../lib/favoritos'
import { Star, StarFill } from './iconos'
import { BTN_ICONO_SECUNDARIO } from './nocturne'

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
  variante?: 'cabecera' | 'fila'
}) {
  const marcado = useLiveQuery(() => esFavorito(tipo, entidadId), [tipo, entidadId]) ?? false
  const etiqueta = marcado ? 'Quitar de favoritos' : 'Marcar como favorito'
  const Icono = marcado ? StarFill : Star

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
          : 'flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded text-noct-neutral-500 hover:bg-noct-text/[.07] active:bg-noct-text/15'
      }
    >
      <Icono size={17} className={marcado ? 'text-noct-accent' : undefined} aria-hidden />
    </button>
  )
}
