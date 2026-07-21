import { describe, expect, it } from 'vitest'
import { valoresUnicos } from './vocabulario'

describe('valoresUnicos', () => {
  it('descarta vacíos y valores que solo tienen espacios', () => {
    expect(valoresUnicos(['Zebra', '', '   ', 'Epson'])).toEqual(['Epson', 'Zebra'])
  })

  it('recorta los espacios de alrededor', () => {
    expect(valoresUnicos(['  Epson  '])).toEqual(['Epson'])
  })

  // El motivo de existir del helper: antes de la fase 0a, la lista de
  // categorías de la Bóveda deduplicaba con `new Set` y ofrecía "POS" y
  // "pos" como dos opciones distintas.
  it('deduplica sin distinguir mayúsculas y conserva la primera forma vista', () => {
    expect(valoresUnicos(['POS', 'pos', 'Pos'])).toEqual(['POS'])
    expect(valoresUnicos(['pos', 'POS'])).toEqual(['pos'])
  })

  it('trata como el mismo valor lo que solo difiere en espacios de alrededor', () => {
    expect(valoresUnicos(['Epson', ' Epson '])).toEqual(['Epson'])
  })

  it('ordena con el locale español (los acentos no van al final)', () => {
    expect(valoresUnicos(['Zebra', 'Álvarez', 'Brother'])).toEqual(['Álvarez', 'Brother', 'Zebra'])
  })

  it('ordena los números por valor, no como texto', () => {
    expect(valoresUnicos(['Sala 10', 'Sala 2'])).toEqual(['Sala 2', 'Sala 10'])
  })

  it('sin valores devuelve una lista vacía', () => {
    expect(valoresUnicos([])).toEqual([])
  })
})
