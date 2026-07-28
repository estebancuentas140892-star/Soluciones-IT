import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { CaretRight, PencilSimple, TrashSimple } from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { db } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { Historial } from '../historial/Historial'

// Ficha 360 de una persona (hallazgo T1 de AUDITORIA_FLUJOS_TI.md): los
// equipos que tiene asignados (el inverso de dispositivos.responsableId,
// calculado con un filtro directo, mismo criterio que UbicacionPage), más
// notas e historial. Trae su propio shell Nocturne, por eso sale del
// Layout oscuro.
export function PersonaPage() {
  const { personaId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  const persona = useLiveQuery(() => db.personas.get(personaId), [personaId])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const equipos = useMemo(
    () =>
      dispositivos
        .filter((d) => d.responsableId === personaId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [dispositivos, personaId],
  )

  if (persona === null) return <Navigate to="/personas" replace />
  if (!persona) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  async function eliminar() {
    await eliminarRegistro('personas', personaId)
    navigate('/personas')
  }

  const advertencia = equipos.length > 0 ? `${equipos.length} ${equipos.length === 1 ? 'equipo quedará' : 'equipos quedarán'} sin este vínculo.` : null

  return (
    // Nivel 2 del chasis (tarea 185): documento.
    <Chasis
      modo="documento"
      volverA="/personas"
      volverEtiqueta="Personas"
      barra={
        <div className="px-4 pb-3 pt-0.5">
          <h1 className="m-0 text-[21px] font-medium leading-[1.25]">{persona.nombre}</h1>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-12 pt-3.5">
        <div className="flex flex-wrap gap-2">
          <Link to={`/personas/${personaId}/editar`} className={`shrink-0 ${BTN_SECUNDARIO}`}>
            <PencilSimple size={14} aria-hidden />
            Editar
          </Link>
          <button type="button" onClick={() => setMostrarEliminar(true)} className={BTN_GHOST_PELIGRO}>
            <TrashSimple size={14} aria-hidden />
            Eliminar
          </button>
        </div>

        {persona.notas && (
          <section>
            <TituloSeccion className="mb-1.5">Notas</TituloSeccion>
            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55] text-noct-neutral-300">{persona.notas}</p>
          </section>
        )}

        <section>
          <TituloSeccion className="mb-1.5">Equipos asignados</TituloSeccion>
          {equipos.length === 0 ? (
            <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-3.5 text-center text-[12.5px] text-noct-neutral-500">
              Ningún equipo tiene asignada esta persona.
            </p>
          ) : (
            <div className="flex flex-col">
              {equipos.map((d) => (
                <Link
                  key={d.id}
                  to={`/dispositivos/${d.id}`}
                  className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                >
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{d.nombre}</span>
                  {d.ip && <span className="shrink-0 font-mono text-[11px] text-noct-neutral-600">{d.ip}</span>}
                  <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </section>

        <Historial entidadTipo="persona" entidadId={personaId} />
      </main>

      <DialogoEliminar
        abierto={mostrarEliminar}
        titulo={`¿Eliminar a "${persona.nombre}"?`}
        descripcion="Los equipos conservarán el nombre como texto, pero perderán el enlace a esta ficha."
        advertencia={advertencia}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </Chasis>
  )
}
