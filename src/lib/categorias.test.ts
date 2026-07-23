import { describe, expect, it } from 'vitest'
import { esDeRed, idsDeRed } from './categorias'
import type { Categoria } from './db'

function categoria(parcial: Partial<Categoria> & { id: string }): Categoria {
  return {
    nombre: '',
    icono: '',
    orden: 0,
    esRed: false,
    color: null,
    ...parcial,
  } as Categoria
}

describe('esDeRed', () => {
  it('reconoce una categoría marcada como de red', () => {
    expect(esDeRed(categoria({ id: 'a', esRed: true }))).toBe(true)
  })

  it('una categoría normal no es de red', () => {
    expect(esDeRed(categoria({ id: 'a', esRed: false }))).toBe(false)
  })

  // El motivo de existir de la función: `Categoria.esRed` puede llegar
  // null de una base que aún no tiene la columna, y dos de las tres
  // pantallas leían el campo suelto, sin `Boolean()`.
  it('tolera null y undefined en el campo', () => {
    expect(esDeRed(categoria({ id: 'a', esRed: null as unknown as boolean }))).toBe(false)
    expect(esDeRed(categoria({ id: 'a', esRed: undefined as unknown as boolean }))).toBe(false)
  })

  it('tolera que no haya categoría (aún no descargada)', () => {
    expect(esDeRed(null)).toBe(false)
    expect(esDeRed(undefined)).toBe(false)
  })
})

describe('idsDeRed', () => {
  it('devuelve solo los ids de las categorías de red', () => {
    const ids = idsDeRed([
      categoria({ id: 'switches', esRed: true }),
      categoria({ id: 'impresoras', esRed: false }),
      categoria({ id: 'racks', esRed: true }),
    ])
    expect([...ids].sort()).toEqual(['racks', 'switches'])
  })

  it('sin categorías de red devuelve un conjunto vacío', () => {
    expect(idsDeRed([categoria({ id: 'impresoras', esRed: false })]).size).toBe(0)
  })

  it('tolera que las categorías aún no estén cargadas', () => {
    expect(idsDeRed(undefined).size).toBe(0)
  })
})
