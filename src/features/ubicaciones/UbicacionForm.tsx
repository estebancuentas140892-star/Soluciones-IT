import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { Seccion } from '../../components/Seccion'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { idsDescendientes, mapaPorId, ordenarPorRuta, rutaUbicacion } from './arbol'

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Crear o editar una ubicacion (grupo N3): nombre, ubicacion superior
// (jerarquia opcional) y notas. La ubicacion superior no puede ser ella
// misma ni una de sus descendientes (crearia un ciclo).
export function UbicacionForm() {
  const { ubicacionId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const esEdicion = Boolean(ubicacionId)
  // Creacion contextual: "+ Sub-ubicación" desde una ficha precarga el
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
  if (esEdicion && !cargadoInicial) {
    return <p className="px-4 pt-6 text-sm text-slate-400">Cargando...</p>
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    setGuardando(true)
    await guardarRegistro(
      'ubicaciones',
      { id, nombre: nombre.trim(), padreId: padreId || null, notas: notas.trim() },
      motivo.trim(),
    )
    navigate(`/ubicaciones/${id}`)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver />
        <h1 className="text-xl font-semibold">{esEdicion ? 'Editar ubicación' : 'Nueva ubicación'}</h1>
      </header>

      <form onSubmit={manejarEnvio} className="flex flex-col gap-5">
        <Seccion titulo="Datos de la ubicación" descripcion="Un lugar físico donde viven los equipos.">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Nombre
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Taquilla 2, Bodega, Rack principal..."
              className={CLASE_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Dentro de (opcional)
            <select value={padreId} onChange={(e) => setPadreId(e.target.value)} className={CLASE_INPUT}>
              <option value="">Ninguna (ubicación raíz)</option>
              {posiblesPadres.map((u) => (
                <option key={u.id} value={u.id}>
                  {rutaUbicacion(u.id, porId)}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Agrupa lugares dentro de otro mayor: "Sede Norte" &gt; "Área caja" &gt; "Taquilla 2".
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Notas (opcional)
            <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className={CLASE_INPUT} />
          </label>

          {esEdicion && (
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Motivo del cambio (opcional)
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="¿Por qué se actualizó esta ubicación?"
                className={CLASE_INPUT}
              />
            </label>
          )}
        </Seccion>

        <button
          type="submit"
          disabled={guardando || nombre.trim() === ''}
          className="mt-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
