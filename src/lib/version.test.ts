import { describe, expect, it } from 'vitest'
import { siguienteVersion } from './version'

describe('siguienteVersion', () => {
  it('sube la version menor por defecto', () => {
    expect(siguienteVersion('1.0', false)).toBe('1.1')
    expect(siguienteVersion('1.9', false)).toBe('1.10')
  })

  it('sube la version mayor y reinicia la menor en un cambio mayor', () => {
    expect(siguienteVersion('1.0', true)).toBe('2.0')
    expect(siguienteVersion('2.7', true)).toBe('3.0')
  })

  it('cae a "1.0" como base si el texto está vacío o mal formado', () => {
    expect(siguienteVersion('', false)).toBe('1.1')
    expect(siguienteVersion('abc', false)).toBe('1.1')
    expect(siguienteVersion('', true)).toBe('2.0')
  })
})
