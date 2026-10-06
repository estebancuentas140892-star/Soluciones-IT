import type { ReactNode } from 'react'

// LA MARCA DE ESTADO DEL CONTENIDO (tarea 291, auditoría UX de Claude
// Design, sección 11, S5; sección 13, "Operativo" y el ámbar).
//
// Antes, "En mantenimiento" era un punto ámbar con texto, "Borrador" una
// etiqueta gris en un sitio y un texto ámbar en otro ("Borrador ·
// contenido por confirmar") y "Vigencia por confirmar" una pastilla con
// reloj. Ahora es una sola marca: un punto y su texto, en la línea de
// detalle de una fila o bajo el título de una ficha. Nunca una franja en
// una lista.
//
// - `atencion` (ámbar): hay que tener cuidado al usarlo, pero no bloquea
//   (En mantenimiento, Borrador por confirmar, Vigencia por confirmar).
// - `informacion` (gris): solo informa (Por subir, Dado de baja,
//   "Operativo", que ya no va en una pastilla verde).
//
// El color nunca es la única señal: el texto dice el estado.
export function MarcaEstado({
  tono = 'informacion',
  children,
  className = '',
}: {
  tono?: 'atencion' | 'informacion'
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12.5px] leading-tight ${
        tono === 'atencion' ? 'text-noct-precaucion' : 'text-noct-neutral-300'
      } ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  )
}
