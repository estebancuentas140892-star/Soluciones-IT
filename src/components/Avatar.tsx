import { inicialesDe } from '../lib/iniciales'
import { User } from './iconos'

// Avatar del técnico: sus iniciales en un círculo, o el icono genérico
// si no hay nombre ni correo (`inicialesDe` puede devolver cadena
// vacía). Nace en la tarea 181 (avatar de la barra superior) y se
// extrae aquí en la 182 al reutilizarse en la fila de perfil de
// PantallaMas, con otro tamaño: `className` lleva el alto/ancho/tipografía
// (no hay un tamaño único posible con clases Tailwind estáticas).
export function Avatar({
  nombre,
  correo,
  className = 'h-[30px] w-[30px] text-[11px]',
}: {
  nombre?: string | null
  correo?: string | null
  className?: string
}) {
  const iniciales = inicialesDe(nombre, correo)

  if (iniciales) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-noct-neutral-800 font-medium leading-none text-noct-neutral-100 ${className}`}
      >
        {iniciales}
      </span>
    )
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-noct-neutral-800 text-noct-neutral-300 ${className}`}
    >
      <User size={17} aria-hidden />
    </span>
  )
}
