import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { Dispositivo } from '../lib/db'
import { VALOR_TECNICO_COMPACTO } from './FilaDato'
import { MiniaturaPortada } from './MiniaturaPortada'
import { IconoNodo } from '../features/red/IconoNodo'
import { estadoEnLista, tipoDeNodoVisual, type TonoEstado } from '../features/red/topologiaVisual'
import { partirTitulo } from '../features/busqueda/resultados'
import { normalizarTexto } from '../features/soluciones/iconosSoluciones'
import { avisar } from './avisosFlotantes'
import { IconoCategoria } from './IconoCategoria'
import { IconoVentana } from './ventana/IconoVentana'
import { BOTON_COPIAR, TARJETA } from './ventana/estilos'
import { copiarAlPortapapeles } from '../lib/portapapeles'

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
// La pastilla del estado en la tarjeta del teléfono (tarea 350, «En revisión»
// del prototipo): el tinte de su tono, su punto y su palabra.
const PASTILLA_POR_TONO: Record<TonoEstado, string> = {
  exito: 'bg-noct-exito-tinte text-noct-exito',
  precaucion: 'bg-noct-precaucion-tinte text-noct-precaucion',
  error: 'bg-noct-error-tinte text-noct-error',
  neutro: 'bg-noct-neutral-900 text-noct-neutral-300',
}

