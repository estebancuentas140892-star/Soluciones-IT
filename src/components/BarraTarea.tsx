import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { padreDe, vueltaDeTarea } from '../lib/navegacion'
import { X } from './iconos'

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
   * Ruta de vuelta escrita ("Guías › Impresoras"). Si no se pasa, se
   * deriva de la jerarquía central; cuando esta solo sabe decir
   * "Volver" (editar y ejecutar suben a una ficha cuyo nombre depende
   * de datos en runtime), la pantalla debe pasarla.
   */
  vuelta?: string
  /** Override del destino de la X (por defecto, el padre declarado). */
  salidaA?: string
  /** Texto accesible de la X. Por defecto "Salir sin guardar". */
  salidaEtiqueta?: string
  /**
   * Reemplaza la navegación de la X (por ejemplo, para confirmar antes
   * de descartar cambios). Si se pasa, la X deja de ser un enlace.
   */
  alSalir?: () => void
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
}

export function BarraTarea({
  rotulo,
  titulo,
  vuelta,
  salidaA,
  salidaEtiqueta = 'Salir sin guardar',
  alSalir,
  children,
  compacta = false,
  trailing,
}: Props) {
  const { pathname } = useLocation()
  const destino = salidaA ?? padreDe(pathname)?.to ?? '/'
  const rutaVuelta = vuelta ?? vueltaDeTarea(pathname)

  if (compacta) {
    return (
      <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-surface/[.95] backdrop-blur-[12px]">
        <div className="flex h-11 items-center gap-1 pl-1 pr-1">
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
              aria-label={salidaEtiqueta}
              title={salidaEtiqueta}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-noct-neutral-300 hover:bg-noct-text/[.07] hover:text-noct-text"
            >
              <X size={19} aria-hidden />
            </Link>
          )}
          <h1 className="min-w-0 flex-1 truncate text-[14.5px] font-medium leading-tight">{titulo}</h1>
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
          <p className="text-[11px] font-semibold uppercase leading-[1.2] tracking-[.08em] text-noct-accent-300">
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
