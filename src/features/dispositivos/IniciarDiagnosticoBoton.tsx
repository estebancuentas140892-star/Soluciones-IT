import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { CaretRight, TreeStructure } from '../../components/iconos'

// Boton "Iniciar diagnóstico" desde la ficha de un equipo (fase R1,
// punto 12 de PROPUESTA_MODULOS.md): lleva a los diagnosticos de la
// categoria de ESTE equipo, en vez de la lista completa. Solo se
// muestra si existe al menos uno: un boton que siempre lleva a una
// lista vacia no ayuda a nadie. Re-autorizado a Nocturne (handoff
// "Rediseño de aplicación empresarial", Ficha de Dispositivo.dc.html):
// tarjeta destacada en el acento, delineada, encabeza "Resolver con
// este equipo".
export function IniciarDiagnosticoBoton({
  categoriaId,
  categoriaNombre,
}: {
  categoriaId: string
  categoriaNombre?: string
}) {
  const hayDiagnosticos = useLiveQuery(
    async () =>
      (await db.diagnosticos.where('categoriaId').equals(categoriaId).filter((d) => !d.eliminadoEn).count()) > 0,
    [categoriaId],
  )

  if (!hayDiagnosticos) return null

  return (
    <Link
      to={`/diagnostico?categoria=${categoriaId}`}
      className="flex min-h-[52px] items-center gap-3 rounded-md border border-noct-accent/35 bg-noct-accent/[.08] px-[13px] py-2 text-noct-text transition-colors hover:bg-noct-accent/[.13]"
    >
      <TreeStructure size={19} className="shrink-0 text-noct-accent-300" aria-hidden />
      <span className="min-w-0 flex-1 text-sm font-medium">
        Iniciar diagnóstico {categoriaNombre ? `de ${categoriaNombre}` : 'para este equipo'}
      </span>
      <CaretRight size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
    </Link>
  )
}
