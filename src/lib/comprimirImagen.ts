// Compresion de fotos antes de subirlas: reduce su peso para
// aprovechar mejor el 1 GB gratuito de Supabase Storage y para que
// la subida (que requiere conexion, ver ARQUITECTURA.md seccion 10)
// tome menos tiempo en una red movil.

// Lado mas largo permitido, en pixeles. Suficiente para ver detalle
// tecnico (una etiqueta, un puerto) en el telefono sin cargar fotos
// de camara a resolucion completa.
export const TAMANO_MAXIMO_LADO = 1600
export const CALIDAD_JPEG = 0.82
// Por debajo de este peso no vale la pena gastar CPU comprimiendo.
export const UMBRAL_OMITIR_BYTES = 300 * 1024

// SVG es vectorial (comprimirlo no tiene sentido) y GIF puede ser
// animado (recodificarlo como JPEG le quitaria la animacion).
const TIPOS_SIN_COMPRIMIR = new Set(['image/svg+xml', 'image/gif'])

type ArchivoComprimible = Pick<File, 'type' | 'size'>

// Separada de comprimirImagen para poder probarla sin depender del
// navegador (canvas, createImageBitmap).
export function debeComprimir(archivo: ArchivoComprimible): boolean {
  if (!archivo.type.startsWith('image/')) return false
  if (TIPOS_SIN_COMPRIMIR.has(archivo.type)) return false
  return archivo.size > UMBRAL_OMITIR_BYTES
}

export function calcularDimensiones(
  anchoOriginal: number,
  altoOriginal: number,
  ladoMaximo = TAMANO_MAXIMO_LADO,
): { ancho: number; alto: number } {
  const ladoMayor = Math.max(anchoOriginal, altoOriginal)
  if (ladoMayor <= ladoMaximo) return { ancho: anchoOriginal, alto: altoOriginal }
  const escala = ladoMaximo / ladoMayor
  return { ancho: Math.round(anchoOriginal * escala), alto: Math.round(altoOriginal * escala) }
}

// Redimensiona y recodifica una foto como JPEG antes de subirla. Si
// el archivo no conviene comprimirlo, si el navegador no puede
// decodificarlo (por ejemplo HEIC en algunos navegadores), o si el
// resultado no queda mas liviano, se sube el archivo original tal
// cual: la compresion nunca bloquea la subida de un adjunto.
export async function comprimirImagen(archivo: File): Promise<File> {
  if (!debeComprimir(archivo)) return archivo

  try {
    const bitmap = await createImageBitmap(archivo)
    const { ancho, alto } = calcularDimensiones(bitmap.width, bitmap.height)

    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const contexto = canvas.getContext('2d')
    if (!contexto) {
      bitmap.close()
      return archivo
    }
    contexto.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG),
    )
    if (!blob || blob.size >= archivo.size) return archivo

    const nombreComprimido = archivo.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], nombreComprimido, { type: 'image/jpeg', lastModified: archivo.lastModified })
  } catch {
    return archivo
  }
}
