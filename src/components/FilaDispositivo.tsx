import { Link } from 'react-router-dom'
import type { Dispositivo } from '../lib/db'
import { VALOR_TECNICO_COMPACTO } from './FilaDato'
import { MiniaturaPortada } from './MiniaturaPortada'
import { IconoNodo } from '../features/red/IconoNodo'
import { estadoEnLista, tipoDeNodoVisual, type TonoEstado } from '../features/red/topologiaVisual'
import { partirTitulo } from '../features/busqueda/resultados'
import { normalizarTexto } from '../features/soluciones/iconosSoluciones'

// Fila de un dispositivo en un listado, compartida por Dispositivos y
// Red (Fase 1 de PROPUESTA_REVISION_ARQUITECTURA.md): avatar (foto del
// equipo o icono de su tipo de nodo), nombre, una linea de contexto y,
// a la derecha, el estado y la IP. Antes las dos pantallas la repetian
// calcada salvo por dos detalles, que son justamente las dos props de
// abajo.
//
// PROPUESTA FINAL DE CLAUDE DESIGN (2026-10-01). El nombre es el dato
// principal (15 px) y, al buscar, la coincidencia se resalta dentro de él.
// El estado solo aparece cuando es una EXCEPCIÓN (En mantenimiento, Fuera
// de servicio, De baja), con su punto y su palabra, y entonces la fila se
// atenúa: ese equipo no está para usarse. "Operativo" y "Disponible" ya no
// ocupan cada fila, y un estado vacío no se rellena con "Sin estado"
// (`estadoEnLista`). La ficha sigue diciendo siempre el estado registrado.

// Clases completas y literales (Tailwind no ve nombres construidos).
const TEXTO_POR_TONO: Record<TonoEstado, string> = {
  exito: 'text-noct-exito',
  precaucion: 'text-noct-precaucion',
  error: 'text-noct-error',
  neutro: 'text-noct-neutral-300',
}
const PUNTO_POR_TONO: Record<TonoEstado, string> = {
  exito: 'bg-noct-exito',
  precaucion: 'bg-noct-precaucion',
  error: 'bg-noct-error',
  neutro: 'bg-noct-neutral-400',
}

export function FilaDispositivo({
  dispositivo,
  categoriaNombre,
  subtitulo,
  conFoto = false,
  estado,
  alAbrir,
  resaltar = '',
}: {
  dispositivo: Dispositivo
  // Nombre de la categoria del equipo: decide el icono del avatar.
  categoriaNombre: string
  // Linea de contexto bajo el nombre, ya armada por la pantalla:
  // Dispositivos muestra categoria y ubicacion; Red, categoria y
  // marca/modelo (ahi la ubicacion ya es el titulo del grupo). Solo con
  // lo que el nombre no dice (tarea 277, `lineasDeContexto`): puede
  // quedar vacia, y entonces la fila no reserva la linea.
  subtitulo: string
  // Solo Dispositivos muestra la fotografia del equipo. En Red el
  // avatar es siempre el icono del tipo de nodo, que es lo que
  // distingue un switch de un access point de un vistazo.
  conFoto?: boolean
  // El `state` del salto a la ficha (tarea 256): el origen, para que el
  // regreso vuelva a la lista con su búsqueda aunque el equipo sea de
  // red (su padre declarado es Red). Ver `conOrigen`.
  estado?: unknown
  // Se llama en el mismo gesto que el salto, antes de él: la lista anota
  // ahí su búsqueda para el botón atrás del teléfono.
  alAbrir?: () => void
  // Lo que se está buscando, tal cual se escribió: si está en el nombre,
  // se resalta ahí. El nombre real no cambia.
  resaltar?: string
}) {
  const estadoVisible = estadoEnLista(dispositivo.estado)
  const atenuada = estadoVisible?.excepcion ?? false
  const { pre, match, post } = partirTitulo(dispositivo.nombre, normalizarTexto(resaltar.trim()))

  return (
    <Link
      to={`/dispositivos/${dispositivo.id}`}
      state={estado}
      onClick={alAbrir}
      className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 text-noct-text hover:bg-noct-text/[.05]"
    >
      <span
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400 ${
          conFoto ? 'overflow-hidden' : ''
        } ${atenuada ? 'opacity-60' : ''}`}
      >
        {conFoto && dispositivo.foto ? (
          <MiniaturaPortada
            referencia={dispositivo.foto.referencia}
            alt={dispositivo.nombre}
            className="h-full w-full object-cover"
          />
        ) : (
          <IconoNodo tipo={tipoDeNodoVisual(categoriaNombre)} className="h-[19px] w-[19px]" />
        )}
      </span>
      <div className={`min-w-0 flex-1 ${atenuada ? 'opacity-60' : ''}`}>
        {/* El nombre parte línea, hasta dos, como los títulos de Resolver y
            de los procedimientos: recortado a una ("Impresora de ejemplo
            Adm…" junto a su IP) escondía justo el dato principal. La línea
            de contexto tampoco se recorta (el prototipo no lo hace): solo
            dice lo que el nombre no dice, y cortada perdía el lugar. */}
        <p className="line-clamp-2 break-words text-[15px] font-medium leading-[1.3] text-pretty">
          {pre}
          {match && <span className="rounded-[3px] bg-noct-accent/[.16] text-noct-accent-200">{match}</span>}
          {post}
        </p>
        {subtitulo && (
          <p className="line-clamp-2 break-words text-[12.5px] leading-[1.4] text-noct-neutral-500">{subtitulo}</p>
        )}
      </div>
      {(estadoVisible || dispositivo.ip) && (
        <div className="flex shrink-0 flex-col items-end gap-[3px]">
          {/* Solo la excepción (o un estado escrito a mano que no se sabe
              leer), con su punto y su palabra: el color nunca va solo. Va a
              plena opacidad aunque la fila se atenúe, para leerse bien. */}
          {estadoVisible && (
            <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${TEXTO_POR_TONO[estadoVisible.tono]}`}>
              <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO_POR_TONO[estadoVisible.tono]}`} />
              {estadoVisible.etiqueta}
            </span>
          )}
          {/* Piso del dato técnico (M-R5): la IP era 11 px monoespaciado en
              `noct-neutral-600`, unos 3,9:1 de contraste, el texto más
              pequeño de toda la app justo para el dato que más se busca de
              pie frente a un rack. Sube a 13 px y neutral-300. */}
          {dispositivo.ip && <span className={VALOR_TECNICO_COMPACTO}>{dispositivo.ip}</span>}
        </div>
      )}
    </Link>
  )
}
