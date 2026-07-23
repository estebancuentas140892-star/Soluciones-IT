import { describe, expect, it } from 'vitest'
import { tituloAccesoSugerido } from './tituloAcceso'

describe('tituloAccesoSugerido', () => {
  it('sugiere el título actualizado cuando el equipo se renombró y el título sigue el patrón exacto', () => {
    expect(tituloAccesoSugerido('Acceso Switch viejo', 'Switch viejo', 'Switch nuevo')).toBe(
      'Acceso Switch nuevo',
    )
  })

  it('no sugiere nada si el nombre vivo coincide con la copia (nada desactualizado)', () => {
    expect(tituloAccesoSugerido('Acceso Switch A', 'Switch A', 'Switch A')).toBeNull()
  })

  it('no sugiere nada si el técnico ya personalizó el título', () => {
    expect(tituloAccesoSugerido('Acceso al rack principal', 'Switch A', 'Switch B')).toBeNull()
  })

  it('no sugiere nada sin nombre vivo (equipo eliminado)', () => {
    expect(tituloAccesoSugerido('Acceso Switch A', 'Switch A', '')).toBeNull()
  })

  it('tolera espacios sobrantes en el título guardado', () => {
    expect(tituloAccesoSugerido('  Acceso Switch A  ', 'Switch A', 'Switch B')).toBe('Acceso Switch B')
  })
})
