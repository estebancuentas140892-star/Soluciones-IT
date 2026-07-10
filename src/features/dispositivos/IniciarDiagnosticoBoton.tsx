import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'

// Boton "Iniciar diagnóstico" desde la ficha de un equipo (fase R1,
// punto 12 de PROPUESTA_MODULOS.md): lleva a los diagnosticos de la
// categoria de ESTE equipo, en vez de la lista completa. Solo se
// muestra si existe al menos uno: un boton que siempre lleva a una
// lista vacia no ayuda a nadie.
export function IniciarDiagnosticoBoton({ categoriaId }: { categoriaId: string }) {
  const hayDiagnosticos = useLiveQuery(
    async () =>
      (await db.diagnosticos.where('categoriaId').equals(categoriaId).filter((d) => !d.eliminadoEn).count()) > 0,
    [categoriaId],
  )

  if (!hayDiagnosticos) return null

  return (
    <Link
      to={`/diagnostico?categoria=${categoriaId}`}
      className="flex items-center gap-2 rounded-xl border border-sky-900 bg-sky-950/40 px-4 py-3 text-sm font-medium text-sky-100"
    >
      <span aria-hidden>🧭</span>
      Iniciar diagnóstico para este equipo
    </Link>
  )
}
