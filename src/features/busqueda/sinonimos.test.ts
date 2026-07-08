import { describe, expect, it } from 'vitest'
import { expandirConsulta } from './sinonimos'

describe('expandirConsulta', () => {
  it('agrega los sinónimos de una palabra conocida', () => {
    const expandida = expandirConsulta('backup')
    expect(expandida).toContain('backup')
    expect(expandida).toContain('respaldo')
    expect(expandida).toContain('copia')
    expect(expandida).toContain('seguridad')
  })

  it('no toca una consulta sin sinónimos', () => {
    expect(expandirConsulta('zebra')).toBe('zebra')
    expect(expandirConsulta('switch bodega')).toBe('switch bodega')
  })

  it('es insensible a mayúsculas y acentos', () => {
    expect(expandirConsulta('Cámara')).toContain('cctv')
    expect(expandirConsulta('IMPRESION')).toContain('impresora')
  })

  it('conserva los términos originales al inicio', () => {
    expect(expandirConsulta('internet lento').startsWith('internet lento')).toBe(true)
  })

  it('no repite palabras que el usuario ya escribió', () => {
    const expandida = expandirConsulta('impresora impresion')
    const veces = expandida.split(/\s+/).filter((p) => p === 'impresora').length
    expect(veces).toBe(1)
  })

  it('las frases del diccionario aportan sus palabras sin las vacías', () => {
    // 'pos' expande 'punto de venta' pero sin el 'de'.
    const expandida = expandirConsulta('pos')
    expect(expandida).toContain('punto')
    expect(expandida).toContain('venta')
    expect(expandida.split(/\s+/)).not.toContain('de')
  })
})
