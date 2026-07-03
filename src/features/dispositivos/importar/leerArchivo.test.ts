import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { leerExcel } from './leerArchivo'

// leerExcel recibe el ArrayBuffer directamente, así la prueba no
// depende de la API File del navegador.

function libroComoArrayBuffer(hojas: Record<string, unknown[][]>): ArrayBuffer {
  const libro = XLSX.utils.book_new()
  for (const [nombre, filas] of Object.entries(hojas)) {
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), nombre)
  }
  const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return bytes
}

describe('leerExcel', () => {
  it('convierte la hoja en una matriz de textos, rellenando celdas vacías', async () => {
    const contenido = libroComoArrayBuffer({
      Inventario: [
        ['Nombre', 'Categoría', 'Serial'],
        ['POS caja 1', 'POS', 12345],
        ['Cámara bodega', 'Cámaras'],
      ],
    })
    expect(await leerExcel(contenido)).toEqual([
      ['Nombre', 'Categoría', 'Serial'],
      ['POS caja 1', 'POS', '12345'],
      ['Cámara bodega', 'Cámaras', ''],
    ])
  })

  it('salta las hojas vacías y usa la primera con contenido', async () => {
    const contenido = libroComoArrayBuffer({
      Hoja1: [[]],
      Datos: [
        ['Nombre'],
        ['POS caja 1'],
      ],
    })
    expect(await leerExcel(contenido)).toEqual([['Nombre'], ['POS caja 1']])
  })

  it('devuelve una matriz vacía si el libro no tiene datos', async () => {
    const contenido = libroComoArrayBuffer({ Hoja1: [[]] })
    expect(await leerExcel(contenido)).toEqual([])
  })
})
