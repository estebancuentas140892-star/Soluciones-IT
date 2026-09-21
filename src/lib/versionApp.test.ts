import { describe, expect, it } from 'vitest'
import { VERSION_DESARROLLO, versionApp } from './versionApp'

// LA VERSIÓN QUE SE VE EN EL TELÉFONO (encargo del 2026-09-20, punto 4).
// Lo que importa: que nunca invente un commit y que en local lo diga.

describe('versionApp', () => {
  it('recorta el commit de Vercel a siete caracteres', () => {
    expect(versionApp('c06e87c1234567890')).toBe('c06e87c')
    expect(versionApp('e69dea0')).toBe('e69dea0')
  })

  it('sin variable de build dice "desarrollo", no un commit inventado', () => {
    expect(versionApp(undefined)).toBe(VERSION_DESARROLLO)
    expect(versionApp('')).toBe(VERSION_DESARROLLO)
    expect(versionApp('   ')).toBe(VERSION_DESARROLLO)
  })
})
