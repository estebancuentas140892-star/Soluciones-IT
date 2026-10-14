import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { TipoArticulo } from '../../lib/db'
import type { EstadoConOrigen } from '../../lib/origenNavegacion'
import { CaretRight, CaretUp, Key, TreeStructure, type IconoProps } from '../../components/iconos'
import { BAJA_CON_LAS_PESTANAS, BTN_PRIMARIO_RELLENO, PEGADA_SOBRE_PESTANAS } from '../../components/nocturne'
import { huecoAvisoActualizacion } from '../../components/ranuraAvisoActualizacion'

// PIEZAS DE LA FICHA DE EQUIPO EN EL TELÉFONO (rediseño móvil "1b Pulgar",
// tarea 329, AD-079). Son presentación: no leen ni escriben datos. Los
// conteos, los avisos y las listas los calcula `DispositivoPage`, que es
// quien ya tenía esos datos.
//
// Desde 768 px (tarea 338) la disposición es la misma, pero cada pieza
// habla el lenguaje visual de antes del rediseño con variantes `md:`:
// rótulos de sección en mayúsculas de 11 px, filas de 14 y 15 px, la
// tarjeta de borde fino y el pie delineado. El teléfono no cambia.

type Icono = (props: IconoProps) => React.JSX.Element

/** Un aviso del equipo: algo de sus datos que pide atención, con su verbo. */
export interface AvisoEquipo {
  clave: string
  Icono: Icono
  texto: string
  /** Rojo para lo que no coincide (conflicto); ámbar para lo que falta validar. */
  tono: 'error' | 'precaucion'
  verbo: string
  /** Nombre accesible completo del verbo ("Ver la facturación del equipo"). */
  etiqueta: string
  onAbrir: () => void
}

// Desde 768 px (tarea 338) el aviso lleva el borde y el tinte del aviso de
// migración pendiente de la ficha, el aviso de antes del rediseño.
const TONO_AVISO = {
  error: { fondo: 'bg-noct-error/[.13] md:border-noct-error/35 md:bg-noct-error/[.08]', icono: 'text-noct-error' },
  precaucion: {
    fondo: 'bg-noct-precaucion/[.13] md:border-noct-precaucion/35 md:bg-noct-precaucion/[.08]',
    icono: 'text-noct-precaucion',
  },
} as const

