import { describe, expect, it } from 'vitest'
import { calcularDimensiones, debeComprimir, TAMANO_MAXIMO_LADO, UMBRAL_OMITIR_BYTES } from './comprimirImagen'

describe('debeComprimir', () => {
  it('omite archivos que no son imágenes', () => {
    expect(debeComprimir({ type: 'application/pdf', size: 5_000_000 })).toBe(false)
  })

  it('omite imágenes que ya son livianas', () => {
    expect(debeComprimir({ type: 'image/jpeg', size: 100_000 })).toBe(false)
  })

  it('omite SVG (vectorial) y GIF (podría ser animado)', () => {
    expect(debeComprimir({ type: 'image/svg+xml', size: 1_000_000 })).toBe(false)
    expect(debeComprimir({ type: 'image/gif', size: 1_000_000 })).toBe(false)
  })

  it('comprime fotos pesadas en formatos rasterizados', () => {
    expect(debeComprimir({ type: 'image/jpeg', size: 5_000_000 })).toBe(true)
    expect(debeComprimir({ type: 'image/png', size: 1_000_000 })).toBe(true)
  })

  it('el límite es justo el umbral (no se comprime lo que pesa exactamente el umbral)', () => {
    expect(debeComprimir({ type: 'image/jpeg', size: UMBRAL_OMITIR_BYTES })).toBe(false)
    expect(debeComprimir({ type: 'image/jpeg', size: UMBRAL_OMITIR_BYTES + 1 })).toBe(true)
  })
})

describe('calcularDimensiones', () => {
  it('no cambia una imagen que ya cabe en el lado máximo', () => {
    expect(calcularDimensiones(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('reduce el lado más largo al máximo manteniendo la proporción (horizontal)', () => {
    const { ancho, alto } = calcularDimensiones(4032, 3024)
    expect(ancho).toBe(TAMANO_MAXIMO_LADO)
    expect(alto).toBe(Math.round(3024 * (TAMANO_MAXIMO_LADO / 4032)))
  })

  it('reduce el lado más largo al máximo manteniendo la proporción (vertical)', () => {
    const { ancho, alto } = calcularDimensiones(3024, 4032)
    expect(alto).toBe(TAMANO_MAXIMO_LADO)
    expect(ancho).toBe(Math.round(3024 * (TAMANO_MAXIMO_LADO / 4032)))
  })

  it('respeta un lado máximo personalizado', () => {
    expect(calcularDimensiones(2000, 1000, 500)).toEqual({ ancho: 500, alto: 250 })
  })

  it('una imagen cuadrada mantiene proporción 1:1', () => {
    expect(calcularDimensiones(3000, 3000)).toEqual({ ancho: TAMANO_MAXIMO_LADO, alto: TAMANO_MAXIMO_LADO })
  })
})
