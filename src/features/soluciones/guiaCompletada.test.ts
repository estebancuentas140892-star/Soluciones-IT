import { describe, expect, it } from 'vitest'
import { cuentaDeGuiaCompletada, fechaHoraDeCierre, queYDondeDeGuiaCompletada } from './guiaCompletada'

// LO QUE DICE LA PANTALLA FINAL DE UNA GUÍA EN EL TELÉFONO (tarea 341):
// qué se terminó, dónde, cuánto fue y cuándo. Los nombres son inventados.

describe('cuentaDeGuiaCompletada (tarea 350)', () => {
  it('dice las ventanas y las comprobaciones, en singular cuando es una', () => {
    expect(cuentaDeGuiaCompletada(4, 2)).toBe('4 ventanas · 2 comprobaciones')
    expect(cuentaDeGuiaCompletada(1, 1)).toBe('1 ventana · 1 comprobación')
  })

  it('sin comprobación final, solo las ventanas', () => {
    expect(cuentaDeGuiaCompletada(3, 0)).toBe('3 ventanas')
  })
})

describe('queYDondeDeGuiaCompletada (tarea 350)', () => {
  it('dice la guía y el equipo; sin equipo, solo la guía', () => {
    expect(queYDondeDeGuiaCompletada('Limpiar el cabezal', 'IMPRESORA-PRUEBA-1')).toBe('Limpiar el cabezal · IMPRESORA-PRUEBA-1')
    expect(queYDondeDeGuiaCompletada('Limpiar el cabezal', null)).toBe('Limpiar el cabezal')
  })
})

describe('fechaHoraDeCierre', () => {
  it('es la fecha y la hora locales del cierre, con los minutos en dos cifras', () => {
    expect(fechaHoraDeCierre(new Date(2026, 9, 15, 9, 41).toISOString())).toBe('15 oct 2026 · 9:41')
    expect(fechaHoraDeCierre(new Date(2026, 0, 3, 17, 5).toISOString())).toBe('3 ene 2026 · 17:05')
  })

  it('sin fecha, o con una que no se entiende, no dice nada', () => {
    expect(fechaHoraDeCierre(undefined)).toBe('')
    expect(fechaHoraDeCierre('no es una fecha')).toBe('')
  })
})
