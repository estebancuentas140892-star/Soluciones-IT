import { Fragment } from 'react'
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
// equipo o icono de su tipo de nodo), nombre, una linea de contexto, el
// estado arriba a la derecha y la IP al final de la linea de contexto
// (tarea 317). Antes las dos pantallas la repetian
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
// La línea de contexto bajo el nombre.
const TEXTO_CONTEXTO = 'text-[12.5px] leading-[1.4] text-noct-neutral-500'
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
  //
  // Tambien puede llegar en PARTES (tarea 317: quien tiene el equipo y su
  // area). Cada parte se queda entera en su linea si cabe, hasta dos
  // lineas cada una, y la siguiente baja si no: en un telefono de 320 px
  // "Esteban Cardona Rendón · Control Interno" en un solo texto de dos
  // lineas perdia el area, y junto a un estado, el propio nombre. Con
  // ancho de sobra se leen seguidas, con " · ". La fila no sabe que son.
  subtitulo: string | readonly string[]
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
  const atenuacion = atenuada ? 'opacity-60' : ''
  const { pre, match, post } = partirTitulo(dispositivo.nombre, normalizarTexto(resaltar.trim()))
  const enPartes = typeof subtitulo !== 'string'
  const conSubtitulo = enPartes ? subtitulo.length > 0 : subtitulo !== ''
  // La IP va abajo, al final de la línea de contexto, si hay línea o si
  // arriba ya está el estado; si no, en la línea del nombre.
  const ipAbajo = Boolean(dispositivo.ip) && (conSubtitulo || Boolean(estadoVisible))
  // Piso del dato técnico (M-R5): la IP era 11 px monoespaciado en
  // `noct-neutral-600`, unos 3,9:1 de contraste, el texto más pequeño de
  // toda la app justo para el dato que más se busca de pie frente a un
  // rack. Sube a 13 px y neutral-300.
  const ip = dispositivo.ip ? (
    <span className={`shrink-0 ${ipAbajo ? 'ml-auto' : ''} ${ipAbajo && enPartes ? 'pl-3' : ''} ${VALOR_TECNICO_COMPACTO}`}>{dispositivo.ip}</span>
  ) : null
  // Arriba a la derecha: solo la excepción (o un estado escrito a mano
  // que no se sabe leer), con su punto y su palabra (el color nunca va
  // solo); o la IP, si abajo no hay nada.
  const derecha = estadoVisible ? (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[12.5px] ${TEXTO_POR_TONO[estadoVisible.tono]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO_POR_TONO[estadoVisible.tono]}`} />
      {estadoVisible.etiqueta}
    </span>
  ) : ipAbajo ? null : (
    ip
  )

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
      {/* DOS FRANJAS (tarea 317). Arriba, el nombre y, a su derecha, el
          estado si es una excepción. Abajo, la línea de contexto con TODO
          el ancho y la IP al final, a la derecha: en la última línea si
          cabe y, si no, en la siguiente. Antes el estado y la IP eran una
          columna que reservaba su ancho durante todas las líneas, y a
          320 px junto a "En mantenimiento" la persona se leía "Esteban /
          Cardona…". Sin nada debajo, la IP se queda en la línea del nombre.
          El estado y la IP van a plena opacidad aunque la fila se atenúe. */}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
        {/* El nombre parte línea, hasta dos, como los títulos de Resolver y
            de los procedimientos: recortado a una ("Impresora de ejemplo
            Adm…" junto a su IP) escondía justo el dato principal. Sin nada
            a su derecha, usa también ese ancho. */}
        <p
          className={`line-clamp-2 break-words text-[15px] font-medium leading-[1.3] text-pretty ${
            derecha ? '' : 'col-span-2'
          } ${atenuada ? 'opacity-60' : ''}`}
        >
          {pre}
          {match && <span className="rounded-[3px] bg-noct-accent/[.16] text-noct-accent-200">{match}</span>}
          {post}
        </p>
        {derecha}
        {(conSubtitulo || ipAbajo) && (
          <div className={`col-span-2 flex flex-wrap items-end ${enPartes ? 'gap-x-[0.3em]' : 'gap-x-3'}`}>
            {/* Un texto comparte la línea con la IP, como siempre. En
                partes, cada una ocupa todo el ancho que necesite: el
                párrafo no dibuja caja (`contents`) y sus partes fluyen con
                la IP detrás. La línea de contexto no se recorta a una:
                solo dice lo que el nombre no dice. */}
            {typeof subtitulo === 'string'
              ? conSubtitulo && <p className={`min-w-0 flex-1 line-clamp-2 break-words ${TEXTO_CONTEXTO} ${atenuacion}`}>{subtitulo}</p>
              : conSubtitulo && (
                  <p className={`contents ${TEXTO_CONTEXTO}`}>
                    {subtitulo.map((parte, i) => (
                      <Fragment key={i}>
                        {/* El espacio no se dibuja (lo pone el hueco), pero
                            deja el texto leíble entero: "A · B". */}
                        {i > 0 && ' '}
                        <span className={`line-clamp-2 min-w-0 break-words ${atenuacion}`}>
                          {i < subtitulo.length - 1 ? `${parte} ·` : parte}
                        </span>
                      </Fragment>
                    ))}
                  </p>
                )}
            {ipAbajo && ip}
          </div>
        )}
      </div>
    </Link>
  )
}
