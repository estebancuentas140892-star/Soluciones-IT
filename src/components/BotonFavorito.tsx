import { useLiveQuery } from 'dexie-react-hooks'
import { alternarFavorito, esFavorito, type TipoFavorito } from '../lib/favoritos'
import { Boton } from './Boton'
import { Star, StarFill } from './iconos'

// Estrella para marcar una ficha como favorita (fase J1). Desde la tarea
// 291 (auditoría UX, T3 y T8) es un botón de solo icono de 44 x 44 y sin
// borde en las dos formas: la estrella es uno de los iconos universales
// de una cabecera (volver, cerrar, favorito, más). Antes la de una fila
// medía 34 x 34, por debajo del dedo.
// - 'cabecera': en la fila de acciones de una ficha.
// - 'fila': al final de una fila de lista (los diagnosticos no tienen
//   ficha propia de consulta), en el gris de la fila.
// El color del estado activo va en el ICONO y no en el boton: una
// clase de color escrita despues de las del botón no gana (mismo empate
// de especificidad documentado en COMPONENTES_UI.md, sección 0), pero el
// color puesto directamente sobre el svg siempre le gana al heredado.
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
    <Boton
      papel="texto"
      tono={variante === 'fila' ? 'descarte' : undefined}
      soloIcono
      onClick={() => void alternarFavorito(tipo, entidadId)}
      aria-label={etiqueta}
      aria-pressed={marcado}
      title={etiqueta}
      icono={<Icono size={18} className={marcado ? 'text-noct-accent' : undefined} aria-hidden />}
    />
  )
}
