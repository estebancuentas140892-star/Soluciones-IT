import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../lib/db'
import { guardarRegistro, nuevoId } from '../../lib/repositorio'
import { ordenarPorRuta, mapaPorId, rutaUbicacion } from './arbol'

const CLASE_CAMPO =
  'rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500'

// Valores especiales del selector, distintos de cualquier id de ubicacion.
const TEXTO_LIBRE = '__texto__'
const NUEVA = '__nueva__'

// Selector de ubicacion (grupo N3): el dato canonico es `ubicacionId`;
// `ubicacion` (texto) es la copia de referencia. Deja elegir una
// ubicacion existente (entidad), escribir texto libre como respaldo
// (offline, o mientras no se migra) o crear una ubicacion nueva sin salir
// del formulario. `onChange` recibe siempre ambos: el id (o null) y el
// texto que se guardara como copia.
export function SelectorUbicacion({
  ubicacionId,
  ubicacion,
  onChange,
}: {
  ubicacionId: string | null
  ubicacion: string
  onChange: (ubicacionId: string | null, ubicacionTexto: string) => void
}) {
  const ubicaciones = useLiveQuery(() => db.ubicaciones.toArray(), [], [])
  const ordenadas = useMemo(() => ordenarPorRuta(ubicaciones), [ubicaciones])
  const porId = useMemo(() => mapaPorId(ubicaciones), [ubicaciones])
  const existeVinculada = ubicacionId ? porId.has(ubicacionId) : false

  const [creando, setCreando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [padreNueva, setPadreNueva] = useState('')
  const [guardandoNueva, setGuardandoNueva] = useState(false)

  // Valor actual del <select>: el id si esta vinculada a una fila que
  // existe; texto libre si hay copia sin id (o el id apunta a una fila
  // que ya no esta local); vacio si no hay nada.
  const valorSelect = existeVinculada
    ? (ubicacionId as string)
    : ubicacion.trim() !== '' || ubicacionId
      ? TEXTO_LIBRE
      : ''

  function alElegir(valor: string) {
    if (valor === '') {
      setCreando(false)
      onChange(null, '')
    } else if (valor === TEXTO_LIBRE) {
      setCreando(false)
      // Al pasar a texto libre se suelta el id; se conserva el texto.
      onChange(null, ubicacion)
    } else if (valor === NUEVA) {
      setCreando(true)
    } else {
      setCreando(false)
      const elegida = porId.get(valor)
      onChange(valor, elegida?.nombre ?? '')
    }
  }

  async function crear() {
    const nombre = nombreNueva.trim()
    if (nombre === '') return
    setGuardandoNueva(true)
    const id = nuevoId()
    await guardarRegistro('ubicaciones', {
      id,
      nombre,
      padreId: padreNueva || null,
      notas: '',
    })
    onChange(id, nombre)
    setCreando(false)
    setNombreNueva('')
    setPadreNueva('')
    setGuardandoNueva(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <select value={valorSelect} onChange={(e) => alElegir(e.target.value)} className={CLASE_CAMPO}>
        <option value="">Sin ubicación</option>
        {ordenadas.map((u) => (
          <option key={u.id} value={u.id}>
            {rutaUbicacion(u.id, porId)}
          </option>
        ))}
        <option value={TEXTO_LIBRE}>Otra (escribir manualmente)</option>
        <option value={NUEVA}>+ Crear ubicación nueva</option>
      </select>

      {valorSelect === TEXTO_LIBRE && !creando && (
        <input
          type="text"
          value={ubicacion}
          onChange={(e) => onChange(null, e.target.value)}
          placeholder="Escribe la ubicación"
          className={CLASE_CAMPO}
        />
      )}

      {creando && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
          <input
            type="text"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            placeholder="Nombre de la ubicación"
            className={CLASE_CAMPO}
            autoFocus
          />
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Dentro de (opcional)
            <select value={padreNueva} onChange={(e) => setPadreNueva(e.target.value)} className={CLASE_CAMPO}>
              <option value="">Ninguna (ubicación raíz)</option>
              {ordenadas.map((u) => (
                <option key={u.id} value={u.id}>
                  {rutaUbicacion(u.id, porId)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void crear()}
              disabled={guardandoNueva || nombreNueva.trim() === ''}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-50"
            >
              {guardandoNueva ? 'Creando...' : 'Crear y usar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreando(false)
                setNombreNueva('')
                setPadreNueva('')
              }}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <span className="text-xs text-slate-500">
        Elige un lugar registrado para conectarlo con su ficha, o escríbelo a mano.
      </span>
    </div>
  )
}
