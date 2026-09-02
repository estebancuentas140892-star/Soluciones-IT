import { Link } from 'react-router-dom'
import type { Dispositivo } from '../lib/db'
import { VALOR_TECNICO_COMPACTO } from './FilaDato'
import { MiniaturaPortada } from './MiniaturaPortada'
import { IconoNodo } from '../features/red/IconoNodo'
import { tipoDeNodoVisual } from '../features/red/topologiaVisual'
import { PastillaEstadoDispositivo } from './PastillaEstado'

// Fila de un dispositivo en un listado, compartida por Dispositivos y
// Red (Fase 1 de PROPUESTA_REVISION_ARQUITECTURA.md): avatar (foto del
// equipo o icono de su tipo de nodo), nombre, una linea de contexto y,
// a la derecha, el estado con su punto de color y la IP. Antes las dos
// pantallas la repetian calcada salvo por dos detalles, que son
// justamente las dos props de abajo.
export function FilaDispositivo({
  dispositivo,
  categoriaNombre,
  subtitulo,
  conFoto = false,
}: {
  dispositivo: Dispositivo
  // Nombre de la categoria del equipo: decide el icono del avatar.
  categoriaNombre: string
  // Linea de contexto bajo el nombre, ya armada por la pantalla:
  // Dispositivos muestra categoria y ubicacion; Red, categoria y
  // marca/modelo (ahi la ubicacion ya es el titulo del grupo).
  subtitulo: string
  // Solo Dispositivos muestra la fotografia del equipo. En Red el
  // avatar es siempre el icono del tipo de nodo, que es lo que
  // distingue un switch de un access point de un vistazo.
  conFoto?: boolean
}) {
  return (
    <Link
      to={`/dispositivos/${dispositivo.id}`}
      className="flex min-h-[56px] items-center gap-[13px] rounded-md px-2 py-[11px] text-noct-text hover:bg-noct-text/[.05]"
    >
      <span
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400 ${
          conFoto ? 'overflow-hidden' : ''
        }`}
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-[1.3]">{dispositivo.nombre}</p>
        <p className="truncate text-[12px] text-noct-neutral-500">{subtitulo}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[3px]">
        {/* Una sola forma para el estado (tarea 207, hallazgo M-017,
            cierra CAND-1): la misma pastilla de contorno que ya usaban
            "Borrador" y "Obsoleto" en Guías. Antes esta fila lo dibujaba
            como punto de color más texto teñido y la ficha del equipo
            como pastilla con punto: el mismo dato cambiaba de forma al
            cambiar de pantalla. */}
        <PastillaEstadoDispositivo estado={dispositivo.estado} />
        {/* Piso del dato técnico (M-R5): la IP era 11 px monoespaciado en
            `noct-neutral-600`, unos 3,9:1 de contraste, el texto más
            pequeño de toda la app justo para el dato que más se busca de
            pie frente a un rack. Sube a 13 px y neutral-300. */}
        {dispositivo.ip && <span className={VALOR_TECNICO_COMPACTO}>{dispositivo.ip}</span>}
      </div>
    </Link>
  )
}
