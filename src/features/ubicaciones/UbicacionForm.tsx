import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { FloppyDisk } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { idsDescendientes, mapaPorId, ordenarPorRuta, rutaUbicacion } from './arbol'

const CLASE_CAMPO =
  'w-full box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'
const CLASE_ETIQUETA = 'text-[12.5px] font-medium text-noct-neutral-400'

// Crear o editar una ubicacion (grupo N3) re-autorizada al sistema
// Nocturne: nombre, ubicacion superior (jerarquia opcional) y notas. La
// ubicacion superior no puede ser ella misma ni una de sus descendientes
// (crearia un ciclo). Trae su propio shell Nocturne, por eso sale del
// Layout oscuro. La logica y los datos no cambian.
export function UbicacionForm() {
  const { ubicacionId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esEdicion = Boolean(ubicacionId)
  // Creacion contextual: "Sub-ubicación" desde una ficha precarga el
  // padre con /ubicaciones/nueva?padre=<id>.
  const padreContextual = esEdicion ? '' : (searchParams.get('padre') ?? '')
  const [id] = useState(() => ubicacionId ?? nuevoId())

  const ubicacion = useLiveQuery(
    async () => (ubicacionId ? ((await db.ubicaciones.get(ubicacionId)) ?? null) : undefined),
    [ubicacionId],
  )
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const porId = useMemo(() => mapaPorId(ubicaciones), [ubicaciones])
  // Candidatos a padre: todas menos ella misma y su descendencia.
  const posiblesPadres = useMemo(() => {
    const prohibidos = idsDescendientes(id, ubicaciones)
    return ordenarPorRuta(ubicaciones).filter((u) => !prohibidos.has(u.id))
  }, [ubicaciones, id])

  const [nombre, setNombre] = useState('')
  const [padreId, setPadreId] = useState(padreContextual)
  const [notas, setNotas] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cargadoInicial, setCargadoInicial] = useState(!esEdicion)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!ubicacion || cargadoInicial) return
    setNombre(ubicacion.nombre)
    setPadreId(ubicacion.padreId ?? '')
    setNotas(ubicacion.notas)
    setCargadoInicial(true)
  }, [ubicacion, cargadoInicial])

  if (esEdicion && ubicacion === null) return <Navigate to="/ubicaciones" replace />

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (nombre.trim() === '') return
    setGuardando(true)
    await guardarRegistro(
      'ubicaciones',
      { id, nombre: nombre.trim(), padreId: padreId || null, notas: notas.trim() },
      motivo.trim(),
    )
    navigate(`/ubicaciones/${id}`)
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver variante="nocturne">Cancelar</BotonVolver>
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">
              {esEdicion ? 'Editar ubicación' : 'Nueva ubicación'}
            </h1>
            <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">Un lugar físico donde viven los equipos</p>
          </div>
        </div>

        {esEdicion && !cargadoInicial ? (
          <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
        ) : (
          <form onSubmit={manejarEnvio} className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-[18px]">
            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>
                Nombre <span className="text-noct-accent-300">*</span>
              </span>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Taquilla 2, Bodega, Rack principal..."
                className={`min-h-11 ${CLASE_CAMPO}`}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Dentro de (opcional)</span>
              <select value={padreId} onChange={(e) => setPadreId(e.target.value)} className={`min-h-11 ${CLASE_CAMPO}`}>
                <option value="">Ninguna (ubicación raíz)</option>
                {posiblesPadres.map((u) => (
                  <option key={u.id} value={u.id}>
                    {rutaUbicacion(u.id, porId)}
                  </option>
                ))}
              </select>
              <span className="text-[12px] text-noct-neutral-600">
                Agrupa lugares dentro de otro mayor: "Sede Norte" &gt; "Área caja" &gt; "Taquilla 2".
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={CLASE_ETIQUETA}>Notas (opcional)</span>
              <textarea
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className={`resize-y leading-[1.5] ${CLASE_CAMPO}`}
              />
            </label>

            {esEdicion && (
              <label className="flex flex-col gap-1.5">
                <span className={CLASE_ETIQUETA}>Motivo del cambio (opcional)</span>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por qué se actualizó esta ubicación"
                  className={`min-h-11 ${CLASE_CAMPO}`}
                />
              </label>
            )}

            <button
              type="submit"
              disabled={guardando || nombre.trim() === ''}
              className={`mt-1 ${BTN_PRIMARIO} min-h-11 disabled:opacity-50`}
            >
              <FloppyDisk size={15} aria-hidden />
              {guardando ? 'Guardando...' : 'Guardar ubicación'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
