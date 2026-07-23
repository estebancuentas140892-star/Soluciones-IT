import { describe, expect, it } from 'vitest'
import { aplicaADesdeFormulario, aplicaAlDispositivo, describirAplicaA } from './aplicaA'

describe('aplicaAlDispositivo', () => {
  it('aplica siempre cuando aplicaA es null (toda la categoría)', () => {
    expect(aplicaAlDispositivo(null, { marca: 'Zebra', modelo: 'ZT411' })).toBe(true)
  })

  it('aplica siempre cuando aplicaA tiene ambos campos vacíos', () => {
    expect(aplicaAlDispositivo({ marca: '', modelo: '' }, { marca: 'Zebra', modelo: 'ZT411' })).toBe(true)
    expect(aplicaAlDispositivo({ marca: null, modelo: null }, { marca: 'Zebra', modelo: 'ZT411' })).toBe(true)
  })

  it('filtra por marca, sin distinguir mayúsculas ni espacios', () => {
    const aplicaA = { marca: ' zebra ', modelo: null }
    expect(aplicaAlDispositivo(aplicaA, { marca: 'Zebra', modelo: 'ZT411' })).toBe(true)
    expect(aplicaAlDispositivo(aplicaA, { marca: 'HP', modelo: 'LaserJet' })).toBe(false)
  })

  it('filtra por modelo', () => {
    const aplicaA = { marca: null, modelo: 'ZT411' }
    expect(aplicaAlDispositivo(aplicaA, { marca: 'Zebra', modelo: 'ZT411' })).toBe(true)
    expect(aplicaAlDispositivo(aplicaA, { marca: 'Zebra', modelo: 'ZT230' })).toBe(false)
  })

  it('con marca y modelo a la vez, exige que coincidan los dos', () => {
    const aplicaA = { marca: 'Zebra', modelo: 'ZT411' }
    expect(aplicaAlDispositivo(aplicaA, { marca: 'Zebra', modelo: 'ZT411' })).toBe(true)
    expect(aplicaAlDispositivo(aplicaA, { marca: 'Zebra', modelo: 'ZT230' })).toBe(false)
    expect(aplicaAlDispositivo(aplicaA, { marca: 'HP', modelo: 'ZT411' })).toBe(false)
  })
})

describe('aplicaADesdeFormulario', () => {
  it('devuelve null cuando ambos campos están vacíos', () => {
    expect(aplicaADesdeFormulario('', '')).toBeNull()
    expect(aplicaADesdeFormulario('  ', '  ')).toBeNull()
  })

  it('recorta espacios y deja null el campo vacío', () => {
    expect(aplicaADesdeFormulario(' Zebra ', '')).toEqual({ marca: 'Zebra', modelo: null })
    expect(aplicaADesdeFormulario('', ' ZT411 ')).toEqual({ marca: null, modelo: 'ZT411' })
  })

  it('conserva ambos cuando los dos tienen contenido', () => {
    expect(aplicaADesdeFormulario('Zebra', 'ZT411')).toEqual({ marca: 'Zebra', modelo: 'ZT411' })
  })
})

describe('describirAplicaA', () => {
  it('devuelve vacío cuando no hay restricción', () => {
    expect(describirAplicaA(null)).toBe('')
    expect(describirAplicaA({ marca: null, modelo: null })).toBe('')
  })

  it('describe solo la marca, solo el modelo, o ambos', () => {
    expect(describirAplicaA({ marca: 'Zebra', modelo: null })).toBe('Marca: Zebra')
    expect(describirAplicaA({ marca: null, modelo: 'ZT411' })).toBe('Modelo: ZT411')
    expect(describirAplicaA({ marca: 'Zebra', modelo: 'ZT411' })).toBe('Marca: Zebra · Modelo: ZT411')
  })
})
