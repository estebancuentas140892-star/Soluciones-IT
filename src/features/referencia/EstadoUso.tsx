import { CheckCircle, ClockCountdown } from '../../components/iconos'
import type { EstadoUsoHerramienta } from '../../lib/db'
import { TEXTO_ESTADO_USO } from './referencias'

// LO QUE SE SABE DEL USO DE UNA HERRAMIENTA, SIN EXAGERARLO.
//
// Una herramienta con evidencia historica (VMware ESXi, Issabel) no se
// puede presentar como si hoy se usara: ese es el error que un tecnico
// nuevo pagaria buscando un servidor que ya no existe. Por eso lo
// confirmado va en verde con su marca, lo documentado dice con todas
// las letras que esta pendiente de confirmar, y sin estado no se dibuja
// nada (una linea "estado: sin indicar" es ruido).
export function EstadoUso({ estado }: { estado: EstadoUsoHerramienta | undefined }) {
  if (estado !== 'confirmado' && estado !== 'documentado') return null
  const confirmado = estado === 'confirmado'
  const Icono = confirmado ? CheckCircle : ClockCountdown
  return (
    <p
      className={`flex items-start gap-2 text-[13px] leading-snug ${
        confirmado ? 'text-noct-exito' : 'text-noct-neutral-300'
      }`}
    >
      <Icono
        size={15}
        className={`mt-px shrink-0 ${confirmado ? '' : 'text-noct-precaucion'}`}
        aria-hidden
      />
      <span className="min-w-0 text-pretty">{TEXTO_ESTADO_USO[estado]}</span>
    </p>
  )
}
