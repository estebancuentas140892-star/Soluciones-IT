import { infoDeEstado } from './estados'

// Chip visual del estado de un dispositivo: icono y color segun
// infoDeEstado (verde/ambar/rojo/negro para los estados sugeridos,
// gris neutro para cualquier otro texto libre). Reutilizado en la
// ficha y en el listado.
export function IndicadorEstado({ estado }: { estado: string }) {
  if (!estado) return null
  const info = infoDeEstado(estado)
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${info.clases}`}
    >
      <span aria-hidden>{info.icono}</span>
      {estado}
    </span>
  )
}
