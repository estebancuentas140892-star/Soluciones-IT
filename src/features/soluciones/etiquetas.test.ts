import { describe, expect, it } from 'vitest'
import { etiquetasFrecuentes, normalizarEtiquetas } from './etiquetas'

describe('etiquetasFrecuentes', () => {
  it('agrupa variantes de mayúsculas y acentos bajo una sola clave', () => {
    const resultado = etiquetasFrecuentes([['Impresora'], ['impresora'], ['IMPRESORA']])
    expect(resultado).toHaveLength(1)
    expect(resultado[0].usos).toBe(3)
  })

  it('elige como grafía canónica la más usada', () => {
    const resultado = etiquetasFrecuentes([['impresora'], ['Impresora'], ['Impresora']])
    expect(resultado[0]).toMatchObject({ texto: 'Impresora', usos: 3 })
  })

  it('a igual uso, el resultado es determinista entre ejecuciones', () => {
    const resultado1 = etiquetasFrecuentes([['zebra'], ['Zebra']])
    const resultado2 = etiquetasFrecuentes([['zebra'], ['Zebra']])
    expect(resultado1).toEqual(resultado2)
    expect(resultado1[0].usos).toBe(2)
  })

  it('ordena de más frecuente a menos frecuente', () => {
    const resultado = etiquetasFrecuentes([['pos'], ['pos'], ['pos'], ['red'], ['red'], ['backup']])
    expect(resultado.map((g) => g.texto)).toEqual(['pos', 'red', 'backup'])
  })

  it('ignora etiquetas vacías o solo espacios', () => {
    const resultado = etiquetasFrecuentes([['  ', ''], ['pos']])
    expect(resultado).toEqual([{ texto: 'pos', usos: 1 }])
  })

  it('distingue "café" de "cafe" solo cuando de verdad son distintas (sin acento vs con acento cuentan igual)', () => {
    const resultado = etiquetasFrecuentes([['café'], ['cafe']])
    expect(resultado).toHaveLength(1)
    expect(resultado[0].usos).toBe(2)
  })

  it('sin ninguna etiqueta en ningún artículo, devuelve vacío', () => {
    expect(etiquetasFrecuentes([[], []])).toEqual([])
  })
})

describe('normalizarEtiquetas', () => {
  it('recorta espacios', () => {
    expect(normalizarEtiquetas(['  Impresora  '], [])).toEqual(['Impresora'])
  })

  it('colapsa duplicados internos que solo difieren en mayúsculas o acentos, conservando el primero', () => {
    expect(normalizarEtiquetas(['impresora', 'Impresora', 'IMPRESORA'], [])).toEqual(['impresora'])
  })

  it('adopta la grafía canónica del vocabulario global si existe', () => {
    const vocabulario = [{ texto: 'Impresora', usos: 9 }]
    expect(normalizarEtiquetas(['impresora'], vocabulario)).toEqual(['Impresora'])
  })

  it('conserva la grafía escrita si el vocabulario no la conoce', () => {
    expect(normalizarEtiquetas(['Backup'], [{ texto: 'Impresora', usos: 9 }])).toEqual(['Backup'])
  })

  it('descarta entradas vacías', () => {
    expect(normalizarEtiquetas(['Impresora', '   ', ''], [])).toEqual(['Impresora'])
  })

  it('nunca reescribe el vocabulario mismo, solo el artículo que se guarda', () => {
    const vocabulario = [{ texto: 'Impresora', usos: 9 }]
    normalizarEtiquetas(['impresora'], vocabulario)
    expect(vocabulario).toEqual([{ texto: 'Impresora', usos: 9 }])
  })
})
