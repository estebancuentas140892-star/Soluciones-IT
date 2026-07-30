import { Link } from 'react-router-dom'
import { ArrowsClockwise, Play } from './iconos'

// Barra inferior de UNA sola acción dominante (tarea 172, mockup `1f`).
//
// Nace de la auditoría de la ficha de artículo: "Ejecutar" y "Editar"
// pesaban lo mismo (Nocturne pide el primario delineado, así que eran dos
// botones de borde uno al lado del otro) y vivían arriba, en la zona menos
// alcanzable del pulgar, cuando "Ejecutar" es justo lo que se toca de pie
// frente al equipo. Además decía siempre "Ejecutar", incluso con 2 de 6
// pasos hechos, donde lo que se hace es *seguir*.
//
// La etiqueta dice qué va a pasar, y debajo la promesa de que el avance no
// se pierde. Reservar su alto es responsabilidad de quien la monta (el
// chasis reserva el de las pestañas, no el de esta barra: R22 cubre el
// chasis, no las barras de una pantalla).

export type EstadoAccion = 'empezar' | 'seguir' | 'repetir'

interface Props {
  to: string
  estado: EstadoAccion
  /** Paso actual (1-based) y total, solo para el estado `seguir`. */
  paso?: number
  total?: number
}

export function BarraAccionFicha({ to, estado, paso, total }: Props) {
  const etiqueta =
    estado === 'seguir' && paso != null && total != null
      ? `Seguir en el paso ${paso} de ${total}`
      : estado === 'repetir'
        ? 'Repetir'
        : 'Empezar'
  const Icono = estado === 'repetir' ? ArrowsClockwise : Play
  const nota =
    estado === 'seguir'
      ? 'Tu avance se guarda en este teléfono'
      : estado === 'repetir'
        ? 'Vuelve a empezar desde el paso 1'
        : 'Un paso a la vez, sin distracciones'

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.92] px-4 pb-3 pt-2.5 backdrop-blur-[12px] lg:px-10">
      <Link
        to={to}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-noct-accent bg-noct-accent/[.12] px-4 text-[15px] font-semibold text-noct-accent-300 hover:bg-noct-accent/[.18] active:bg-noct-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noct-accent"
      >
        <Icono size={17} aria-hidden />
        {etiqueta}
      </Link>
      <p className="mt-1.5 text-center text-[11.5px] text-noct-neutral-500">{nota}</p>
    </div>
  )
}
