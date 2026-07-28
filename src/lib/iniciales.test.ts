import { describe, expect, it } from 'vitest'
import { inicialesDe } from './iniciales'

describe('inicialesDe', () => {
  it('toma la inicial del nombre y la del primer apellido', () => {
    expect(inicialesDe('Ana Valencia', 'ana@ejemplo.com')).toBe('AV')
  })

  it('con nombre y dos apellidos usa solo las dos primeras palabras', () => {
    expect(inicialesDe('Ana Valencia Restrepo')).toBe('AV')
  })

  it('con un solo nombre usa sus dos primeras letras', () => {
    expect(inicialesDe('Ana')).toBe('AN')
  })

  it('tolera espacios de más', () => {
    expect(inicialesDe('  Ana   Valencia  ')).toBe('AV')
  })

  it('sin nombre cae en la parte local del correo', () => {
    expect(inicialesDe('', 'esteban@ejemplo.com')).toBe('ES')
    expect(inicialesDe(null, 'esteban@ejemplo.com')).toBe('ES')
  })

  it('el nombre gana al correo cuando existe', () => {
    expect(inicialesDe('Ana Valencia', 'otra.cosa@ejemplo.com')).toBe('AV')
  })

  it('sin nombre ni correo devuelve vacío, para que la interfaz use su respaldo', () => {
    expect(inicialesDe(null, null)).toBe('')
    expect(inicialesDe('   ', '')).toBe('')
  })

  it('devuelve siempre mayúsculas', () => {
    expect(inicialesDe('ana valencia')).toBe('AV')
  })
})
