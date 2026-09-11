import { describe, expect, it } from 'vitest'
import { tarjetaReanudarVisible } from './useReanudar'
import type { ArticuloSinTerminar } from './sinTerminar'

// La barra flotante global ya no existe. Lo único que decide si Inicio
// dibuja "Continuar guía" es si hay una guía a medias y si el técnico
// la descartó; antes se le sumaba una comprobación de "la barra está
// visible" que valía exactamente lo mismo, así que la tarjeta no salía
// nunca (encargo del 2026-09-11, tarea 1).

const A_MEDIAS = { articulo: { id: 'a1' }, hechos: 2, total: 5, minutosRestantes: 9 } as unknown as ArticuloSinTerminar

describe('tarjetaReanudarVisible', () => {
  it('muestra la tarjeta cuando hay una guía empezada y no se descartó', () => {
    expect(tarjetaReanudarVisible({ actual: A_MEDIAS, descartado: false })).toBe(true)
  })

  it('la oculta al descartarla', () => {
    expect(tarjetaReanudarVisible({ actual: A_MEDIAS, descartado: true })).toBe(false)
  })

  it('no la muestra si no hay ninguna guía a medias', () => {
    expect(tarjetaReanudarVisible({ actual: null, descartado: false })).toBe(false)
  })
})
