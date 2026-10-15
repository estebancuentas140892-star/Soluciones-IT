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
  error: { fondo: 'bg-noct-error/(--tinte-estado)', icono: 'text-noct-error' },
  precaucion: { fondo: 'bg-noct-precaucion/(--tinte-estado)', icono: 'text-noct-precaucion' },
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
  abierta = false,
  onAbrir,
}: {
  Icono: Icono
  titulo: string
  valor: string
  tono?: 'neutro' | 'precaucion'
  abre?: 'hoja' | 'pantalla'
  /**
   * Su hoja está abierta (tarea 339). Desde 768 px la hoja es un panel al
   * costado y la ficha sigue a la vista: la fila que lo abrió se marca con
   * el tinte de acento mientras dure. En el teléfono la hoja tapa la fila y
   * no se pinta nada.
   */
  abierta?: boolean
  onAbrir: () => void
}) {
  const Galon = abre === 'hoja' ? CaretUp : CaretRight
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        aria-haspopup={abre === 'hoja' ? 'dialog' : undefined}
        aria-expanded={abre === 'hoja' ? abierta : undefined}
        className={`flex min-h-[52px] w-full items-center gap-3 border-b border-noct-divider text-left text-noct-text hover:bg-noct-text/[.04] xl:min-h-11 ${
          abierta ? 'md:-mx-1.5 md:w-[calc(100%+12px)] md:rounded-[9px] md:border-transparent md:bg-noct-accent/[.12] md:px-1.5' : ''
        }`}
      >
        <Icono size={18} className="shrink-0 text-noct-neutral-400" aria-hidden />
        <span
          className={`min-w-0 flex-1 text-[15px] leading-snug ${abierta ? 'md:font-semibold md:text-noct-accent-300' : ''}`}
        >
          {titulo}
        </span>
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
//
// CINCO DESDE 1280 (tarea 339, T4; "cuánto se ve antes de Ver N" cambia
// con el ancho): quien lo usa pasa hasta `visiblesEscritorio` filas; por
// debajo de 1280 las que pasan de `visibles` se esconden con CSS y "Ver N"
// aparece según lo que de verdad se ve en cada banda.
export function ResolverConEsteEquipo({
  items,
  total,
  onVerTodos,
  visibles = 3,
  visiblesEscritorio = visibles,
}: {
  items: ItemResolver[]
  total: number
  onVerTodos: () => void
  visibles?: number
  visiblesEscritorio?: number
}) {
  if (items.length === 0) return null
  const vistosTelefono = Math.min(items.length, visibles)
  const vistosEscritorio = Math.min(items.length, visiblesEscritorio)
  const verEnTelefono = total > vistosTelefono
  const verEnEscritorio = total > vistosEscritorio
  return (
    <section aria-labelledby="resolver-con-este-equipo" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2 pb-0.5">
        <h2 id="resolver-con-este-equipo" className="text-[17px] font-semibold tracking-[-.01em]">
          Resolver con este equipo
        </h2>
        {(verEnTelefono || verEnEscritorio) && (
          <button
            type="button"
            onClick={onVerTodos}
            aria-haspopup="dialog"
            aria-label={`Ver las ${total} formas de resolver con este equipo`}
            className={`min-h-11 shrink-0 items-center gap-1 text-[14px] font-semibold text-noct-accent-300 xl:min-h-0 ${
              verEnTelefono ? 'flex' : 'hidden'
            } ${verEnEscritorio ? 'xl:flex' : 'xl:hidden'}`}
          >
            Ver {total}
            <CaretUp size={13} aria-hidden />
          </button>
        )}
      </div>
      <ul className="flex flex-col">
        {items.slice(0, vistosEscritorio).map((item, i) => (
          <li key={item.id} className={i >= vistosTelefono ? 'hidden xl:block' : undefined}>
            <Link
              to={item.ruta}
              // 64 en el teléfono, 60 en la tableta y 54 desde 1280 (densa).
              className="flex min-h-16 items-center gap-3 border-b border-noct-divider py-2 text-noct-text hover:bg-noct-text/[.04] md:min-h-[60px] xl:min-h-[54px] xl:py-1.5"
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-noct-text/[.06] text-noct-neutral-300 xl:h-[34px] xl:w-[34px] xl:rounded-[10px]">
                <item.Icono size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] leading-snug text-noct-neutral-500">{item.tipo}</span>
                {/* El título es la identidad de la guía: no se recorta (regla 23). */}
                <span className="block text-[15.5px] font-semibold leading-[1.3] text-pretty [overflow-wrap:anywhere] xl:text-[14.5px]">
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
//
// EN LA CABECERA DESDE 768 PX (tarea 339): `variante="cabecera"` es lo
// mismo para la `accionPrincipal` del chasis. En tableta, el relleno de 48
// y la llave sola, cuadrada, detrás; en escritorio, "Credenciales"
// delineado con su palabra y después el relleno de 40, a la derecha del
// todo. La barra fija solo se monta en el teléfono (la ficha lo decide con
// `useEsAncho`, y por si acaso lleva `md:hidden`).
export function BarraAccionEquipo({
  resolver,
  onCredenciales,
  variante = 'barra',
  abierta = null,
}: {
  /** A dónde lleva "Resolver un problema": el diagnóstico de la categoría o la hoja con todo. */
  resolver: { to: string; estado?: EstadoConOrigen } | { onAbrir: () => void } | null
  onCredenciales: (() => void) | null
  variante?: 'barra' | 'cabecera'
  /** Qué hoja de las dos está abierta, para marcar su botón mientras dure (solo en la cabecera). */
  abierta?: 'resolver' | 'credenciales' | null
}) {
  if (!resolver && !onCredenciales) return null
  if (variante === 'cabecera') {
    const resolverAbierta = abierta === 'resolver'
    const credencialesAbiertas = abierta === 'credenciales'
    const contenidoCabecera: ReactNode = (
      <>
        <TreeStructure size={17} aria-hidden />
        Resolver un problema
      </>
    )
    return (
      <>
        {onCredenciales && (
          <button
            type="button"
            onClick={onCredenciales}
            aria-haspopup="dialog"
            aria-expanded={credencialesAbiertas}
            aria-label="Credenciales del equipo"
            title="Credenciales del equipo"
            // Solo existe desde 768 px: la base es la tableta (48 x 48, sola)
            // y `xl:` el escritorio (40 de alto, con su palabra). Mientras su
            // hoja está abierta, el tinte de acento dice de dónde salió.
            className={`order-last inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.5px] text-[15px] font-semibold leading-tight xl:order-none xl:h-10 xl:w-auto xl:rounded-[11px] xl:px-[15px] xl:text-[14px] ${
              credencialesAbiertas
                ? 'border-noct-accent/60 bg-noct-accent/[.12] text-noct-accent-300'
                : 'border-noct-text/25 text-noct-text hover:bg-noct-text/[.05]'
            }`}
          >
            <Key size={18} className="shrink-0" aria-hidden />
            <span className="hidden xl:inline">Credenciales</span>
          </button>
        )}
        {resolver &&
          ('to' in resolver ? (
            <Link
              to={resolver.to}
              state={resolver.estado}
              aria-label="Resolver un problema con este equipo"
              className={BTN_PRIMARIO_RELLENO}
            >
              {contenidoCabecera}
            </Link>
          ) : (
            <button
              type="button"
              onClick={resolver.onAbrir}
              aria-haspopup="dialog"
              aria-expanded={resolverAbierta}
              aria-label="Resolver un problema con este equipo"
              className={BTN_PRIMARIO_RELLENO}
            >
              {contenidoCabecera}
            </button>
          ))}
      </>
    )
  }
  const contenido: ReactNode = (
    <>
      <TreeStructure size={19} aria-hidden />
      Resolver un problema
    </>
  )
  const clase = `${BTN_PRIMARIO_RELLENO} min-w-0 flex-1`
  return (
    <div
      className={`sticky ${PEGADA_SOBRE_PESTANAS} ${BAJA_CON_LAS_PESTANAS} z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] md:hidden lg:px-10`}
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
