import { describe, expect, it } from 'vitest'
import { descripcionVencida, estadoVencimiento, proximoVencimiento, vencimientoDesactualizado } from './vencimiento'

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

describe('descripcionVencida', () => {
  it('dice "hoy" cuando vence justo el día de hoy', () => {
    expect(descripcionVencida('2026-07-09', HOY)).toBe('Venció hoy')
  })

  it('concuerda el singular a 1 día', () => {
    expect(descripcionVencida('2026-07-08', HOY)).toBe('Venció hace 1 día')
  })

  it('cuenta varios días', () => {
    expect(descripcionVencida('2026-07-06', HOY)).toBe('Venció hace 3 días')
  })

  it('sigue contando aunque venciera hace mucho', () => {
    expect(descripcionVencida('2026-01-01', HOY)).toBe('Venció hace 189 días')
  })
})

describe('proximoVencimiento', () => {
  it('suma 90 días a la fecha dada', () => {
    expect(proximoVencimiento(HOY)).toBe('2026-10-07')
  })

  it('cruza el fin de año correctamente', () => {
    expect(proximoVencimiento(new Date('2026-12-01T12:00:00'))).toBe('2027-03-01')
  })
})

describe('vencimientoDesactualizado', () => {
  const base = {
    contrasenaActual: 'nueva-clave',
    contrasenaOriginal: 'vieja-clave',
    venceEnActual: '2026-07-08',
    venceEnOriginal: '2026-07-08',
  }

  it('avisa cuando la contraseña cambió y el vencimiento sigue igual (hallazgo S1)', () => {
    expect(vencimientoDesactualizado(base)).toBe(true)
  })

  it('no avisa si la contraseña no cambió', () => {
    expect(vencimientoDesactualizado({ ...base, contrasenaActual: base.contrasenaOriginal })).toBe(false)
  })

  it('no avisa si no había vencimiento guardado (nada que resetear)', () => {
    expect(vencimientoDesactualizado({ ...base, venceEnOriginal: '', venceEnActual: '' })).toBe(false)
  })

  it('no avisa si el técnico ya actualizó el vencimiento', () => {
    expect(vencimientoDesactualizado({ ...base, venceEnActual: '2026-10-07' })).toBe(false)
  })

  it('no avisa si la contraseña quedó vacía (no es una rotación real)', () => {
    expect(vencimientoDesactualizado({ ...base, contrasenaActual: '' })).toBe(false)
  })
})
