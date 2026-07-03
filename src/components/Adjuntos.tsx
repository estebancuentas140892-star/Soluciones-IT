import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ChangeEvent } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { db, type Adjunto } from '../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../lib/repositorio'
import { comprimirImagen } from '../lib/comprimirImagen'
import { eliminarArchivoPendiente, subirOEncolarArchivo } from '../lib/archivosPendientes'
import { useUrlAdjunto } from './useUrlAdjunto'

interface Props {
  entidadTipo: Adjunto['entidadTipo']
  entidadId: string
}

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

  const [progreso, setProgreso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const subiendo = progreso !== null

  function manejarSeleccion(evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''
    if (archivos.length > 0) void subirArchivos(archivos)
  }

  async function subirArchivos(archivos: File[]) {
    setError(null)
    setAviso(null)

    if (!supabase || !supabaseConfigured) {
      setError('La aplicación aún no está conectada al servidor.')
      return
    }

    const fallidos: string[] = []
    let encolados = 0
    for (let i = 0; i < archivos.length; i++) {
      setProgreso(archivos.length > 1 ? `Subiendo ${i + 1} de ${archivos.length}...` : 'Subiendo...')
      try {
        // Las fotos pesadas se redimensionan y recomprimen en el propio
        // telefono antes de subirlas (ver src/lib/comprimirImagen.ts).
        // Si algo falla se sube el archivo original sin tocar.
        const archivoFinal = await comprimirImagen(archivos[i])
        const nombreLimpio = archivoFinal.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
        const referencia = `${entidadTipo}s/${entidadId}/${Date.now()}-${nombreLimpio}`

        // Sin conexion, el archivo queda en el telefono y la cola de
        // sincronizacion lo sube sola al recuperar señal.
        const resultado = await subirOEncolarArchivo(referencia, archivoFinal, archivoFinal.name)
        if (resultado === 'encolado') encolados += 1

        await guardarRegistro('adjuntos', {
          id: nuevoId(),
          entidadTipo,
          entidadId,
          nombre: archivoFinal.name,
          tipo: archivoFinal.type,
          referencia,
        })
      } catch {
        fallidos.push(archivos[i].name)
      }
    }

    if (fallidos.length > 0) setError(`No se pudo subir: ${fallidos.join(', ')}`)
    if (encolados > 0) {
      setAviso(
        encolados === 1
          ? 'Sin conexión: el archivo quedó guardado en este dispositivo y se subirá solo al recuperar señal.'
          : `Sin conexión: ${encolados} archivos quedaron guardados en este dispositivo y se subirán solos al recuperar señal.`,
      )
    }
    setProgreso(null)
  }

  async function eliminar(adjunto: Adjunto) {
    if (!window.confirm(`¿Eliminar "${adjunto.nombre}"?`)) return
    await eliminarRegistro('adjuntos', adjunto.id)
    // Si el archivo seguia en la cola de subida, ya no hay que subirlo;
    // tambien se libera su copia offline.
    await eliminarArchivoPendiente(adjunto.referencia)
    if (supabase && navigator.onLine) {
      await supabase.storage.from('adjuntos').remove([adjunto.referencia])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-400">Adjuntos</h2>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
            {subiendo ? progreso : 'Cámara'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={subiendo}
              onChange={manejarSeleccion}
            />
          </label>
          {!subiendo && (
            <label className="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
              + Archivos
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                disabled={subiendo}
                onChange={manejarSeleccion}
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {aviso && <p className="text-xs text-amber-300">{aviso}</p>}

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
  const url = useUrlAdjunto(adjunto.referencia)
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
