import { describe, expect, it } from 'vitest'
import { fechaHoraDeCierre, resumenDeGuiaCompletada } from './guiaCompletada'

// LO QUE DICE LA PANTALLA FINAL DE UNA GUÍA EN EL TELÉFONO (tarea 341):
// qué se terminó, dónde, cuánto fue y cuándo. Los nombres son inventados.

describe('resumenDeGuiaCompletada', () => {
  it('dice la guía, el equipo, los pasos y las comprobaciones', () => {
    expect(resumenDeGuiaCompletada('Limpiar el cabezal', 'IMPRESORA-PRUEBA-1', 4, 2)).toBe(
      'Limpiar el cabezal en IMPRESORA-PRUEBA-1. 4 pasos y 2 comprobaciones.',
    )
  })

  it('sin equipo no dice "en"', () => {
    expect(resumenDeGuiaCompletada('Limpiar el cabezal', null, 3, 1)).toBe('Limpiar el cabezal. 3 pasos y 1 comprobación.')
  })

  it('sin comprobación final, solo los pasos; en singular cuando es uno', () => {
    expect(resumenDeGuiaCompletada('Reiniciar el equipo', null, 1, 0)).toBe('Reiniciar el equipo. 1 paso.')
  })

  it('sin título, solo la cuenta', () => {
    expect(resumenDeGuiaCompletada('', 'IMPRESORA-PRUEBA-1', 2, 0)).toBe('2 pasos.')
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
