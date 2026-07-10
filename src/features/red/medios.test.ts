import { describe, expect, it } from 'vitest'
import { iconoDeVia } from './medios'

describe('iconoDeVia', () => {
  it('usa el icono de instalación sin mirar el medio', () => {
    expect(iconoDeVia('instalacion', 'lo que sea')).toBe('🗄')
  })

  it('reconoce fibra, inalámbrico y cable/UTP sin importar mayúsculas', () => {
    expect(iconoDeVia('enlace', 'Fibra óptica')).toBe('🟣')
    expect(iconoDeVia('enlace', 'Inalámbrico')).toBe('📶')
    expect(iconoDeVia('enlace', 'WiFi')).toBe('📶')
    expect(iconoDeVia('enlace', 'UTP')).toBe('🔌')
    expect(iconoDeVia('enlace', 'Cable ethernet')).toBe('🔌')
  })

  it('cae al icono genérico con un medio vacío o desconocido', () => {
    expect(iconoDeVia('enlace', '')).toBe('🔗')
    expect(iconoDeVia('enlace', 'satelital')).toBe('🔗')
  })
})
