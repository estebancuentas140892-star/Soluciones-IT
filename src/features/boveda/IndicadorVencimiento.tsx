import { ClockCountdown } from '../../components/iconos'
import { estadoVencimiento } from '../../lib/vencimiento'

const formateadorFecha = new Intl.DateTimeFormat('es', { dateStyle: 'medium' })

// Fecha corta al estilo del rediseño ("28 jul"), con el año solo cuando
// no es el actual: en una pastilla junto al título, el año del año en
// curso es ruido.
function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  const opciones: Intl.DateTimeFormatOptions =
    fecha.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat('es', opciones).format(fecha)
}

// Aviso de vencimiento de una credencial (fase B2): ambar si se
// acerca (dentro de DIAS_AVISO_VENCIMIENTO), rojo si ya vencio. No
// muestra nada si no hay fecha o falta mucho: no todas las
// credenciales necesitan rotarse.
//
// Dos variantes: "claro" es el estilo heredado (lo usa el paso de un
// procedimiento) y "nocturne" la pastilla delineada del rediseño
// (handoff Ficha de Credencial.dc.html), sin relleno y con el icono de
// cuenta regresiva del sistema.
export function IndicadorVencimiento({
  venceEn,
  variante = 'claro',
}: {
  venceEn: string | null
  variante?: 'claro' | 'nocturne'
}) {
  const estado = estadoVencimiento(venceEn)
  if (!estado || !venceEn) return null

  const fechaIso = `${venceEn}T00:00:00`
  const vencida = estado === 'vencida'

  if (variante === 'nocturne') {
    return (
      <span
        className={`inline-flex min-h-[28px] w-fit shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border px-[11px] text-[12px] font-medium ${
          vencida ? 'border-noct-error/40 text-noct-error' : 'border-noct-precaucion/40 text-noct-precaucion'
        }`}
      >
        <ClockCountdown size={13} aria-hidden />
        {vencida ? 'Venció el' : 'Vence el'} {fechaCorta(fechaIso)}
      </span>
    )
  }

  const fecha = formateadorFecha.format(new Date(fechaIso))
  const info = vencida
    ? { texto: `Venció el ${fecha}`, clases: 'border-red-900 bg-red-950/40 text-red-300' }
    : { texto: `Vence el ${fecha}`, clases: 'border-amber-800 bg-amber-950/40 text-amber-300' }

  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${info.clases}`}>
      <span aria-hidden>{vencida ? '⛔' : '⚠'}</span>
      {info.texto}
    </span>
  )
}
