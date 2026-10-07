import type { BloquePaso, PasoAdjunto, ResultadoVisual } from './db'
import { texto } from './texto'

// "DEBES VER" COMO IMAGEN DEL RESULTADO (tarea 307, AD-068).
//
// La persona nueva no gana mucho con leer "Debes ver: se abre la ventana
// Importar y exportar" si nunca ha visto esa ventana. Lo que sí la orienta
// es VERLA. Por eso "Debes ver" deja de ser un texto del paso (`resultado`,
// obsoleto) y pasa a ser la imagen de cómo debe quedar la pantalla cuando
// UNA acción salió bien: `BloquePaso.resultadoVisual`.
//
//   - Es de la acción, como su "Cómo hacerlo": una pantalla es una acción y
//     su resultado es lo que se ve al terminarla. Como mucho una imagen por
//     acción, nunca una por microacción.
//   - Solo en tareas de acción o de comprobación. Una decisión se responde y
//     su resultado es el camino que abre, no una pantalla que mirar.
//   - La relación es explícita: una imagen es el resultado porque alguien la
//     puso ahí. Nunca se deduce por su posición ni se convierte sola una
//     imagen intercalada en el paso.
//   - Sin imagen no hay "Debes ver": no se rellena el hueco con texto.
//
// Reutiliza el adjunto de siempre (`PasoAdjunto`), así que la subida, la
// cola sin conexión, la copia para usar sin red y el visor que amplía son
// los mismos que los de cualquier imagen de un paso.

/** El nombre visible del campo, en la ejecución y en el editor. */
export const ROTULO_DEBES_VER = 'Debes ver'

/** ¿Este bloque admite la imagen de "Debes ver"? Una tarea de acción o de comprobación. */
export function admiteResultadoVisual(bloque: Pick<BloquePaso, 'tipo' | 'tipoTarea'>): boolean {
  return bloque.tipo === 'tarea' && (bloque.tipoTarea ?? 'accion') !== 'decision'
}

// ¿Es una imagen? Lo que no lo es (un PDF, un tipo vacío) no se puede
// mirar como resultado, así que no vale.
function esImagen(adjunto: Pick<PasoAdjunto, 'tipo'>): boolean {
  return adjunto.tipo.startsWith('image/')
}

/**
 * La imagen de "Debes ver" tal como llega del JSON, tolerada: lo que no es
 * un objeto, un adjunto sin referencia o algo que no es una imagen se
 * descarta (null), igual que una imagen intercalada sin adjunto. La
 * descripción vacía no se conserva.
 */
export function normalizarResultadoVisual(valor: unknown): ResultadoVisual | null {
  if (!valor || typeof valor !== 'object') return null
  const origen = valor as Record<string, unknown>
  const crudo = origen.adjunto
  if (!crudo || typeof crudo !== 'object') return null
  const datos = crudo as Record<string, unknown>
  const referencia = texto(datos.referencia)
  if (referencia.trim() === '') return null
  const adjunto: PasoAdjunto = {
    referencia,
    nombre: texto(datos.nombre) || (referencia.split('/').pop() ?? referencia),
    tipo: texto(datos.tipo),
  }
  if (!esImagen(adjunto)) return null
  const descripcion = texto(origen.descripcion)
  return { adjunto, ...(descripcion.trim() !== '' ? { descripcion } : {}) }
}

/**
 * LA IMAGEN DE "DEBES VER" DE UNA TAREA, lista para enseñar y para guardar:
 * con la descripción recortada (o sin ella), o null si no tiene, si no es
 * una imagen o si el bloque no la admite. Toda vista la lee de aquí y el
 * guardado guarda exactamente esto.
 */
export function resultadoVisualDe(bloque: BloquePaso): ResultadoVisual | null {
  if (!admiteResultadoVisual(bloque) || !bloque.resultadoVisual) return null
  const { adjunto, descripcion } = bloque.resultadoVisual
  if (adjunto.referencia.trim() === '' || !esImagen(adjunto)) return null
  const limpia = descripcion?.trim() ?? ''
  return { adjunto: { ...adjunto }, ...(limpia !== '' ? { descripcion: limpia } : {}) }
}
