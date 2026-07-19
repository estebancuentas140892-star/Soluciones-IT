import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { CaretRight, MapPin, PencilSimple, Plus, TrashSimple } from '../../components/iconos'
import { BTN_GHOST, BTN_SECUNDARIO, TituloSeccion } from '../../components/nocturne'
import { db } from '../../lib/db'
import { eliminarRegistro } from '../../lib/repositorio'
import { Historial } from '../historial/Historial'
import { cadenaUbicaciones, hijosDirectos, mapaPorId } from './arbol'

// Ficha 360 de una ubicacion (grupo N3) re-autorizada al sistema
// Nocturne (handoff "Rediseño de aplicación empresarial", derivada del
// panel de Ubicaciones.dc.html): su lugar en la jerarquía (migas), las
// sub-ubicaciones que contiene y los equipos que hay en ella (el inverso
// de dispositivos.ubicacionId), más notas e historial. Trae su propio
// shell Nocturne, por eso sale del Layout oscuro. La lógica y los datos
// no cambian.
export function UbicacionPage() {
  const { ubicacionId = '' } = useParams()
  const navigate = useNavigate()
  const [mostrarEliminar, setMostrarEliminar] = useState(false)

  const ubicacion = useLiveQuery(() => db.ubicaciones.get(ubicacionId), [ubicacionId])
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const porId = useMemo(() => mapaPorId(ubicaciones), [ubicaciones])
  const subUbicaciones = useMemo(() => hijosDirectos(ubicacionId, ubicaciones), [ubicaciones, ubicacionId])
  const equipos = useMemo(
    () =>
      dispositivos
        .filter((d) => d.ubicacionId === ubicacionId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
    [dispositivos, ubicacionId],
  )

  if (ubicacion === null) return <Navigate to="/ubicaciones" replace />
  if (!ubicacion) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  // Cadena de la raíz a la propia; los ancestros (sin la propia) son las
  // migas de pan navegables.
  const cadena = cadenaUbicaciones(ubicacionId, porId)
  const ancestros = cadena.slice(0, -1)

  async function eliminar() {
    await eliminarRegistro('ubicaciones', ubicacionId)
    navigate('/ubicaciones')
  }

  const advertencia =
    equipos.length > 0 || subUbicaciones.length > 0
      ? `${describir(equipos.length, 'equipo', 'equipos')}${
          equipos.length > 0 && subUbicaciones.length > 0 ? ' y ' : ''
        }${describir(subUbicaciones.length, 'sub-ubicación', 'sub-ubicaciones')} quedarán sin este vínculo.`
      : null

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver variante="nocturne" to="/ubicaciones">
              Ubicaciones
            </BotonVolver>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            {ancestros.length > 0 && (
              <nav className="mb-1 flex flex-wrap items-center gap-1 text-[11.5px] text-noct-neutral-500">
                {ancestros.map((a) => (
                  <span key={a.id} className="flex items-center gap-1">
                    <Link to={`/ubicaciones/${a.id}`} className="text-noct-accent-300 hover:text-noct-accent-400">
                      {a.nombre}
                    </Link>
                    <span className="text-noct-neutral-600">›</span>
                  </span>
                ))}
              </nav>
            )}
            <h1 className="m-0 text-[21px] font-medium leading-[1.25]">{ubicacion.nombre}</h1>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-[22px] px-4 pb-12 pt-3.5">
          <div className="flex flex-wrap gap-2">
            <Link to={`/ubicaciones/nueva?padre=${ubicacionId}`} className={`shrink-0 ${BTN_SECUNDARIO}`}>
              <Plus size={14} aria-hidden />
              Sub-ubicación
            </Link>
            <Link to={`/ubicaciones/${ubicacionId}/editar`} className={`shrink-0 ${BTN_SECUNDARIO}`}>
              <PencilSimple size={14} aria-hidden />
              Renombrar
            </Link>
            <button
              type="button"
              onClick={() => setMostrarEliminar(true)}
              className={`${BTN_GHOST} text-noct-error hover:bg-noct-error/10`}
            >
              <TrashSimple size={14} aria-hidden />
              Eliminar
            </button>
          </div>

          {ubicacion.notas && (
            <section>
              <TituloSeccion className="mb-1.5">Notas</TituloSeccion>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55] text-noct-neutral-300">{ubicacion.notas}</p>
            </section>
          )}

          {subUbicaciones.length > 0 && (
            <section>
              <TituloSeccion className="mb-1.5">Contiene</TituloSeccion>
              <div className="flex flex-col">
                {subUbicaciones.map((u) => (
                  <Link
                    key={u.id}
                    to={`/ubicaciones/${u.id}`}
                    className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                  >
                    <MapPin size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{u.nombre}</span>
                    <CaretRight size={13} className="shrink-0 text-noct-neutral-600" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <TituloSeccion className="mb-1.5">Equipos en este lugar</TituloSeccion>
            {equipos.length === 0 ? (
              <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-3.5 text-center text-[12.5px] text-noct-neutral-500">
                Ningún equipo tiene esta ubicación.
              </p>
            ) : (
              <div className="flex flex-col">
                {equipos.map((d) => (
                  <Link
                    key={d.id}
                    to={`/dispositivos/${d.id}`}
                    className="flex min-h-[46px] items-center gap-2.5 rounded-md px-1.5 py-2 text-noct-text transition-colors hover:bg-noct-text/[.05]"
                  >
                    <MapPin size={15} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{d.nombre}</span>
                    {d.ip && <span className="shrink-0 font-mono text-[11px] text-noct-neutral-600">{d.ip}</span>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <Historial entidadTipo="ubicacion" entidadId={ubicacionId} />
        </main>
      </div>

      <DialogoEliminar
        abierto={mostrarEliminar}
        titulo={`¿Eliminar la ubicación "${ubicacion.nombre}"?`}
        descripcion="Los equipos conservarán el nombre del lugar como texto, pero perderán el enlace a esta ficha."
        advertencia={advertencia}
        onCerrar={() => setMostrarEliminar(false)}
        onConfirmar={eliminar}
      />
    </div>
  )
}

function describir(n: number, singular: string, plural: string): string {
  if (n === 0) return ''
  return `${n} ${n === 1 ? singular : plural}`
}
