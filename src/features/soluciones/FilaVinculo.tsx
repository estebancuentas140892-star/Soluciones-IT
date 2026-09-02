import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowSquareOut, CaretDown, CaretRight, type IconoProps } from '../../components/iconos'

// LA FILA DE UN VÍNCULO DEL PASO (hallazgo M-012, regla M-R11, tablero
// `3b`; y el turno 12, tablero `12b`).
//
// Todo lo que cuelga de un paso (el dato protegido, la guía anidada, la
// contingencia, la foto de evidencia) se dibujaba antes como una
// TARJETA CON MARCO DE COLOR: acento para el subprocedimiento y la
// credencial, ámbar para la solución. El color acababa marcando el tipo
// de vínculo y la profundidad, no el significado, y la única
// advertencia real del paso quedaba enterrada entre marcos de su mismo
// tono.
//
// Ahora todos son la misma fila: 44 px, icono neutro, sin fondo y sin
// borde. Lo que las distingue es el icono y el rótulo, no el color. El
// único color que queda en la fila es el de la palabra que se toca
// ("Mostrar"), porque es la acción, y el acento es el color de las
// acciones en toda la app.
interface Comun {
  Icono: ComponentType<IconoProps>
  // Qué es esto ("Otra guía", "Si esto falla"). Antes iba en el color
  // del vínculo; ahora es neutro y el significado lo lleva la palabra.
  kicker?: string
  titulo: string
  // Segunda línea pequeña: la promesa de regreso de un vínculo que sale
  // de la pantalla, o a qué documento pertenece un avance.
  nota?: string | null
  // Anillo de avance u otro indicador a la derecha del título.
  extra?: ReactNode
}

// Fila que despliega el vínculo aquí mismo: es un interruptor, así que
// dice si está abierta y no promete ir a ninguna parte.
export function FilaVinculo({
  Icono,
  kicker,
  titulo,
  nota,
  extra,
  abierto,
  onAlternar,
  accion,
  ariaLabel,
}: Comun & {
  abierto: boolean
  onAlternar: () => void
  // Palabra de la acción en vez del caret (el patrón del dato
  // protegido: "Mostrar" / "Ocultar").
  accion?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-expanded={abierto}
      aria-label={ariaLabel}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 py-1.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-noct-accent"
    >
      <Icono size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
      <CuerpoFila kicker={kicker} titulo={titulo} nota={nota} />
      {extra}
      {accion ? (
        <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300">{accion}</span>
      ) : abierto ? (
        <CaretDown size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
      ) : (
        <CaretRight size={13} className="shrink-0 text-noct-neutral-500" aria-hidden />
      )}
    </button>
  )
}

// Fila que SALE de la pantalla (regla R58 del turno 12). Se distingue
// de la anterior en el icono de salida y en la nota, que promete el
// regreso: antes las dos se veían idénticas y tocar una llevaba a otra
// pantalla mientras que tocar la otra desplegaba en el sitio.
export function EnlaceVinculo({
  Icono = ArrowSquareOut,
  kicker,
  titulo,
  nota,
  extra,
  to,
}: Omit<Comun, 'Icono'> & { Icono?: ComponentType<IconoProps>; to: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 w-full items-center gap-2.5 py-1.5 outline-none hover:bg-noct-text/[.04] focus-visible:outline-2 focus-visible:outline-noct-accent"
    >
      <Icono size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
      <CuerpoFila kicker={kicker} titulo={titulo} nota={nota} />
      {extra}
      <ArrowSquareOut size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}

// Fila que EJECUTA algo en el sitio (la foto de evidencia): no
// despliega ni sale, así que no lleva ni caret ni flecha, solo la
// palabra de la acción. Antes era un botón fantasma en acento, la única
// pieza de su grupo que no se parecía a las demás.
export function AccionVinculo({
  Icono,
  kicker,
  titulo,
  nota,
  accion,
  onEjecutar,
  deshabilitado,
}: Comun & { accion: string; onEjecutar: () => void; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      onClick={onEjecutar}
      disabled={deshabilitado}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 py-1.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-noct-accent disabled:opacity-50"
    >
      <Icono size={16} className="shrink-0 text-noct-neutral-400" aria-hidden />
      <CuerpoFila kicker={kicker} titulo={titulo} nota={nota} />
      <span className="shrink-0 text-[12.5px] font-medium text-noct-accent-300">{accion}</span>
    </button>
  )
}

function CuerpoFila({ kicker, titulo, nota }: Pick<Comun, 'kicker' | 'titulo' | 'nota'>) {
  return (
    <span className="min-w-0 flex-1">
      {kicker && (
        <span className="block text-[11px] leading-tight text-noct-neutral-500">{kicker}</span>
      )}
      <span className="block truncate text-[13.5px] font-medium text-noct-text">{titulo}</span>
      {nota && <span className="mt-px block text-[11.5px] leading-tight text-noct-neutral-500">{nota}</span>}
    </span>
  )
}
