import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ChangeEvent } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { db, type Adjunto } from '../lib/db'
import { guardarRegistro, nuevoId } from '../lib/repositorio'
import { comprimirImagen } from '../lib/comprimirImagen'
import { subirConDeduplicacion } from '../lib/archivosPendientes'
import { adjuntoNuevo, quitarAdjunto, textoOtrosEquipos } from '../features/documentos/documentosEquipo'
import { DialogoEliminar } from './DialogoEliminar'
import { useUrlAdjunto } from './useUrlAdjunto'
import { ImagenAmpliable } from './VisorImagen'

interface Props {
  entidadTipo: Adjunto['entidadTipo']
  entidadId: string
  /**
   * El bloque va dentro de una `SeccionPlegable` que ya escribe el
   * rótulo y su conteo (ficha de equipo, M-014). Los dos botones de
   * subida se conservan, alineados a la derecha.
   */
  sinCabecera?: boolean
  /**
   * Ficha de equipo (tarea 322): cada adjunto es un documento que puede
   * estar vinculado a otros equipos. Con esta función el adjunto entero
   * se toca para abrir su pantalla (ver, editar, vincular, quitar), y la
   * tarjeta dice su nota y en cuántos equipos más está. Sin ella, la
   * galería de siempre (artículos e intervenciones).
   */
  alAbrir?: (adjunto: Adjunto) => void
}

// Las dos puertas de subida: 44 px de alto y 14 px de texto, como el
// resto de verbos del rediseño móvil (tarea 322; antes 29 px y 12 px).
const CLASE_SUBIR =
  'inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-noct-divider px-3.5 text-[14px] text-noct-text hover:bg-noct-text/[.07]'

