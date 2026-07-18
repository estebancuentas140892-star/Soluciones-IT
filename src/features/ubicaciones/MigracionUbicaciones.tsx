import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BotonVolver } from '../../components/BotonVolver'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import {
  claveUbicacion,
  construirMigracion,
  textosSinUbicacion,
  type GrupoMigracion,
} from './migracion'

const CLASE_INPUT =
  'rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Migracion asistida de ubicaciones (grupo N3): convierte los textos de
// ubicacion sueltos de los dispositivos en entidades `ubicaciones`. Lista
// los textos distintos, deja renombrarlos (o dejarlos en blanco para
// omitirlos) y fusiona automaticamente los que reciben el mismo nombre
// final ("Taq. Norte" y "taquilla norte" -> "Taquilla Norte"). La logica
// de agrupado y asignacion es pura (migracion.ts); aqui solo se ejecuta.
export function MigracionUbicaciones() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const textos = useMemo(() => textosSinUbicacion(dispositivos), [dispositivos])

  // nombre final editable por cada texto (clave -> nombre propuesto).
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [aplicando, setAplicando] = useState(false)
  const [listo, setListo] = useState(false)

  const nombreDe = (texto: string) => nombres[claveUbicacion(texto)] ?? texto

  // Agrupa por nombre final (sin distinguir mayusculas): dos textos con
  // el mismo nombre final se fusionan en una sola ubicacion.
  const grupos = useMemo<GrupoMigracion[]>(() => {
    const porNombre = new Map<string, GrupoMigracion>()
    for (const t of textos) {
      const clave = claveUbicacion(t.texto)
      const nombreFinal = (nombres[clave] ?? t.texto).trim()
      if (nombreFinal === '') continue
      const claveFinal = claveUbicacion(nombreFinal)
      const existente = porNombre.get(claveFinal)
      if (existente) existente.claves.push(clave)
      else porNombre.set(claveFinal, { id: nuevoId(), nombre: nombreFinal, claves: [clave] })
    }
    return [...porNombre.values()]
  }, [textos, nombres])

  const resultado = useMemo(() => construirMigracion(dispositivos, grupos), [dispositivos, grupos])

  if (listo) return <Navigate to="/ubicaciones" replace />
  // Si no queda nada por migrar (todo ya vinculado), no tiene sentido la
  // pantalla: se vuelve a la lista.
  if (dispositivos.length > 0 && textos.length === 0) return <Navigate to="/ubicaciones" replace />

  async function aplicar() {
    setAplicando(true)
    // Primero las ubicaciones, luego los vinculos: asi el dispositivo
    // siempre apunta a una fila que ya existe localmente.
    for (const u of resultado.ubicaciones) {
      await guardarRegistro('ubicaciones', { id: u.id, nombre: u.nombre, padreId: null, notas: '' })
    }
    const porId = new Map(dispositivos.map((d) => [d.id, d]))
    for (const asignacion of resultado.asignaciones) {
      const d = porId.get(asignacion.dispositivoId)
      if (!d) continue
      // El spread pasa la ficha completa (guardarRegistro reescribe
      // updatedAt/updatedBy) fijando el id de la ubicacion y su nombre
      // como copia de referencia.
      await guardarRegistro('dispositivos', {
        ...d,
        ubicacionId: asignacion.ubicacionId,
        ubicacion: asignacion.nombre,
      })
    }
    setAplicando(false)
    setListo(true)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
      <header className="flex flex-col gap-2">
        <BotonVolver />
        <h1 className="text-xl font-semibold">Migrar ubicaciones de texto</h1>
        <p className="text-sm text-slate-400">
          Convierte los lugares escritos a mano en ubicaciones con ficha propia. Renombra para unir
          las variantes del mismo lugar (dos con el mismo nombre se fusionan). Deja el nombre en
          blanco para omitir un texto por ahora.
        </p>
      </header>

      {textos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          No hay textos de ubicación pendientes de migrar.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {textos.map((t) => (
            <li
              key={claveUbicacion(t.texto)}
              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{t.texto}</p>
                <p className="text-xs text-slate-500">
                  {t.cantidad} {t.cantidad === 1 ? 'equipo' : 'equipos'}
                </p>
              </div>
              <span className="shrink-0 text-slate-600">→</span>
              <input
                type="text"
                value={nombreDe(t.texto)}
                onChange={(e) =>
                  setNombres((actuales) => ({ ...actuales, [claveUbicacion(t.texto)]: e.target.value }))
                }
                aria-label={`Nombre final para ${t.texto}`}
                className={`w-2/5 shrink-0 ${CLASE_INPUT}`}
              />
            </li>
          ))}
        </ul>
      )}

      {textos.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
          <p className="text-sm text-slate-300">
            Se crearán <strong>{resultado.ubicaciones.length}</strong>{' '}
            {resultado.ubicaciones.length === 1 ? 'ubicación' : 'ubicaciones'} y se vincularán{' '}
            <strong>{resultado.asignaciones.length}</strong>{' '}
            {resultado.asignaciones.length === 1 ? 'equipo' : 'equipos'}.
          </p>
          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={aplicando || resultado.ubicaciones.length === 0}
            className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {aplicando ? 'Aplicando...' : 'Crear ubicaciones y vincular equipos'}
          </button>
          <p className="text-xs text-slate-500">
            Cada equipo conserva el texto como respaldo. Puedes volver a ejecutar esto más tarde con
            los que dejes pendientes.
          </p>
        </div>
      )}
    </div>
  )
}
