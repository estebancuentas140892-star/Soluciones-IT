import { describe, expect, it } from 'vitest'
import { estadoVencimiento } from './vencimiento'

const HOY = new Date('2026-07-09T12:00:00')

describe('estadoVencimiento', () => {
  it('devuelve null sin fecha', () => {
    expect(estadoVencimiento(null, HOY)).toBeNull()
  })

  it('devuelve null si falta mucho para vencer', () => {
    expect(estadoVencimiento('2026-12-31', HOY)).toBeNull()
  })

  it('devuelve "proxima" dentro de los 30 días, incluido el día de hoy', () => {
    expect(estadoVencimiento('2026-07-09', HOY)).toBe('proxima')
    expect(estadoVencimiento('2026-08-01', HOY)).toBe('proxima')
  })

  it('devuelve "vencida" para una fecha ya pasada', () => {
    expect(estadoVencimiento('2026-07-08', HOY)).toBe('vencida')
    expect(estadoVencimiento('2026-01-01', HOY)).toBe('vencida')
  })

  it('ignora una fecha mal formada', () => {
    expect(estadoVencimiento('no-es-fecha', HOY)).toBeNull()
  })
})
