import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { padreDe, vueltaDeTarea } from '../lib/navegacion'
import { MagnifyingGlass, X } from './iconos'

// Cabecera del nivel 3 del chasis (tarea 185, mockup 4c del handoff
// "Auditoría de Soluciones TI"). Es la única pantalla que puede quedarse
// sin la barra de pestañas, y la regla R19 exige que quien la quita
// ponga algo que oriente en su lugar. Eso es esta barra:
//
//   - fondo de superficie, para que se note que el chasis cambió
//   - rótulo de la tarea ("Editando", "Ejecutando", "Escaneando")
//   - qué se está trabajando
//   - la ruta de vuelta ESCRITA, no un "Volver" a secas
//   - una X de salida, siempre en el mismo sitio
//
// Antes, cada uno de los editores dibujaba su propia cabecera con un
// `BotonVolver` y un relleno distinto (`py-2.5 pl-2 pr-3`, `px-2`,
// `pb-1`...), así que al pasar de la ficha al editor desaparecían las
// pestañas y aparecía otra barra fija abajo, sin que nada dijera dónde
// estabas ni cómo salir sin perder el trabajo.

interface Props {
  /** Qué se está haciendo: "Editando", "Creando", "Ejecutando"... */
  rotulo: string
  /** Sobre qué: el nombre del artículo, del equipo, del secreto. */
  titulo: string
  /**
   * Con qué se trabaja, en una línea pequeña sobre el título (solo en modo
   * `compacta`). En la ejecución de una guía, "Guía · POSPN01" o "Guía"
   * (rediseño móvil "1b Pulgar", tarea 328): la cabecera dice en dos
   * líneas qué se hace y sobre qué equipo, sin depender del contador.
   */
  contexto?: string
  /**
   * Ruta de vuelta escrita ("Guías › Impresoras"). Si no se pasa, se
   * deriva de la jerarquía central; cuando esta solo sabe decir
   * "Volver" (editar y ejecutar suben a una ficha cuyo nombre depende
   * de datos en runtime), la pantalla debe pasarla.
   */
  vuelta?: string
  /** Override del destino de la X (por defecto, el padre declarado). */
  salidaA?: string
  /**
   * `state` de la X cuando es un enlace: devuelve la búsqueda a la
   * pantalla de la que se salió (encargo del 2026-09-16, sección 13).
   */
  salidaEstado?: unknown
  /** Texto accesible de la X. Por defecto "Salir sin guardar". */
  salidaEtiqueta?: string
  /**
   * Reemplaza la navegación de la X (por ejemplo, para confirmar antes
   * de descartar cambios). Si se pasa, la X deja de ser un enlace.
   */
  alSalir?: () => void
  /**
   * Se llama al tocar la X, sin impedir que navegue (tarea 341): la
   * ejecución de una guía avisa con él de que el avance quedó guardado.
   */
  alPulsarSalida?: () => void
  /** Banda propia de la tarea: pestañas del editor, progreso, avisos. */
  children?: ReactNode
  /**
   * Cabecera reducida a una sola línea de 44 px (tarea 218): sin
   * rótulo ni ruta de vuelta. Pensada para las pantallas donde el
   * técnico acaba de decidir entrar y no hace falta repetírselo: la
   * ejecución de una guía (tarea 218) y su editor (tarea 219).
   */
  compacta?: boolean
  /**
   * Contenido al final de la línea de 44 px, junto al título (solo en
   * modo `compacta`). Es donde va lo que cambia con el trabajo y tiene
   * que estar siempre a la vista: el contador que abre el índice de
   * pasos en la ejecución (tarea 218), el estado del borrador en el
   * editor (tarea 219). Se separa de `children` a propósito, porque
   * `children` sigue siendo el bloque de DEBAJO (las pestañas del
   * editor no caben en la misma fila que el título).
   */
  trailing?: ReactNode
  /**
   * Abre el buscador global COMO CAPA sobre la tarea (tarea 241,
   * secciones 8 a 10 del encargo). Solo en modo `compacta`, y solo donde
   * consultar algo a mitad del trabajo es parte del trabajo: la
   * ejecucion de una guia.
   *
   * La barra de pestañas sigue sin volver (esa decision no cambia): lo
   * que se añade no es navegacion, es una consulta que no obliga a
   * abandonar el procedimiento. Sin esta prop, el boton no existe.
   */
  onBuscar?: () => void
}

