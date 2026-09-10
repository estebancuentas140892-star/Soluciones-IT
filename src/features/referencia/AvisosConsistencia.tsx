import { Info, Warning } from '../../components/iconos'
import type { AvisoConsistencia } from './consistencia'

// LOS AVISOS DE CONSISTENCIA, EN EL SITIO DONDE SE ESCRIBE.
//
// Describen y no bloquean (mismo criterio que `validacionVinculos.ts`):
// nunca impiden guardar, porque frenar a quien esta documentando es
// peor que la deriva que se quiere evitar. Dos niveles y ni uno mas:
//
//   contradiccion  dos fichas dicen cosas distintas de lo mismo, y una
//                  persona tiene que decidir cual vale. Ambar.
//   incompleto     falta un dato que hace falta para usar la ficha con
//                  seguridad. Neutro: no hay nada mal escrito todavia.

export function AvisosConsistencia({
  avisos,
  titulo = 'Revisar antes de guardar',
}: {
  avisos: AvisoConsistencia[]
  titulo?: string
}) {
  if (avisos.length === 0) return null

  return (
    <section
      aria-label={titulo}
      className="flex flex-col gap-2 rounded-lg border border-noct-divider bg-noct-surface p-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-noct-neutral-400">
        {titulo} ({avisos.length})
      </p>
      {avisos.map((aviso, indice) => {
        const grave = aviso.nivel === 'contradiccion'
        const Icono = grave ? Warning : Info
        return (
          <p
            key={`${aviso.clave}-${indice}`}
            className={`flex items-start gap-2 text-[12.5px] leading-normal ${
              grave ? 'text-noct-precaucion' : 'text-noct-neutral-300'
            }`}
          >
            <Icono size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span className="min-w-0">{aviso.texto}</span>
          </p>
        )
      })}
    </section>
  )
}
