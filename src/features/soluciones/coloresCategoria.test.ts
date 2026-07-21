import { describe, expect, it } from 'vitest'
import {
  CLAVES_COLOR_CATEGORIA,
  claseActivaDeCategoria,
  claseTextoDeCategoria,
  colorDeCategoria,
  colorPorOrden,
  esClaveColorValida,
} from './coloresCategoria'

describe('colorPorOrden', () => {
  it('reparte los diez matices sin repetir en las diez primeras categorías', () => {
    const asignados = Array.from({ length: 10 }, (_, orden) => colorPorOrden(orden))
    expect(new Set(asignados).size).toBe(10)
  })

  it('cicla al pasar de diez, en vez de quedarse sin color', () => {
    expect(colorPorOrden(10)).toBe(colorPorOrden(0))
    expect(colorPorOrden(23)).toBe(colorPorOrden(3))
  })

  // La columna `orden` la edita el equipo, así que puede llegar con
  // cualquier número: nunca debe producir un índice fuera de rango.
  it('tolera órdenes negativos (el % de JavaScript daría índice negativo)', () => {
    expect(CLAVES_COLOR_CATEGORIA).toContain(colorPorOrden(-1))
    expect(colorPorOrden(-10)).toBe(colorPorOrden(0))
  })

  it('tolera decimales y valores no finitos', () => {
    expect(colorPorOrden(2.7)).toBe(colorPorOrden(2))
    expect(CLAVES_COLOR_CATEGORIA).toContain(colorPorOrden(Number.NaN))
    expect(CLAVES_COLOR_CATEGORIA).toContain(colorPorOrden(Number.POSITIVE_INFINITY))
  })
})

describe('esClaveColorValida', () => {
  it('acepta las claves de la paleta y rechaza cualquier otra cosa', () => {
    expect(esClaveColorValida('cat-1')).toBe(true)
    expect(esClaveColorValida('cat-10')).toBe(true)
    expect(esClaveColorValida('cat-11')).toBe(false)
    expect(esClaveColorValida('#ff0000')).toBe(false)
    expect(esClaveColorValida(null)).toBe(false)
    expect(esClaveColorValida(undefined)).toBe(false)
  })
})

describe('colorDeCategoria', () => {
  it('usa el override manual cuando la categoría lo tiene', () => {
    expect(colorDeCategoria({ color: 'cat-7', orden: 0 })).toBe('cat-7')
  })

  it('sin override, deriva del orden', () => {
    expect(colorDeCategoria({ color: null, orden: 3 })).toBe(colorPorOrden(3))
  })

  // Una base sin el schema.sql de N3 aplicado devuelve `color` null, y
  // una clave retirada de la paleta tampoco debe romper la pantalla.
  it('cae al derivado si el override no es una clave conocida', () => {
    expect(colorDeCategoria({ color: 'morado-viejo', orden: 4 })).toBe(colorPorOrden(4))
    expect(colorDeCategoria({ color: '', orden: 4 })).toBe(colorPorOrden(4))
  })

  it('dos categorías contiguas nunca comparten matiz', () => {
    for (let orden = 0; orden < 9; orden++) {
      expect(colorDeCategoria({ color: null, orden })).not.toBe(
        colorDeCategoria({ color: null, orden: orden + 1 }),
      )
    }
  })
})

// Tailwind solo genera las utilidades que encuentra escritas enteras en
// el codigo: si alguna clase se armara por concatenacion, el color no
// existiria en la hoja y el chip saldria sin pintar.
describe('clases literales', () => {
  it('la clase de texto nombra el token completo', () => {
    expect(claseTextoDeCategoria({ color: 'cat-5', orden: 0 })).toBe('text-noct-cat-5')
  })

  it('la clase activa trae borde, fondo tenue y texto del mismo matiz', () => {
    expect(claseActivaDeCategoria({ color: 'cat-2', orden: 0 })).toBe(
      'border-noct-cat-2 bg-noct-cat-2/[.14] text-noct-cat-2',
    )
  })

  it('cada clave de la paleta tiene sus tres clases', () => {
    for (const clave of CLAVES_COLOR_CATEGORIA) {
      const categoria = { color: clave, orden: 0 }
      expect(claseTextoDeCategoria(categoria)).toContain(`noct-${clave}`)
      expect(claseActivaDeCategoria(categoria)).toContain(`noct-${clave}`)
    }
  })
})
