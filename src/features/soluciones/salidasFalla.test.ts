import { describe, expect, it } from 'vitest'
import { destinoAlSaltar, fraseAvanceConservado } from './salidasFalla'

const ids = ['p1', 'p2', 'p3']

describe('destinoAlSaltar', () => {
  it('salta al siguiente paso en orden', () => {
    expect(destinoAlSaltar(0, ids, new Set())).toBe(1)
  })

  it('el siguiente en orden vale aunque ya esté hecho: saltar es avanzar, no buscar pendiente', () => {
    expect(destinoAlSaltar(0, ids, new Set(['p2']))).toBe(1)
  })

  it('desde el último paso vuelve a un pendiente de más atrás', () => {
    expect(destinoAlSaltar(2, ids, new Set(['p1']))).toBe(1)
  })

  // Si el último paso es el único que queda, saltarlo dejaría el
  // procedimiento sin nada por delante y la pantalla de cierre diría
  // "completado" sobre un paso que falló.
  it('no hay destino cuando el último paso es el único pendiente', () => {
    expect(destinoAlSaltar(2, ids, new Set(['p1', 'p2']))).toBeNull()
  })

  it('no hay destino en un procedimiento de un solo paso', () => {
    expect(destinoAlSaltar(0, ['p1'], new Set())).toBeNull()
  })
})

describe('fraseAvanceConservado', () => {
  it('sin ningún paso hecho no promete un avance que no existe', () => {
    expect(fraseAvanceConservado(0)).toBe('Elige la salida. Ninguna borra lo que ya marcaste.')
  })

  it('concuerda el singular', () => {
    expect(fraseAvanceConservado(1)).toBe('Elige la salida. El paso que llevas hecho no se pierde.')
  })

  it('dice el número real de pasos hechos', () => {
    expect(fraseAvanceConservado(4)).toBe('Elige la salida. Los 4 pasos que llevas hechos no se pierden.')
  })
})
