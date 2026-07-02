import { describe, expect, it } from 'vitest'
import { buscar, crearIndiceDesdeDocumentos, type DocumentoBusqueda } from './useIndiceBusqueda'

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
    ruta: '/dispositivos',
    texto: 'Cámara bodega norte Hikvision DS-2CD1023 Bodega norte 192.168.1.50',
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
})
