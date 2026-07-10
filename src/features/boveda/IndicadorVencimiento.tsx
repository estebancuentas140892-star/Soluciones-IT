import { estadoVencimiento } from '../../lib/vencimiento'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })

// Aviso de vencimiento de una credencial (fase B2): ambar si se
// acerca (dentro de DIAS_AVISO_VENCIMIENTO), rojo si ya vencio. No
// muestra nada si no hay fecha o falta mucho: no todas las
// credenciales necesitan rotarse.
export function IndicadorVencimiento({ venceEn }: { venceEn: string | null }) {
  const estado = estadoVencimiento(venceEn)
  if (!estado || !venceEn) return null

  const fecha = formateadorFecha.format(new Date(`${venceEn}T00:00:00`))
  const info =
    estado === 'vencida'
      ? { texto: `Venció el ${fecha}`, clases: 'border-red-900 bg-red-950/40 text-red-300' }
      : { texto: `Vence el ${fecha}`, clases: 'border-amber-800 bg-amber-950/40 text-amber-300' }

  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${info.clases}`}>
      <span aria-hidden>{estado === 'vencida' ? '⛔' : '⚠'}</span>
      {info.texto}
    </span>
  )
}
