import { LockSimple } from '../iconos'

// POR QUÉ UNA ACCIÓN NO ESTÁ DISPONIBLE (tarea 348, ajuste 5 del 2026-10-21).
//
// Un botón apagado sin explicación se lee como una aplicación que falla. Esta
// es la explicación: un candado y una frase que dice QUÉ falta y, cuando
// cabe, cómo se resuelve ("Primero confirma la advertencia de arriba."). Se
// anuncia (`role="status"`) para que quien usa lector de pantalla se entere
// del motivo al mismo tiempo que ve el botón apagado.

export function MensajeNoDisponible({ texto }: { texto: string }) {
  return (
    <div
      role="status"
      data-no-disponible
      className="flex items-start gap-2 rounded-xl bg-noct-tinte px-3 py-2"
    >
      <LockSimple size={18} className="mt-px shrink-0 text-noct-neutral-300" aria-hidden />
      <p className="min-w-0 text-[13.5px] font-bold leading-[1.4] text-noct-text text-pretty">{texto}</p>
    </div>
  )
}
