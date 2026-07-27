import { describe, expect, it } from 'vitest'
import { tiempoRelativo } from './tiempoRelativo'

// Reloj fijo para que las fracciones sean exactas y la prueba no
// dependa del momento en que se ejecuta.
const AHORA = new Date('2026-07-27T12:00:00.000Z').getTime()
const hace = (ms: number) => new Date(AHORA - ms).toISOString()

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

describe('tiempoRelativo', () => {
  it('devuelve null sin fecha, para poder omitir la frase entera', () => {
    expect(tiempoRelativo(null, AHORA)).toBeNull()
    expect(tiempoRelativo(undefined, AHORA)).toBeNull()
    expect(tiempoRelativo('', AHORA)).toBeNull()
  })

  it('devuelve null con una fecha que no se puede interpretar', () => {
    expect(tiempoRelativo('no es una fecha', AHORA)).toBeNull()
  })

  it('resume el primer minuto como "hace un momento"', () => {
    expect(tiempoRelativo(hace(0), AHORA)).toBe('hace un momento')
    expect(tiempoRelativo(hace(40_000), AHORA)).toBe('hace un momento')
    expect(tiempoRelativo(hace(MINUTO - 1), AHORA)).toBe('hace un momento')
  })

  it('cuenta en minutos hasta la hora', () => {
    expect(tiempoRelativo(hace(MINUTO), AHORA)).toBe('hace 1 min')
    expect(tiempoRelativo(hace(4 * MINUTO), AHORA)).toBe('hace 4 min')
    expect(tiempoRelativo(hace(HORA - 1), AHORA)).toBe('hace 59 min')
  })

  it('cuenta en horas hasta el día', () => {
    expect(tiempoRelativo(hace(HORA), AHORA)).toBe('hace 1 h')
    expect(tiempoRelativo(hace(5 * HORA), AHORA)).toBe('hace 5 h')
    expect(tiempoRelativo(hace(DIA - 1), AHORA)).toBe('hace 23 h')
  })

  it('cuenta en días, con singular propio', () => {
    expect(tiempoRelativo(hace(DIA), AHORA)).toBe('hace 1 día')
    expect(tiempoRelativo(hace(3 * DIA), AHORA)).toBe('hace 3 días')
  })

  // El dato puede venir de otro teléfono del equipo con el reloj
  // adelantado: nunca debe salir "hace -3 min".
  it('trata una fecha futura por desfase de reloj como reciente', () => {
    expect(tiempoRelativo(new Date(AHORA + 5 * MINUTO).toISOString(), AHORA)).toBe('hace un momento')
  })
})
