import { db, type Adjunto } from '../../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId } from '../../lib/repositorio'
import { eliminarArchivoPendiente, referenciaEnUso } from '../../lib/archivosPendientes'
import { supabase } from '../../lib/supabase'
import { esFechaValida, fechaDeHoy } from '../personas/cicloPersona'

// Un documento, varios equipos (tarea 322, AD-086).
//
// No hay entidad "Documento": desde la tarea 123 el archivo existe una
// sola vez en Storage y su `referencia` es el hash del contenido
// (`compartidos/<sha256>`). Cada fila de `adjuntos` de un equipo es un
// VINCULO de ese documento con ese equipo, y el documento son todas las
// filas activas con la misma referencia. De ahi las dos clases de dato:
//   - del vinculo: `nota` (la pagina del acta o una nota de la relacion),
//     propia de cada equipo;
//   - del documento: `nombre`, `origen` y `fechaDocumento`, iguales en
//     todos sus vinculos (editarDocumento los mantiene asi).
// `origen` y `fechaDocumento` solo se anotan si estan confirmados: nunca
// se deducen del nombre del archivo ni de cuando se subio.

export interface DatosDocumento {
  nombre: string
  origen: string
  fechaDocumento: string | null
}

export interface DestinoVinculo {
  dispositivoId: string
  nota: string
}

/** Los vínculos activos de un documento con equipos, del más antiguo al más nuevo. */
export async function vinculosDelDocumento(referencia: string): Promise<Adjunto[]> {
  const filas = await db.adjuntos
    .where('referencia')
    .equals(referencia)
    .filter((a) => a.entidadTipo === 'dispositivo' && !a.eliminadoEn)
    .toArray()
  return filas.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
}

/**
 * El primer problema de los datos del documento, o null. El nombre es
 * obligatorio; la fecha, si se escribe, es una fecha real y no del
 * futuro (un acta todavía no firmada no tiene fecha confirmada).
 */
export function errorDeDocumento(datos: DatosDocumento, hoy: string = fechaDeHoy()): string | null {
  if (!datos.nombre.trim()) return 'Escribe el nombre del documento.'
  if (datos.fechaDocumento !== null) {
    if (!esFechaValida(datos.fechaDocumento)) return 'La fecha del documento no es válida.'
    if (datos.fechaDocumento > hoy) return 'La fecha del documento no puede ser posterior a hoy.'
  }
  return null
}

function limpiar(datos: DatosDocumento): DatosDocumento {
  return {
    nombre: datos.nombre.trim(),
    origen: datos.origen.trim(),
    fechaDocumento: datos.fechaDocumento || null,
  }
}

function difiereDelDocumento(adjunto: Adjunto, datos: DatosDocumento): boolean {
  return (
    adjunto.nombre !== datos.nombre ||
    adjunto.origen !== datos.origen ||
    adjunto.fechaDocumento !== datos.fechaDocumento
  )
}

/**
 * Guarda la nota de ESTE vínculo y los datos del documento en todos sus
 * vínculos con equipos, para que el mismo acta no diga dos nombres ni
 * dos fechas según la ficha desde la que se mire. Solo reescribe los
 * vínculos que de verdad cambian.
 */
export async function editarDocumento(adjunto: Adjunto, datos: DatosDocumento, nota: string): Promise<void> {
  const limpios = limpiar(datos)
  const error = errorDeDocumento(limpios)
  if (error) throw new Error(error)

  await guardarRegistro('adjuntos', { ...adjunto, ...limpios, nota: nota.trim() })
  for (const otro of await vinculosDelDocumento(adjunto.referencia)) {
    if (otro.id === adjunto.id || !difiereDelDocumento(otro, limpios)) continue
    await guardarRegistro('adjuntos', { ...otro, ...limpios })
  }
}

/**
 * Vincula el documento de `adjunto` a otros equipos: una fila nueva por
 * equipo, con la misma referencia (no se copia ningún byte) y su propia
 * nota. Un equipo que ya lo tiene no recibe un segundo vínculo. Devuelve
 * cuántos vínculos se crearon.
 */
export async function vincularDocumento(adjunto: Adjunto, destinos: DestinoVinculo[]): Promise<number> {
  const yaVinculados = new Set((await vinculosDelDocumento(adjunto.referencia)).map((a) => a.entidadId))
  let creados = 0
  for (const destino of destinos) {
    if (yaVinculados.has(destino.dispositivoId)) continue
    yaVinculados.add(destino.dispositivoId)
    await guardarRegistro('adjuntos', {
      id: nuevoId(),
      entidadTipo: 'dispositivo',
      entidadId: destino.dispositivoId,
      nombre: adjunto.nombre,
      tipo: adjunto.tipo,
      referencia: adjunto.referencia,
      nota: destino.nota.trim(),
      origen: adjunto.origen,
      fechaDocumento: adjunto.fechaDocumento,
    })
    creados += 1
  }
  return creados
}

/**
 * Quita un adjunto de su ficha. El archivo solo se borra (de la cola de
 * subida, de la copia offline y del bucket) cuando ya ninguna otra ficha
 * lo usa: con la deduplicación (tarea 123) y los vínculos (tarea 322) la
 * misma referencia puede seguir en otro equipo, en un artículo o en la
 * foto de un dispositivo.
 */
export async function quitarAdjunto(adjunto: Adjunto): Promise<void> {
  await eliminarRegistro('adjuntos', adjunto.id)
  if (await referenciaEnUso(adjunto.referencia)) return
  await eliminarArchivoPendiente(adjunto.referencia)
  if (supabase && navigator.onLine) {
    await supabase.storage.from('adjuntos').remove([adjunto.referencia])
  }
}

/** "En 1 equipo más", "En 3 equipos más". */
export function textoOtrosEquipos(cantidad: number): string {
  return cantidad === 1 ? 'En 1 equipo más' : `En ${cantidad} equipos más`
}

export interface AdjuntoNuevo {
  /** La ficha ya tiene ese archivo: no se crea otra fila. */
  yaEsta: boolean
  nombre: string
  origen: string
  fechaDocumento: string | null
}

/**
 * Lo que lleva un adjunto que se acaba de subir a una ficha. Si el mismo
 * archivo (misma referencia, deduplicación de la tarea 123) ya está en
 * ESA ficha, no se repite. Si un equipo sube un documento que ya está en
 * otro equipo, el vínculo nuevo toma el nombre, el origen y la fecha del
 * documento, para que no diga dos cosas distintas según la ficha (RN-075).
 */
export async function adjuntoNuevo(
  entidadTipo: Adjunto['entidadTipo'],
  entidadId: string,
  referencia: string,
  nombreArchivo: string,
): Promise<AdjuntoNuevo> {
  const conEsaReferencia = await db.adjuntos
    .where('referencia')
    .equals(referencia)
    .filter((a) => !a.eliminadoEn)
    .toArray()
  const yaEsta = conEsaReferencia.some((a) => a.entidadTipo === entidadTipo && a.entidadId === entidadId)
  const documento =
    entidadTipo === 'dispositivo'
      ? conEsaReferencia
          .filter((a) => a.entidadTipo === 'dispositivo')
          .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0]
      : undefined
  return {
    yaEsta,
    nombre: documento?.nombre ?? nombreArchivo,
    origen: documento?.origen ?? '',
    fechaDocumento: documento?.fechaDocumento ?? null,
  }
}
