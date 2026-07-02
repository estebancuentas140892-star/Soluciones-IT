import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ChangeEvent } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { db, type Adjunto } from '../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../lib/repositorio'
import { comprimirImagen } from '../lib/comprimirImagen'

interface Props {
  entidadTipo: Adjunto['entidadTipo']
  entidadId: string
}

const UNA_HORA = 60 * 60

export function Adjuntos({ entidadTipo, entidadId }: Props) {
  const adjuntos = useLiveQuery(
    () =>
      db.adjuntos
        .where('[entidadTipo+entidadId]')
        .equals([entidadTipo, entidadId])
        .filter((a) => !a.eliminadoEn)
        .toArray(),
    [entidadTipo, entidadId],
    [],
  )

  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function manejarSeleccion(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return

    setError(null)

    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }
    if (!navigator.onLine) {
      setError('Necesitas conexión a internet para adjuntar archivos. Vuelve a intentarlo con señal.')
      return
    }

    setSubiendo(true)
    try {
      // Las fotos pesadas se redimensionan y recomprimen en el propio
      // telefono antes de subirlas (ver src/lib/comprimirImagen.ts).
      // Si algo falla se sube el archivo original sin tocar.
      const archivoFinal = await comprimirImagen(archivo)
      const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const referencia = `${entidadTipo}s/${entidadId}/${Date.now()}-${nombreLimpio}`

      const { error: errorSubida } = await supabase.storage.from('adjuntos').upload(referencia, archivoFinal)
      if (errorSubida) throw errorSubida

      await guardarRegistro('adjuntos', {
        id: nuevoId(),
        entidadTipo,
        entidadId,
        nombre: archivoFinal.name,
        tipo: archivoFinal.type,
        referencia,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo.')
    } finally {
      setSubiendo(false)
    }
  }

  async function eliminar(adjunto: Adjunto) {
    if (!window.confirm(`¿Eliminar "${adjunto.nombre}"?`)) return
    await eliminarRegistro('adjuntos', adjunto.id)
    if (supabase) await supabase.storage.from('adjuntos').remove([adjunto.referencia])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-400">Adjuntos</h2>
        <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
          {subiendo ? 'Subiendo...' : '+ Agregar'}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={subiendo}
            onChange={manejarSeleccion}
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {adjuntos && adjuntos.length === 0 && <p className="text-xs text-slate-500">Sin adjuntos todavía</p>}

      <div className="grid grid-cols-2 gap-2">
        {adjuntos?.map((adjunto) => (
          <AdjuntoItem key={adjunto.id} adjunto={adjunto} onEliminar={() => void eliminar(adjunto)} />
        ))}
      </div>
    </div>
  )
}

function AdjuntoItem({ adjunto, onEliminar }: { adjunto: Adjunto; onEliminar: () => void }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    if (!supabase) return
    supabase.storage
      .from('adjuntos')
      .createSignedUrl(adjunto.referencia, UNA_HORA)
      .then(({ data }) => {
        if (vigente && data) setUrl(data.signedUrl)
      })
    return () => {
      vigente = false
    }
  }, [adjunto.referencia])

  const esImagen = adjunto.tipo.startsWith('image/')

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <button
        type="button"
        onClick={onEliminar}
        aria-label={`Eliminar ${adjunto.nombre}`}
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/80 text-xs text-slate-300"
      >
        ×
      </button>
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block">
        {esImagen && url ? (
          <img src={url} alt={adjunto.nombre} className="h-28 w-full object-cover" />
        ) : (
          <div className="flex h-28 items-center justify-center px-2 text-center text-xs text-slate-400">
            {adjunto.nombre}
          </div>
        )}
      </a>
    </div>
  )
}
