import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ChangeEvent } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { db, type Adjunto } from '../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../lib/repositorio'
import { comprimirImagen } from '../lib/comprimirImagen'
import { eliminarArchivoPendiente, referenciaEnUso, subirConDeduplicacion } from '../lib/archivosPendientes'
import { DialogoEliminar } from './DialogoEliminar'
import { useUrlAdjunto } from './useUrlAdjunto'
import { VisorImagen } from './VisorImagen'

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
  const [aEliminar, setAEliminar] = useState<Adjunto | null>(null)
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
    let reutilizados = 0
    for (let i = 0; i < archivos.length; i++) {
      setProgreso(archivos.length > 1 ? `Subiendo ${i + 1} de ${archivos.length}...` : 'Subiendo...')
      try {
        // Las fotos pesadas se redimensionan y recomprimen en el propio
        // telefono antes de subirlas (ver src/lib/comprimirImagen.ts).
        // Si algo falla se sube el archivo original sin tocar.
        const archivoFinal = await comprimirImagen(archivos[i])

        // Deduplicacion por hash (tarea 123): si el contenido ya existe
        // (subido por este u otro tecnico), se reutiliza su referencia
        // en vez de subirlo de nuevo. Sin conexion, se encola igual que
        // antes: la cola de sincronizacion lo sube sola al recuperar
        // señal.
        const { referencia, resultado, reutilizado } = await subirConDeduplicacion(archivoFinal, archivoFinal.name)
        if (resultado === 'encolado') encolados += 1
        if (reutilizado) reutilizados += 1

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
    } else if (reutilizados > 0) {
      setAviso(
        reutilizados === 1
          ? 'Ese archivo ya existía: se reutilizó sin subir contenido nuevo.'
          : `${reutilizados} archivos ya existían: se reutilizaron sin subir contenido nuevo.`,
      )
    }
    setProgreso(null)
  }

  async function confirmarEliminar() {
    const adjunto = aEliminar
    if (!adjunto) return
    await eliminarRegistro('adjuntos', adjunto.id)
    // Con deduplicacion (tarea 123) la misma referencia puede seguir
    // en uso desde otra ficha (otro adjunto, o la foto de un
    // dispositivo): en ese caso no se toca ni la cola ni el archivo en
    // Storage, que la otra ficha todavia necesita.
    if (await referenciaEnUso(adjunto.referencia)) {
      setAEliminar(null)
      return
    }
    // Si el archivo seguia en la cola de subida, ya no hay que subirlo;
    // tambien se libera su copia offline.
    await eliminarArchivoPendiente(adjunto.referencia)
    if (supabase && navigator.onLine) {
      await supabase.storage.from('adjuntos').remove([adjunto.referencia])
    }
    setAEliminar(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-noct-neutral-400">Adjuntos</h2>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-lg border border-noct-divider px-3 py-1.5 text-xs text-noct-text hover:bg-noct-text/[.07]">
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
            <label className="cursor-pointer rounded-lg border border-noct-divider px-3 py-1.5 text-xs text-noct-text hover:bg-noct-text/[.07]">
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

      {error && <p className="text-xs text-noct-error">{error}</p>}
      {aviso && <p className="text-xs text-noct-precaucion">{aviso}</p>}

      {adjuntos && adjuntos.length === 0 && <p className="text-xs text-noct-neutral-500">Sin adjuntos todavía</p>}

      <div className="grid grid-cols-2 gap-2">
        {adjuntos?.map((adjunto) => (
          <AdjuntoItem key={adjunto.id} adjunto={adjunto} onEliminar={() => setAEliminar(adjunto)} />
        ))}
      </div>

      <DialogoEliminar
        abierto={aEliminar !== null}
        titulo={`¿Eliminar "${aEliminar?.nombre ?? ''}"?`}
        descripcion="El archivo se quitará de esta ficha."
        onCerrar={() => setAEliminar(null)}
        onConfirmar={confirmarEliminar}
      />
    </div>
  )
}

function AdjuntoItem({ adjunto, onEliminar }: { adjunto: Adjunto; onEliminar: () => void }) {
  const url = useUrlAdjunto(adjunto.referencia)
  const esImagen = adjunto.tipo.startsWith('image/')
  const [visorAbierto, setVisorAbierto] = useState(false)

  return (
    <div className="relative overflow-hidden rounded-xl border border-noct-divider bg-noct-surface">
      <button
        type="button"
        onClick={onEliminar}
        aria-label={`Eliminar ${adjunto.nombre}`}
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-noct-bg/80 text-xs text-noct-text"
      >
        ×
      </button>
      {esImagen && url ? (
        <button type="button" onClick={() => setVisorAbierto(true)} className="block">
          <img src={url} alt={adjunto.nombre} className="h-28 w-full object-cover" />
        </button>
      ) : (
        <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block">
          <div className="flex h-28 items-center justify-center px-2 text-center text-xs text-noct-neutral-400">
            {adjunto.nombre}
          </div>
        </a>
      )}
      {esImagen && url && visorAbierto && (
        <VisorImagen url={url} alt={adjunto.nombre} onCerrar={() => setVisorAbierto(false)} />
      )}
    </div>
  )
}
