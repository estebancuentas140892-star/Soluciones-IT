import { describe, expect, it } from 'vitest'
import {
  buscar,
  buscarArticulosSimilares,
  buscarSimilares,
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
  {
    id: 'categoria:cat-1',
    tipo: 'categoria',
    titulo: 'Impresoras',
    subtitulo: 'Categoría',
    ruta: '/soluciones/cat-1',
    texto: 'Impresoras',
  },
  {
    id: 'adjunto:manual-zebra',
    tipo: 'adjunto',
    titulo: 'manual_zebra.pdf',
    subtitulo: 'Configurar impresora Epson TM-T88 · Paso 1',
    ruta: '/soluciones/cat-1/2',
    texto: 'manual_zebra.pdf',
  },
  {
    id: 'ubicacion:sala-servidores',
    tipo: 'ubicacion',
    titulo: 'Sala de servidores',
    subtitulo: 'Sede Norte',
    ruta: '/ubicaciones/sala-servidores',
    texto: 'Sala de servidores acceso restringido con llave',
  },
  {
    id: 'persona:juan-perez',
    tipo: 'persona',
    titulo: 'Juan Pérez',
    subtitulo: 'Persona',
    ruta: '/personas/juan-perez',
    texto: 'Juan Pérez contador',
  },
  {
    id: 'diagnostico:d1',
    tipo: 'diagnostico',
    titulo: 'La impresora no imprime',
    subtitulo: 'Impresoras · Diagnóstico',
    ruta: '/diagnostico/d1',
    texto: 'La impresora no imprime revisar spooler y cable',
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

  it('ofrece la categoría además de sus artículos (fase N2)', () => {
    const resultados = buscar(indice, 'impresoras')
    const categoria = resultados.find((r) => r.id === 'categoria:cat-1')
    expect(categoria).toBeDefined()
    expect(categoria?.tipo).toBe('categoria')
  })

  it('encuentra un adjunto por su nombre de archivo (fase N2)', () => {
    const resultados = buscar(indice, 'manual_zebra')
    expect(resultados.map((r) => r.id)).toContain('adjunto:manual-zebra')
    expect(resultados.find((r) => r.id === 'adjunto:manual-zebra')?.tipo).toBe('adjunto')
  })

  it('encuentra una ubicación por su nombre (fase P3)', () => {
    const resultados = buscar(indice, 'sala de servidores')
    const ubicacion = resultados.find((r) => r.id === 'ubicacion:sala-servidores')
    expect(ubicacion).toBeDefined()
    expect(ubicacion?.tipo).toBe('ubicacion')
    expect(ubicacion?.subtitulo).toBe('Sede Norte')
  })

  it('encuentra una persona por su nombre (hallazgo T1)', () => {
    const resultados = buscar(indice, 'juan perez')
    const persona = resultados.find((r) => r.id === 'persona:juan-perez')
    expect(persona).toBeDefined()
    expect(persona?.tipo).toBe('persona')
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

// Hallazgo K5 de AUDITORIA_FLUJOS_TI.md: un problema_frecuente y un
// diagnostico del mismo problema son dos entradas al mismo
// conocimiento; `buscarSimilares` generaliza el aviso de duplicado
// para cruzarlas, en vez de comparar solo artículos con artículos.
describe('buscarSimilares', () => {
  it('cruza artículos y diagnósticos cuando se piden ambos tipos', () => {
    const similares = buscarSimilares(indice, 'La impresora no imprime', 'nuevo-id', ['articulo', 'diagnostico'])
    expect(similares.map((r) => r.id)).toContain('diagnostico:d1')
  })

  it('respeta la lista de tipos: pedir solo diagnóstico excluye artículos parecidos', () => {
    const similares = buscarSimilares(indice, 'Reinicio de switch de red', 'nuevo-id', ['diagnostico'])
    expect(similares).toEqual([])
  })

  it('al editar, excluye el propio diagnóstico de sus resultados', () => {
    const similares = buscarSimilares(indice, 'La impresora no imprime', 'd1', ['articulo', 'diagnostico'])
    expect(similares.map((r) => r.id)).not.toContain('diagnostico:d1')
  })

  it('buscarArticulosSimilares sigue siendo equivalente a pedir solo artículos', () => {
    const general = buscarSimilares(indice, 'Configurar impresora Epson', 'nuevo-id', ['articulo'])
    const especifico = buscarArticulosSimilares(indice, 'Configurar impresora Epson', 'nuevo-id')
    expect(especifico).toEqual(general)
  })
})
