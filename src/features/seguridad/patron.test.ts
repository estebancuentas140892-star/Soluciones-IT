import { describe, expect, it } from 'vitest'
import {
  agregarNodo,
  contarNodosSerializados,
  nodoIntermedio,
  patronValido,
  serializarPatron,
} from './patron'

describe('nodoIntermedio', () => {
  it('devuelve el punto medio de dos nodos alineados que saltan uno', () => {
    expect(nodoIntermedio(0, 2)).toBe(1) // fila
    expect(nodoIntermedio(0, 6)).toBe(3) // columna
    expect(nodoIntermedio(0, 8)).toBe(4) // diagonal principal
    expect(nodoIntermedio(2, 6)).toBe(4) // diagonal secundaria
    expect(nodoIntermedio(3, 5)).toBe(4) // fila del medio
  })

  it('devuelve null si no se cruza ningun nodo', () => {
    expect(nodoIntermedio(0, 1)).toBeNull() // adyacentes
    expect(nodoIntermedio(0, 4)).toBeNull() // diagonal corta
    expect(nodoIntermedio(0, 5)).toBeNull() // salto de caballo
    expect(nodoIntermedio(1, 6)).toBeNull()
    expect(nodoIntermedio(3, 3)).toBeNull() // mismo nodo
  })
})

describe('agregarNodo', () => {
  it('agrega un nodo nuevo al final', () => {
    expect(agregarNodo([0], 1)).toEqual([0, 1])
  })

  it('inserta el intermedio cuando se salta un nodo sin usar', () => {
    expect(agregarNodo([0], 2)).toEqual([0, 1, 2])
    expect(agregarNodo([0], 8)).toEqual([0, 4, 8])
  })

  it('no reinserta el intermedio si ya estaba usado', () => {
    // 0 -> 4 -> 8: al ir de 4 a ... no aplica; probamos 4 ya presente
    expect(agregarNodo([0, 4], 8)).toEqual([0, 4, 8])
  })

  it('ignora un nodo ya presente en la secuencia', () => {
    expect(agregarNodo([0, 1, 2], 1)).toEqual([0, 1, 2])
  })

  it('ignora indices fuera de rango', () => {
    expect(agregarNodo([0], 9)).toEqual([0])
    expect(agregarNodo([0], -1)).toEqual([0])
  })

  it('no muta la secuencia original', () => {
    const original = [0]
    agregarNodo(original, 1)
    expect(original).toEqual([0])
  })
})

describe('patronValido', () => {
  it('acepta 4 o mas puntos distintos en rango', () => {
    expect(patronValido([0, 1, 2, 5])).toBe(true)
  })

  it('rechaza menos de 4 puntos', () => {
    expect(patronValido([0, 1, 2])).toBe(false)
  })

  it('rechaza puntos repetidos', () => {
    expect(patronValido([0, 1, 1, 2])).toBe(false)
  })

  it('rechaza indices fuera de rango', () => {
    expect(patronValido([0, 1, 2, 9])).toBe(false)
  })
})

describe('serializarPatron y contarNodosSerializados', () => {
  it('serializa a texto separado por guiones', () => {
    expect(serializarPatron([0, 4, 8, 5])).toBe('0-4-8-5')
  })

  it('cuenta los nodos de un patron serializado', () => {
    expect(contarNodosSerializados('0-4-8-5')).toBe(4)
    expect(contarNodosSerializados('')).toBe(0)
  })
})
