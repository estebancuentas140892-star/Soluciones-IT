import { describe, expect, it } from 'vitest'
import type { Articulo, ProgresoPasos } from '../../lib/db'
import { articulosSinTerminar } from './sinTerminar'

// Un artículo con procedimiento de `nPasos` pasos con ids predecibles
// ("p1", "p2"...), que es lo único que mira la función.
function articulo(id: string, nPasos: number, tiempoEstimadoMin: number | null = null): Articulo {
  return {
    id,
    titulo: `Artículo ${id}`,
    tipo: 'instalacion',
    procedimiento: {
      pasos: Array.from({ length: nPasos }, (_, i) => ({ id: `p${i + 1}`, titulo: `Paso ${i + 1}` })),
      tiempoEstimadoMin,
    },
  } as unknown as Articulo
}

function progreso(articuloId: string, pasosHechos: string[], actualizadoEn: string): ProgresoPasos {
  return { articuloId, pasosHechos, actualizadoEn }
}

const AYER = '2026-07-26T10:00:00.000Z'
const HOY = '2026-07-27T10:00:00.000Z'

describe('articulosSinTerminar', () => {
  it('no devuelve nada sin progreso guardado', () => {
    expect(articulosSinTerminar([articulo('a', 6)], [])).toEqual([])
  })

  it('ignora un artículo sin empezar: no hay nada que retomar', () => {
    const resultado = articulosSinTerminar([articulo('a', 6)], [progreso('a', [], HOY)])
    expect(resultado).toEqual([])
  })

  it('ignora un artículo terminado: ya no está "sin terminar"', () => {
    const hechos = ['p1', 'p2', 'p3']
    const resultado = articulosSinTerminar([articulo('a', 3)], [progreso('a', hechos, HOY)])
    expect(resultado).toEqual([])
  })

  it('devuelve un artículo a medias con sus pasos hechos y el total', () => {
    const resultado = articulosSinTerminar([articulo('a', 7)], [progreso('a', ['p1', 'p2', 'p3'], HOY)])
    expect(resultado).toHaveLength(1)
    expect(resultado[0].hechos).toBe(3)
    expect(resultado[0].total).toBe(7)
    expect(resultado[0].articulo.id).toBe('a')
  })

  it('ignora un artículo sin procedimiento', () => {
    const sinProcedimiento = { id: 'a', titulo: 'Manual', procedimiento: null } as unknown as Articulo
    expect(articulosSinTerminar([sinProcedimiento], [progreso('a', ['p1'], HOY)])).toEqual([])
  })

  it('ignora un procedimiento sin pasos, que no puede tener avance', () => {
    expect(articulosSinTerminar([articulo('a', 0)], [progreso('a', ['p1'], HOY)])).toEqual([])
  })

  // El procedimiento pudo editarse después de marcar el avance: los pasos
  // que ya no existen no deben contar ni dejar el artículo "terminado".
  it('no cuenta pasos hechos que el procedimiento ya no tiene', () => {
    const resultado = articulosSinTerminar(
      [articulo('a', 3)],
      [progreso('a', ['p1', 'p9', 'p10'], HOY)],
    )
    expect(resultado).toHaveLength(1)
    expect(resultado[0].hechos).toBe(1)
    expect(resultado[0].total).toBe(3)
  })

  it('reparte el tiempo estimado entre los pasos que faltan', () => {
    // 4 de 7 pasos hechos sobre 35 min estimados: quedan 3/7 -> 15 min.
    const resultado = articulosSinTerminar(
      [articulo('a', 7, 35)],
      [progreso('a', ['p1', 'p2', 'p3', 'p4'], HOY)],
    )
    expect(resultado[0].minutosRestantes).toBe(15)
  })

  it('deja los minutos restantes en null si el procedimiento no estima tiempo', () => {
    const resultado = articulosSinTerminar([articulo('a', 6)], [progreso('a', ['p1'], HOY)])
    expect(resultado[0].minutosRestantes).toBeNull()
  })

  // Nunca "te quedan ~0 min": si falta algo por hacer, falta tiempo.
  // 9 de 10 pasos hechos sobre 1 min estimado da 0.1, que redondea a 0.
  it('nunca baja de 1 minuto restante cuando aún falta un paso', () => {
    const casiListo = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']
    const resultado = articulosSinTerminar([articulo('a', 10, 1)], [progreso('a', casiListo, HOY)])
    expect(resultado[0].minutosRestantes).toBe(1)
  })

  it('pone primero lo último que se tocó, que es lo que se acaba de interrumpir', () => {
    const resultado = articulosSinTerminar(
      [articulo('viejo', 5), articulo('nuevo', 5)],
      [progreso('viejo', ['p1'], AYER), progreso('nuevo', ['p1'], HOY)],
    )
    expect(resultado.map((r) => r.articulo.id)).toEqual(['nuevo', 'viejo'])
  })
})