// AVISOS DEL EQUIPO, justo bajo el carnet: lo que sus datos ya dicen que
// pide atención (una autorización en conflicto o por validar, un
// responsable anotado sin validar, un conflicto anotado en sus detalles).
// No hay datos nuevos: es dónde se dicen. Cada aviso es una fila tintada de
// su color, con icono, texto y el verbo que lleva a resolverlo. Sin avisos,
// no se dibuja nada.
export function AvisosDelEquipo({ avisos }: { avisos: AvisoEquipo[] }) {
  if (avisos.length === 0) return null
  return (
    <ul aria-label="Avisos del equipo" className="flex flex-col gap-1.5">
      {avisos.map((aviso) => (
        <li key={aviso.clave}>
          <button
            type="button"
            onClick={aviso.onAbrir}
            aria-label={aviso.etiqueta}
            className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl py-1.5 pl-3 pr-1.5 text-left text-noct-text hover:brightness-110 md:min-h-0 md:rounded-md md:border md:px-[13px] md:py-2.5 ${TONO_AVISO[aviso.tono].fondo}`}
          >
            <aviso.Icono size={18} className={`shrink-0 ${TONO_AVISO[aviso.tono].icono}`} aria-hidden />
            <span className="min-w-0 flex-1 text-[14px] font-[550] leading-[1.3] text-pretty [overflow-wrap:anywhere] md:text-[13px] md:font-normal md:leading-[1.45]">
              {aviso.texto}
            </span>
            <span className="flex min-h-9 shrink-0 items-center px-2.5 text-[14px] font-semibold text-noct-accent-300 md:min-h-0 md:px-0 md:text-[13px] md:font-medium">
              {aviso.verbo}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// UNA FILA DEL ÍNDICE "MÁS DEL EQUIPO": un solo nivel, con lo que guarda
// dicho en su valor. El galón dice qué pasa al tocarla: `CaretUp` abre una
// hoja (se consulta aquí), `CaretRight` una pantalla (se trabaja ahí).
// Desde 768 px (tarea 338) es la cabecera de las secciones plegables de
// antes: 14 px, el conteo a 12,5 y el icono teñido si el dato avisa; el
// divisor lo pone la tarjeta (`DispositivoPage`).
export function FilaIndice({
  Icono,
  titulo,
  valor,
  tono = 'neutro',
  abre = 'hoja',
  onAbrir,
}: {
  Icono: Icono
  titulo: string
  valor: string
  tono?: 'neutro' | 'precaucion'
  abre?: 'hoja' | 'pantalla'
  onAbrir: () => void
}) {
  const Galon = abre === 'hoja' ? CaretUp : CaretRight
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        aria-haspopup={abre === 'hoja' ? 'dialog' : undefined}
        className="flex min-h-[52px] w-full items-center gap-3 border-b border-noct-divider text-left text-noct-text hover:bg-noct-text/[.04] md:gap-2.5 md:border-b-0 md:px-3.5"
      >
        <Icono
          size={18}
          className={`shrink-0 text-noct-neutral-400${tono === 'precaucion' ? ' md:text-noct-precaucion' : ''}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-[15px] leading-snug md:text-[14px] md:leading-[inherit]">{titulo}</span>
        <span
          className={`max-w-[45%] shrink-0 truncate text-[13.5px] font-[550] md:text-[12.5px] md:font-medium md:tabular-nums ${
            tono === 'precaucion' ? 'text-noct-precaucion' : 'text-noct-neutral-400'
          }`}
        >
          {valor}
        </span>
        <Galon size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
      </button>
    </li>
  )
}

/** Una fila de "Resolver con este equipo": un problema frecuente o un procedimiento. */
export interface ItemResolver {
  id: string
  ruta: string
  Icono: Icono
  tipo: string
  titulo: string
  extra?: string
  /** El tipo de la guía: desde 768 px tiñe el recuadro del icono (tarea 338). */
  tipoArticulo?: TipoArticulo
}

// El tinte del recuadro del icono desde 768 px (tarea 338): el de su tipo,
// como en las filas de problemas y procedimientos de antes del rediseño
// (`claseTonoDeTipo`). Las clases van literales para que Tailwind las vea.
const TINTE_ESCRITORIO: Record<TipoArticulo, string> = {
  instalacion: 'md:bg-noct-tipo-instalacion/[.12] md:text-noct-tipo-instalacion',
  configuracion: 'md:bg-noct-tipo-configuracion/[.12] md:text-noct-tipo-configuracion',
  conexion: 'md:bg-noct-tipo-conexion/[.12] md:text-noct-tipo-conexion',
  problema_frecuente: 'md:bg-noct-precaucion/[.12] md:text-noct-precaucion',
  mantenimiento: 'md:bg-noct-exito/[.12] md:text-noct-exito',
  manual: 'md:bg-noct-neutral-400/[.12] md:text-noct-neutral-400',
}

// RESOLVER CON ESTE EQUIPO: hasta tres filas (los problemas frecuentes
// primero) y "Ver N", que abre la hoja con todo, el diagnóstico de su
// categoría al final. Sustituye a los bloques "Problemas frecuentes" y
// "Procedimientos" de la ficha, que ahora viven en esa hoja. Desde 768 px
// (tarea 338): el rótulo de sección de antes y las filas de procedimiento
// de antes (sin divisor, recuadro de 34 px teñido, título a 15/500).
export function ResolverConEsteEquipo({
  items,
  total,
  onVerTodos,
}: {
  items: ItemResolver[]
  total: number
  onVerTodos: () => void
}) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="resolver-con-este-equipo" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2 pb-0.5 md:pb-2">
        <h2
          id="resolver-con-este-equipo"
          className="text-[17px] font-semibold tracking-[-.01em] md:text-[11px] md:font-medium md:uppercase md:tracking-[0.08em] md:text-noct-neutral-500"
        >
          Resolver con este equipo
        </h2>
        {total > items.length && (
          <button
            type="button"
            onClick={onVerTodos}
            aria-haspopup="dialog"
            aria-label={`Ver las ${total} formas de resolver con este equipo`}
            className="flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold text-noct-accent-300 md:min-h-0 md:text-[13px] md:font-medium"
          >
            Ver {total}
            <CaretUp size={13} aria-hidden />
          </button>
        )}
      </div>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.ruta}
              className="flex min-h-16 items-center gap-3 border-b border-noct-divider py-2 text-noct-text hover:bg-noct-text/[.04] md:min-h-[54px] md:rounded-lg md:border-b-0 md:px-2 md:py-1.5 md:transition-colors md:hover:bg-noct-text/[.05]"
            >
              <span
                className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-noct-text/[.06] text-noct-neutral-300 md:h-[34px] md:w-[34px] md:rounded-md${
                  item.tipoArticulo ? ` ${TINTE_ESCRITORIO[item.tipoArticulo]}` : ''
                }`}
              >
                <item.Icono size={19} className="md:size-[17px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 md:flex md:flex-col md:gap-px">
                <span className="block text-[12.5px] leading-snug text-noct-neutral-500 md:leading-[1.4] md:text-noct-neutral-400">
                  {item.tipo}
                </span>
                {/* El título es la identidad de la guía: no se recorta (regla 23). */}
                <span className="block text-[15.5px] font-semibold leading-[1.3] text-pretty [overflow-wrap:anywhere] md:text-[15px] md:font-medium">
                  {item.titulo}
                </span>
                {item.extra && (
                  <span className="mt-px block truncate text-[13px] leading-snug text-noct-neutral-400 md:text-[11.5px] md:leading-[inherit] md:text-noct-neutral-500">
                    {item.extra}
                  </span>
                )}
              </span>
              <CaretRight size={14} className="shrink-0 text-noct-neutral-500 md:text-noct-neutral-600" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// LA BARRA FIJA DE LA FICHA: "Resolver un problema", la única acción
// rellena (regla 30), y al lado, con permiso de Bóveda, la llave que abre
// las credenciales del equipo en su hoja. Pegada sobre las pestañas y,
// cuando estas se esconden al bajar, al borde (tarea 329).
export function BarraAccionEquipo({
  resolver,
  onCredenciales,
}: {
  /** A dónde lleva "Resolver un problema": el diagnóstico de la categoría o la hoja con todo. */
  resolver: { to: string; estado?: EstadoConOrigen } | { onAbrir: () => void } | null
  onCredenciales: (() => void) | null
}) {
  if (!resolver && !onCredenciales) return null
  const contenido: ReactNode = (
    <>
      <TreeStructure size={19} aria-hidden />
      Resolver un problema
    </>
  )
  // Desde 768 px (tarea 338) el botón ya va delineado (BTN_PRIMARIO_RELLENO);
  // aquí se repone el alto, el radio y la letra del pie de antes, y la barra
  // recupera su relleno.
  const clase = `${BTN_PRIMARIO_RELLENO} min-w-0 flex-1 md:min-h-[52px] md:rounded-xl md:text-[15px] md:leading-[inherit]`
  return (
    <div
      className={`sticky ${PEGADA_SOBRE_PESTANAS} ${BAJA_CON_LAS_PESTANAS} z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] md:px-4 md:pb-3 lg:px-10`}
    >
      {/* El aviso de versión nueva va aquí, encima de los botones (tarea
          274): esta barra se pega a la misma altura que la franja del
          chasis, y una de las dos taparía a la otra. */}
      <div ref={huecoAvisoActualizacion} className="mb-2 empty:hidden" />
      <div className="flex gap-2">
        {resolver &&
          ('to' in resolver ? (
            <Link to={resolver.to} state={resolver.estado} aria-label="Resolver un problema con este equipo" className={clase}>
              {contenido}
            </Link>
          ) : (
            <button
              type="button"
              onClick={resolver.onAbrir}
              aria-haspopup="dialog"
              aria-label="Resolver un problema con este equipo"
              className={clase}
            >
              {contenido}
            </button>
          ))}
        {onCredenciales && (
          <button
            type="button"
            onClick={onCredenciales}
            aria-haspopup="dialog"
            aria-label="Credenciales del equipo"
            className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] border-[1.5px] border-noct-text/25 text-noct-text hover:bg-noct-text/[.06] md:h-[52px] md:w-[52px] md:rounded-xl md:border md:border-noct-divider md:hover:bg-noct-text/[.07]"
          >
            <Key size={21} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