export function BarraTarea({
  rotulo,
  titulo,
  contexto,
  vuelta,
  salidaA,
  salidaEstado,
  salidaEtiqueta = 'Salir sin guardar',
  alSalir,
  alPulsarSalida,
  children,
  compacta = false,
  trailing,
  onBuscar,
}: Props) {
  const { pathname } = useLocation()
  const destino = salidaA ?? padreDe(pathname)?.to ?? '/'
  const rutaVuelta = vuelta ?? vueltaDeTarea(pathname)

  if (compacta) {
    return (
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-surface/[.95] backdrop-blur-[12px]">
        {/* 56 de alto en la tableta y 60 en el escritorio (tarea 339, T5). */}
        <div
          className={`flex items-center gap-1 pl-1 pr-1 md:min-h-14 md:gap-2 md:pl-2.5 md:pr-4 xl:min-h-[60px] xl:pr-6 ${contexto ? 'min-h-[50px] py-0.5' : 'h-11'}`}
        >
          {alSalir ? (
            <button
              type="button"
              onClick={alSalir}
              aria-label={salidaEtiqueta}
              title={salidaEtiqueta}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
            >
              <X size={19} aria-hidden />
            </button>
          ) : (
            <Link
              to={destino}
              state={salidaEstado}
              onClick={alPulsarSalida}
              aria-label={salidaEtiqueta}
              title={salidaEtiqueta}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
            >
              <X size={19} aria-hidden />
            </Link>
          )}
          {contexto ? (
            // Dos líneas: con qué (12 px, el mínimo de texto) y qué (14 px
            // seminegrita). El título se recorta en una línea: entero se
            // lee en el índice de pasos, que abre el contador.
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] leading-[1.3] text-noct-neutral-500">{contexto}</p>
              <h1 className="truncate text-[14px] font-semibold leading-[1.3] md:text-[15px]">{titulo}</h1>
            </div>
          ) : (
            <h1 className="min-w-0 flex-1 truncate text-[14.5px] font-medium leading-tight">{titulo}</h1>
          )}
          {onBuscar && (
            <button
              type="button"
              onClick={onBuscar}
              aria-label="Buscar sin salir de aquí"
              aria-keyshortcuts="/"
              title="Buscar sin salir de aquí (/)"
              className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-2.5 text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text xl:h-9 xl:rounded-[10px]"
            >
              <MagnifyingGlass size={18} aria-hidden />
              {/* La tecla que ya existe, a la vista donde hay teclado (desde 1280). */}
              <kbd
                aria-hidden
                className="hidden h-[22px] min-w-[22px] items-center justify-center rounded-md border border-b-2 border-noct-divider bg-noct-bg px-1.5 font-mono text-[11.5px] max-md:text-[12px] font-medium leading-none text-noct-neutral-400 xl:inline-flex"
              >
                /
              </kbd>
            </button>
          )}
          {trailing}
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-surface/[.95] backdrop-blur-[12px]">
      <div className="flex items-start gap-2 py-2.5 pl-4 pr-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] max-md:text-[12px] font-semibold uppercase leading-[1.2] tracking-[.08em] text-noct-accent-300">
            {rotulo}
          </p>
          <h1 className="mt-[3px] truncate text-[16px] font-medium leading-[1.25]">{titulo}</h1>
          {/* La promesa explícita de que salir no pierde el sitio: sin
              ella, la X es una puerta sin letrero. */}
          {rutaVuelta && (
            <p className="mt-[3px] truncate text-[12px] leading-[1.3] text-noct-neutral-500">
              {rutaVuelta} · vuelves aquí al terminar
            </p>
          )}
        </div>
        {alSalir ? (
          <button
            type="button"
            onClick={alSalir}
            aria-label={salidaEtiqueta}
            title={salidaEtiqueta}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
          >
            <X size={20} aria-hidden />
          </button>
        ) : (
          <Link
            to={destino}
            state={salidaEstado}
            onClick={alPulsarSalida}
            aria-label={salidaEtiqueta}
            title={salidaEtiqueta}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
          >
            <X size={20} aria-hidden />
          </Link>
        )}
      </div>

      {children}
    </div>
  )
}
