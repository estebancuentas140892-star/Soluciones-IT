import { decodificarBytes, parsearCsv } from './parsearCsv'

// Convierte el archivo elegido por el usuario (.xlsx, .xls o .csv) en
// una matriz de celdas de texto. SheetJS pesa bastante, así que se
// importa de forma diferida: quien importa un CSV nunca lo descarga.

export async function leerArchivoTabular(archivo: File): Promise<string[][]> {
  const nombre = archivo.name.toLowerCase()
  if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
    return leerExcel(await archivo.arrayBuffer())
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  return parsearCsv(decodificarBytes(bytes))
}

export async function leerExcel(contenido: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx')
  const libro = XLSX.read(contenido, { type: 'array' })

  // Se usa la primera hoja que tenga algo; los libros de Excel suelen
  // traer hojas vacías de más.
  for (const nombreHoja of libro.SheetNames) {
    const hoja = libro.Sheets[nombreHoja]
    // header: 1 entrega la matriz cruda; raw: false usa el texto
    // formateado de cada celda (así las fechas no llegan como el
    // número de serie interno de Excel).
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: false, defval: '' })
    const matriz = filas.map((fila) => fila.map((celda) => String(celda ?? '')))
    if (matriz.some((fila) => fila.some((celda) => celda.trim() !== ''))) return matriz
  }
  return []
}
