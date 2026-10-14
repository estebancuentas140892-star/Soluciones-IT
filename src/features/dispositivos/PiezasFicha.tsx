import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { EstadoConOrigen } from '../../lib/origenNavegacion'
import { CaretRight, CaretUp, Key, TreeStructure, type IconoProps } from '../../components/iconos'
import { BAJA_CON_LAS_PESTANAS, BTN_PRIMARIO_RELLENO, PEGADA_SOBRE_PESTANAS } from '../../components/nocturne'
import { huecoAvisoActualizacion } from '../../components/ranuraAvisoActualizacion'

// PIEZAS DE LA FICHA DE EQUIPO EN EL TELÉFONO (rediseño móvil "1b Pulgar",
// tarea 329, AD-079). Son presentación: no leen ni escriben datos. Los
// conteos, los avisos y las listas los calcula `DispositivoPage`, que es
// quien ya tenía esos datos.

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

const TONO_AVISO = {
  error: { fondo: 'bg-noct-error/[.13]', icono: 'text-noct-error' },
  precaucion: { fondo: 'bg-noct-precaucion/[.13]', icono: 'text-noct-precaucion' },
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
            className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl py-1.5 pl-3 pr-1.5 text-left text-noct-text hover:brightness-110 ${TONO_AVISO[aviso.tono].fondo}`}
          >
            <aviso.Icono size={18} className={`shrink-0 ${TONO_AVISO[aviso.tono].icono}`} aria-hidden />
            <span className="min-w-0 flex-1 text-[14px] font-[550] leading-[1.3] text-pretty [overflow-wrap:anywhere]">
              {aviso.texto}
            </span>
            <span className="flex min-h-9 shrink-0 items-center px-2.5 text-[14px] font-semibold text-noct-accent-300">
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
        className="flex min-h-[52px] w-full items-center gap-3 border-b border-noct-divider text-left text-noct-text hover:bg-noct-text/[.04]"
      >
        <Icono size={18} className="shrink-0 text-noct-neutral-400" aria-hidden />
        <span className="min-w-0 flex-1 text-[15px] leading-snug">{titulo}</span>
        <span
          className={`max-w-[45%] shrink-0 truncate text-[13.5px] font-[550] ${
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
}

// RESOLVER CON ESTE EQUIPO: hasta tres filas (los problemas frecuentes
// primero) y "Ver N", que abre la hoja con todo, el diagnóstico de su
// categoría al final. Sustituye a los bloques "Problemas frecuentes" y
// "Procedimientos" de la ficha, que ahora viven en esa hoja.
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
      <div className="flex items-baseline justify-between gap-2 pb-0.5">
        <h2 id="resolver-con-este-equipo" className="text-[17px] font-semibold tracking-[-.01em]">
          Resolver con este equipo
        </h2>
        {total > items.length && (
          <button
            type="button"
            onClick={onVerTodos}
            aria-haspopup="dialog"
            aria-label={`Ver las ${total} formas de resolver con este equipo`}
            className="flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold text-noct-accent-300"
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
              className="flex min-h-16 items-center gap-3 border-b border-noct-divider py-2 text-noct-text hover:bg-noct-text/[.04]"
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-noct-text/[.06] text-noct-neutral-300">
                <item.Icono size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-snug text-noct-neutral-500">{item.tipo}</span>
                {/* El título es la identidad de la guía: no se recorta (regla 23). */}
                <span className="block text-[15.5px] font-semibold leading-[1.3] text-pretty [overflow-wrap:anywhere]">
                  {item.titulo}
                </span>
                {item.extra && (
                  <span className="mt-px block truncate text-[13px] leading-snug text-noct-neutral-400">{item.extra}</span>
                )}
              </span>
              <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
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
  const clase = `${BTN_PRIMARIO_RELLENO} min-w-0 flex-1`
  return (
    <div
      className={`sticky ${PEGADA_SOBRE_PESTANAS} ${BAJA_CON_LAS_PESTANAS} z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] lg:px-10`}
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
            className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] border-[1.5px] border-noct-text/25 text-noct-text hover:bg-noct-text/[.06]"
          >
            <Key size={21} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