export function FilaDispositivo({
  dispositivo,
  categoriaNombre,
  subtitulo,
  conFoto = false,
  estado,
  alAbrir,
  resaltar = '',
  enTarjeta = false,
  persona,
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
  // LA TARJETA DEL TELÉFONO (tarea 350, Equipos del prototipo de Claude
  // Design): la pantalla la pide por debajo de 768 px. Ver `TarjetaEquipo`.
  enTarjeta?: boolean
  // LA PERSONA PRIMERO (tarea 364, D4 de la auditoría del 2026-10-27): el
  // nombre de quien tiene el equipo, si está vinculado. Pasa a ser el título,
  // y el nombre del equipo baja a la línea de debajo, delante de su contexto
  // (que entonces dice solo lo que falta: el área y el sitio). Lo decide la
  // pantalla: sin responsable, anotado, de baja o de red, no llega.
  persona?: string
}) {
  const estadoVisible = estadoEnLista(dispositivo.estado)
  const atenuada = estadoVisible?.excepcion ?? false
  if (enTarjeta) {
    return (
      <TarjetaEquipo
        dispositivo={dispositivo}
        categoriaNombre={categoriaNombre}
        subtitulo={subtitulo}
        conFoto={conFoto}
        estado={estado}
        alAbrir={alAbrir}
        resaltar={resaltar}
        persona={persona}
      />
    )
  }
  // Al 66 % y no al 60: en el tema claro el nombre atenuado quedaba en
  // 4.4:1 (tarea 333). La línea de contexto ya va en el gris más tenue que
  // se lee (texto 4): atenuada además, quedaba en 2.5:1 (claro) y 3.5:1
  // (oscuro). En el teléfono no se atenúa (tarea 349); el nombre y el icono
  // atenuados y el estado con su palabra siguen diciendo que es una excepción.
  const atenuacionContexto = atenuada ? 'opacity-[.66] max-md:opacity-100' : ''
  const { pre, match, post } = partirTitulo(persona ?? dispositivo.nombre, normalizarTexto(resaltar.trim()))
  // Con la persona de título, el equipo abre la línea de debajo (tarea 364).
  const partes = persona
    ? [dispositivo.nombre, ...(typeof subtitulo === 'string' ? (subtitulo ? [subtitulo] : []) : subtitulo)]
    : subtitulo
  const enPartes = typeof partes !== 'string'
  const conSubtitulo = enPartes ? partes.length > 0 : partes !== ''
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
      className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 text-noct-text hover:bg-noct-text/[.05] max-md:active:bg-noct-presionado"
    >
      <span
        className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400 ${
          conFoto ? 'overflow-hidden' : ''
        } ${atenuada ? 'opacity-[.66]' : ''}`}
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
            a su derecha, usa también ese ancho. En el teléfono, atenuado al
            80 % (tarea 349): al 66, lo buscado resaltado dentro del nombre
            quedaba en 3.6:1 en el claro. */}
        <p
          data-titulo-equipo={persona ? 'persona' : 'equipo'}
          className={`line-clamp-2 break-words text-[15px] leading-[1.3] text-pretty ${persona ? 'font-semibold' : 'font-medium'} ${
            derecha ? '' : 'col-span-2'
          } ${atenuada ? 'opacity-[.66] max-md:opacity-[.8]' : ''}`}
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
            {typeof partes === 'string'
              ? conSubtitulo && <p className={`min-w-0 flex-1 line-clamp-2 break-words ${TEXTO_CONTEXTO} ${atenuacionContexto}`}>{partes}</p>
              : conSubtitulo && (
                  <p className={`contents ${TEXTO_CONTEXTO}`}>
                    {partes.map((parte, i) => (
                      <Fragment key={i}>
                        {/* El espacio no se dibuja (lo pone el hueco), pero
                            deja el texto leíble entero: "A · B". */}
                        {i > 0 && ' '}
                        <span className={`line-clamp-2 min-w-0 break-words ${atenuacionContexto}`}>
                          {i < partes.length - 1 ? `${parte} ·` : parte}
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

// UN EQUIPO EN EL TELÉFONO (tarea 350, la lista de Equipos del prototipo de
// Claude Design): su propia tarjeta, con la foto o el «Icono de categoría» de
// su clase, el nombre a 16, la IP en mono y lo que lo sitúa, y «Copiar» a la
// derecha: la IP se copia sin abrir la ficha.
//
// Una diferencia con el prototipo, a propósito: la IP va bajo el nombre y no
// en una columna a la derecha. Con datos reales la línea de contexto dice
// quién tiene el equipo y de qué área (tarea 317), y una columna fija la
// partía a 360 px ("Esteban / Cardona…"). La excepción del estado va en su
// pastilla, con su punto y su palabra.
function TarjetaEquipo({
  dispositivo,
  categoriaNombre,
  subtitulo,
  conFoto,
  estado,
  alAbrir,
  resaltar,
  persona,
}: {
  dispositivo: Dispositivo
  categoriaNombre: string
  subtitulo: string | readonly string[]
  conFoto: boolean
  estado?: unknown
  alAbrir?: () => void
  resaltar: string
  persona?: string
}) {
  const estadoVisible = estadoEnLista(dispositivo.estado)
  const { pre, match, post } = partirTitulo(persona ?? dispositivo.nombre, normalizarTexto(resaltar.trim()))
  const equipo = partirTitulo(dispositivo.nombre, normalizarTexto(resaltar.trim()))
  const enPartes = typeof subtitulo !== 'string'
  const conSubtitulo = enPartes ? subtitulo.length > 0 : subtitulo !== ''
  const ip = dispositivo.ip?.trim() ?? ''
  return (
    <div data-tarjeta-equipo className={`${TARJETA} flex min-w-0 items-center gap-2 rounded-[18px] py-2 pl-2.5 pr-2`}>
      <Link
        to={`/dispositivos/${dispositivo.id}`}
        state={estado}
        onClick={alAbrir}
        className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-xl text-noct-text active:bg-noct-presionado"
      >
        {/* Un equipo en excepción (en mantenimiento, de baja) no está para
            usarse: su icono se atenúa, como la fila de siempre; el nombre y la
            pastilla del estado se leen enteros. */}
        {conFoto && dispositivo.foto ? (
          <span
            className={`h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[13px] bg-noct-neutral-900 ${
              estadoVisible?.excepcion ? 'opacity-[.66]' : ''
            }`}
          >
            <MiniaturaPortada referencia={dispositivo.foto.referencia} alt={dispositivo.nombre} className="h-full w-full object-cover" />
          </span>
        ) : (
          <IconoCategoria nombre={categoriaNombre} tam={42} className={estadoVisible?.excepcion ? 'opacity-[.66]' : ''} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          {/* El nombre parte línea, hasta dos, como en la fila de siempre: con
              todo el ancho de la tarjeta casi nunca llega a cortarse. */}
          <p
            data-nombre-principal
            data-titulo-equipo={persona ? 'persona' : 'equipo'}
            className="line-clamp-2 min-w-0 break-words text-[16px] font-bold leading-[21px] text-pretty"
          >
            {pre}
            {match && <span className="rounded-[3px] bg-noct-accent/[.16] text-noct-accent-200">{match}</span>}
            {post}
          </p>
          {persona ? (
            // LA PERSONA PRIMERO (tarea 364): debajo, el equipo con su IP en la
            // misma línea; la IP baja de línea antes que cortar el nombre.
            <span className="flex flex-wrap items-baseline gap-x-2 leading-[1.35]">
              <span data-equipo-de-persona className="min-w-0 text-[14.5px] font-bold text-noct-text [overflow-wrap:anywhere]">
                {equipo.pre}
                {equipo.match && <span className="rounded-[3px] bg-noct-accent/[.16] text-noct-accent-200">{equipo.match}</span>}
                {equipo.post}
              </span>
              {ip && <span className="font-mono text-[14.5px] font-semibold text-noct-neutral-300">{ip}</span>}
            </span>
          ) : (
            ip && <span className="font-mono text-[14.5px] font-semibold leading-snug text-noct-text">{ip}</span>
          )}
          {/* La línea de contexto, con las reglas de la tarea 317: un texto de
              hasta dos líneas o, en partes (quién lo tiene, su área, dónde
              está), cada parte entera en su línea si cabe y de hasta dos. */}
          {conSubtitulo &&
            (typeof subtitulo === 'string' ? (
              <p className="line-clamp-2 break-words text-[14px] font-semibold leading-snug text-noct-neutral-300">{subtitulo}</p>
            ) : (
              <p className="flex flex-wrap gap-x-[0.3em] text-[14px] font-semibold leading-snug text-noct-neutral-300">
                {subtitulo.map((parte, i) => (
                  <Fragment key={i}>
                    {/* El espacio no se dibuja (lo pone el hueco), pero deja el
                        texto leíble entero: "A · B". */}
                    {i > 0 && ' '}
                    <span className="line-clamp-2 min-w-0 break-words">{i < subtitulo.length - 1 ? `${parte} ·` : parte}</span>
                  </Fragment>
                ))}
              </p>
            ))}
          {estadoVisible && (
            <span
              data-estado-equipo={estadoVisible.tono}
              className={`mt-[3px] inline-flex h-[22px] items-center gap-[5px] self-start rounded-full px-2 text-[12.5px] font-extrabold ${PASTILLA_POR_TONO[estadoVisible.tono]}`}
            >
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              {estadoVisible.etiqueta}
            </span>
          )}
        </div>
      </Link>
      {ip && (
        <button
          type="button"
          aria-label={`Copiar IP de ${dispositivo.nombre}`}
          onClick={() => {
            void copiarAlPortapapeles(ip).then((ok) => avisar(ok ? `IP copiada: ${ip}` : 'No se pudo copiar la IP', 'copiado'))
          }}
          className={BOTON_COPIAR}
        >
          <IconoVentana nombre="copiar" tam={20} />
        </button>
      )}
    </div>
  )
}
