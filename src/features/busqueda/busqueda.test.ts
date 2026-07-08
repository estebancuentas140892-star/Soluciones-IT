import { describe, expect, it } from 'vitest'
import {
  buscar,
  buscarArticulosSimilares,
  crearIndiceDesdeDocumentos,
  type DocumentoBusqueda,
} from './useIndiceBusqueda'

const documentos: DocumentoBusqueda[] = [
  {
    id: 'articulo:1',
    tipo: 'articulo',
    titulo: 'Ticket de soporte para POS Verifone',
    subtitulo: 'POS · Problemas frecuentes',
    ruta: '/soluciones/cat-1/1',
    texto:
      'Ticket de soporte para POS Verifone. La impresora térmica Zebra conectada al POS puede fallar si el cable USB está flojo.',
  },
  {
    id: 'articulo:2',
    tipo: 'articulo',
    titulo: 'Configurar impresora Epson TM-T88',
    subtitulo: 'Impresoras · Configuración',
    ruta: '/soluciones/cat-1/2',
    texto: 'Configurar impresora Epson TM-T88 puerto serial',
  },
  {
    id: 'articulo:3',
    tipo: 'articulo',
    titulo: 'Reinicio de switch de red',
    subtitulo: 'Switches · Mantenimiento',
    ruta: '/soluciones/cat-2/3',
    texto: 'Reinicio de switch de red procedimiento estándar',
  },
  {
    id: 'dispositivo:1',
    tipo: 'dispositivo',
    titulo: 'Cámara bodega norte',
    subtitulo: 'Hikvision · DS-2CD1023 · Bodega norte',
    ruta: '/dispositivos/1',
    texto: 'Cámara bodega norte Hikvision DS-2CD1023 Bodega norte 192.168.1.50',
  },
  {
    id: 'articulo:5',
    tipo: 'articulo',
    titulo: 'Crear copia de seguridad del SQL Server',
    subtitulo: 'Servidores · Mantenimiento',
    ruta: '/soluciones/cat-3/5',
    texto: 'Crear copia de seguridad del SQL Server con SQL Server Management Studio',
  },
]

const indice = crearIndiceDesdeDocumentos(documentos)

describe('buscar', () => {
  it('encuentra por una marca mencionada en el contenido, aunque no esté en el título', () => {
    const resultados = buscar(indice, 'zebra')
    expect(resultados.map((r) => r.id)).toContain('articulo:1')
  })

  it('tolera errores de escritura (fuzzy)', () => {
    const resultados = buscar(indice, 'epsom')
    expect(resultados.map((r) => r.id)).toContain('articulo:2')
  })

  it('busca por prefijo mientras se escribe', () => {
    const resultados = buscar(indice, 'impre')
    const ids = resultados.map((r) => r.id)
    expect(ids).toContain('articulo:1')
    expect(ids).toContain('articulo:2')
  })

  it('encuentra dispositivos por marca y ubicación', () => {
    const porMarca = buscar(indice, 'hikvision')
    expect(porMarca.map((r) => r.id)).toContain('dispositivo:1')

    const porUbicacion = buscar(indice, 'bodega')
    expect(porUbicacion.map((r) => r.id)).toContain('dispositivo:1')
  })

  it('prioriza las coincidencias en el título sobre las del contenido', () => {
    const resultados = buscar(indice, 'impresora')
    const posicionTitulo = resultados.findIndex((r) => r.id === 'articulo:2')
    const posicionContenido = resultados.findIndex((r) => r.id === 'articulo:1')
    expect(posicionTitulo).toBeGreaterThanOrEqual(0)
    expect(posicionContenido).toBeGreaterThanOrEqual(0)
    expect(posicionTitulo).toBeLessThan(posicionContenido)
  })

  it('no devuelve nada para una consulta vacía', () => {
    expect(buscar(indice, '   ')).toEqual([])
  })

  it('no mezcla resultados de una categoría con otra sin relación', () => {
    const resultados = buscar(indice, 'switch')
    expect(resultados.map((r) => r.id)).toEqual(['articulo:3'])
  })

  it('encuentra por sinónimo: "backup" halla la copia de seguridad', () => {
    const resultados = buscar(indice, 'backup')
    expect(resultados.map((r) => r.id)).toContain('articulo:5')
  })

  it('encuentra por sinónimo: "internet" halla los artículos de red', () => {
    const resultados = buscar(indice, 'internet')
    expect(resultados.map((r) => r.id)).toContain('articulo:3')
  })
})

describe('buscarArticulosSimilares', () => {
  it('sugiere artículos con título parecido, excluyendo el propio', () => {
    const similares = buscarArticulosSimilares(indice, 'Configurar impresora Epson', 'nuevo-id')
    expect(similares.map((r) => r.id)).toContain('articulo:2')

    const sinElPropio = buscarArticulosSimilares(indice, 'Configurar impresora Epson', '2')
    expect(sinElPropio.map((r) => r.id)).not.toContain('articulo:2')
  })

  it('ignora coincidencias que solo están en el contenido, no en el título', () => {
    // "zebra" y "flojo" solo aparecen en el texto del articulo:1.
    const similares = buscarArticulosSimilares(indice, 'zebra flojo', 'nuevo-id')
    expect(similares.map((r) => r.id)).not.toContain('articulo:1')
  })

  it('no sugiere nada con títulos muy cortos ni devuelve dispositivos', () => {
    expect(buscarArticulosSimilares(indice, 'cá', 'nuevo-id')).toEqual([])
    const similares = buscarArticulosSimilares(indice, 'Cámara bodega', 'nuevo-id')
    expect(similares.every((r) => r.tipo === 'articulo')).toBe(true)
  })
})
