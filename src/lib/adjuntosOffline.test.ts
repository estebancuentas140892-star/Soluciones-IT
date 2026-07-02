import { describe, expect, it } from 'vitest'
import { claveDe, obtenerProgresoDescarga } from './adjuntosOffline'

describe('claveDe', () => {
  it('es estable: la misma referencia siempre produce la misma clave', () => {
    expect(claveDe('dispositivos/123/foto.jpg')).toBe(claveDe('dispositivos/123/foto.jpg'))
  })

  it('produce claves distintas para referencias distintas', () => {
    expect(claveDe('dispositivos/123/foto.jpg')).not.toBe(claveDe('dispositivos/456/foto.jpg'))
  })

  it('escapa la referencia para que las barras no rompan la clave', () => {
    const clave = claveDe('dispositivos/123/foto con espacios.jpg')
    expect(clave).not.toContain(' ')
    expect(clave.startsWith('https://')).toBe(true)
  })
})

describe('obtenerProgresoDescarga', () => {
  it('empieza sin una descarga en curso', () => {
    const progreso = obtenerProgresoDescarga()
    expect(progreso.enCurso).toBe(false)
    expect(progreso.total).toBe(0)
  })
})
