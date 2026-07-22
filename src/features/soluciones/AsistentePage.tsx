import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import { BotonVolver } from '../../components/BotonVolver'
import { AsistenteVista } from './AsistenteVista'

// Pantalla del modo ejecucion (asistente): fuera del Layout (sin barra
// inferior) para que el tecnico vea solo lo que necesita en el momento
// exacto, sin distraerse con el resto de la app ni con el resto del
// procedimiento (que en la vista de lista se ve completo de un vistazo).
// Rediseño Nocturne (tarea 78): trae su propio shell oscuro a pantalla
// completa; antes usaba estilos de tema claro fuera del Layout y se veia
// "en blanco". Salir vuelve a la ficha del articulo sin perder avance:
// el progreso vive en la base local, no en el estado de esta pantalla.
export function AsistentePage() {
  const { categoriaId = '', articuloId = '' } = useParams()

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
  const procedimiento = useMemo(() => normalizarProcedimiento(articulo?.procedimiento), [articulo])

  if (articulo === null) return <Navigate to="/soluciones" replace />
  if (!articulo) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }
  // Un articulo sin pasos (sin procedimiento, o con metadata pero sin
  // pasos: K1) no tiene modo ejecucion que ofrecer.
  if (!procedimientoEjecutable(procedimiento)) {
    return <Navigate to={`/soluciones/${categoriaId}/${articuloId}`} replace />
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        {/* Cabecera pegajosa: salir a la ficha, rotulo del modo y titulo
            del procedimiento en ejecucion. */}
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] px-2 pb-2 pt-2.5 backdrop-blur-[12px]">
          <div className="flex items-center justify-between gap-2">
            <BotonVolver>Salir</BotonVolver>
            <span className="shrink-0 pr-1 text-[11px] font-medium uppercase tracking-[0.08em] text-noct-neutral-500">
              Modo ejecución
            </span>
          </div>
          <p className="min-w-0 truncate px-1.5 pt-0.5 text-[13px] text-noct-neutral-400">{articulo.titulo}</p>
        </div>

        <main className="flex flex-1 flex-col px-4 pb-10 pt-4">
          {/* Sin onCompletado: al nivel 0 no hay a quien avisar,
              AsistenteVista ya muestra su propio resumen de "completado" y
              el tecnico decide cuando salir con el boton de arriba. */}
          <AsistenteVista articuloId={articuloId} procedimiento={procedimiento} nivel={0} />
        </main>
      </div>
    </div>
  )
}
