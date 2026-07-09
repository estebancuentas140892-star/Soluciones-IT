import type { ReactNode } from 'react'

// Un bloque con nombre y proposito dentro de un formulario largo:
// separa visualmente las etapas del constructor sin cambiar ningun
// dato. Introducido en la tarea 48 (editor de procedimientos) y
// reutilizado en dispositivos y credenciales (tarea Dis1+B1) para que
// los tres formularios largos de la app compartan el mismo patron.
export function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">{titulo}</h2>
        <p className="text-xs text-slate-500">{descripcion}</p>
      </div>
      {children}
    </section>
  )
}