export function Adjuntos({ entidadTipo, entidadId, sinCabecera = false, alAbrir }: Props) {
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

  // En cuántos equipos MÁS está cada documento (misma referencia).
  const referencias = (adjuntos ?? []).map((a) => a.referencia)
  const otrosEquipos = useLiveQuery(
    async () => {
      const conteo = new Map<string, number>()
      if (!alAbrir || referencias.length === 0) return conteo
      const vinculos = await db.adjuntos.where('referencia').anyOf(referencias).toArray()
      for (const v of vinculos) {
        if (v.eliminadoEn || v.entidadTipo !== 'dispositivo' || v.entidadId === entidadId) continue
        conteo.set(v.referencia, (conteo.get(v.referencia) ?? 0) + 1)
      }
      return conteo
    },
    [Boolean(alAbrir), entidadId, referencias.join('|')],
    new Map<string, number>(),
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
    let yaEstaban = 0
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
        // Tarea 322: el mismo archivo no se repite en una ficha, y en un
        // equipo toma los datos del documento si ya está en otro.
        const nuevo = await adjuntoNuevo(entidadTipo, entidadId, referencia, archivoFinal.name)
        if (nuevo.yaEsta) {
          yaEstaban += 1
          continue
        }
        if (resultado === 'encolado') encolados += 1
        if (reutilizado) reutilizados += 1

        await guardarRegistro('adjuntos', {
          id: nuevoId(),
          entidadTipo,
          entidadId,
          nombre: nuevo.nombre,
          tipo: archivoFinal.type,
          referencia,
          nota: '',
          origen: nuevo.origen,
          fechaDocumento: nuevo.fechaDocumento,
        })
      } catch {
        fallidos.push(archivos[i].name)
      }
    }

    if (fallidos.length > 0) setError(`No se pudo subir: ${fallidos.join(', ')}`)
    if (yaEstaban > 0 && encolados === 0 && reutilizados === 0) {
      setAviso(yaEstaban === 1 ? 'Ese archivo ya está en esta ficha.' : `${yaEstaban} archivos ya estaban en esta ficha.`)
    } else if (encolados > 0) {
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
    // El archivo solo se borra si ya ninguna otra ficha lo usa
    // (deduplicacion de la tarea 123, vinculos de la 322).
    await quitarAdjunto(adjunto)
    setAEliminar(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-2 ${sinCabecera ? 'justify-end' : 'justify-between'}`}>
        {!sinCabecera && <h2 className="text-sm font-medium text-noct-neutral-400">Adjuntos</h2>}
        <div className="flex gap-2">
          <label className={CLASE_SUBIR}>
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
            <label className={CLASE_SUBIR}>
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
        {adjuntos?.map((adjunto) =>
          alAbrir ? (
            <DocumentoItem
              key={adjunto.id}
              adjunto={adjunto}
              otrosEquipos={otrosEquipos.get(adjunto.referencia) ?? 0}
              onAbrir={() => alAbrir(adjunto)}
            />
          ) : (
            <AdjuntoItem key={adjunto.id} adjunto={adjunto} onEliminar={() => setAEliminar(adjunto)} />
          ),
        )}
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
        // Adjunto heredado que es una imagen: se amplía como cualquier
        // otra imagen de una guía, y lo dice (encargo del 2026-09-10,
        // tarea 3). Antes se podía tocar, pero nada lo anunciaba.
        <ImagenAmpliable
          url={url}
          alt={adjunto.nombre}
          pie={adjunto.nombre}
          etiqueta="Ampliar"
          claseBoton="rounded-none"
          className="h-28 w-full object-cover"
        />
      ) : (
        <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block">
          <div className="flex h-28 items-center justify-center px-2 text-center text-xs text-noct-neutral-400">
            {adjunto.nombre}
          </div>
        </a>
      )}
    </div>
  )
}

// Tarjeta de un documento de la ficha de un equipo (tarea 322): toda la
// tarjeta abre su pantalla; ahí se amplía, se edita, se vincula o se
// quita. Debajo de la miniatura, el nombre, la nota de este equipo y en
// cuántos equipos más está.
function DocumentoItem({
  adjunto,
  otrosEquipos,
  onAbrir,
}: {
  adjunto: Adjunto
  otrosEquipos: number
  onAbrir: () => void
}) {
  const url = useUrlAdjunto(adjunto.referencia)
  const esImagen = adjunto.tipo.startsWith('image/')

  // El nombre accesible es lo que dice la tarjeta, sin la extensión que
  // hace de miniatura: "acta.pdf, Página 3, En 1 equipo más".
  const nombreAccesible = [adjunto.nombre, adjunto.nota, otrosEquipos > 0 ? textoOtrosEquipos(otrosEquipos) : '']
    .filter(Boolean)
    .join(', ')

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={nombreAccesible}
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-noct-divider bg-noct-surface text-left hover:bg-noct-text/[.04]"
    >
      {esImagen && url ? (
        <img src={url} alt="" className="h-24 w-full object-cover" />
      ) : (
        <div aria-hidden className="flex h-24 w-full items-center justify-center bg-noct-text/[.03] px-2 text-[12px] uppercase tracking-wide text-noct-neutral-500">
          {extension(adjunto.nombre, adjunto.tipo)}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
        {/* Sin recorte (regla 23): dos actas se distinguen a veces solo por el final del nombre. */}
        <span className="text-[13px] leading-snug text-noct-text [overflow-wrap:anywhere]">{adjunto.nombre}</span>
        {adjunto.nota && <span className="text-[12px] leading-snug text-noct-neutral-400 [overflow-wrap:anywhere]">{adjunto.nota}</span>}
        {otrosEquipos > 0 && <span className="text-[12px] leading-snug text-noct-accent-300">{textoOtrosEquipos(otrosEquipos)}</span>}
      </div>
    </button>
  )
}

// "PDF", "JPG"... para la tarjeta de un documento sin miniatura.
function extension(nombre: string, tipo: string): string {
  const punto = nombre.lastIndexOf('.')
  if (punto > 0 && punto < nombre.length - 1) return nombre.slice(punto + 1).slice(0, 5)
  if (tipo === 'application/pdf') return 'pdf'
  return 'Archivo'
}
