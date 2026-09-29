import { describe, expect, it } from 'vitest'
import { contextoVisible, lineaDeContexto, nombreYaLoDice } from './contextoEquipo'

describe('los ejemplos del encargo del 2026-09-29', () => {
  it('"Impresora Taquilla" no repite "Impresoras · Taquilla"', () => {
    expect(lineaDeContexto('Impresora Taquilla', ['Impresoras', 'Taquilla'])).toBe('')
  })

  it('"HP M404 Taquilla" solo agrega la categoría', () => {
    expect(lineaDeContexto('HP M404 Taquilla', ['Impresoras', 'Taquilla'])).toBe('Impresoras')
  })

  it('"HP M404" necesita las dos', () => {
    expect(lineaDeContexto('HP M404', ['Impresoras', 'Taquilla'])).toBe('Impresoras · Taquilla')
  })

  it('"Cámara Restaurante" no repite lo que ya dice', () => {
    expect(lineaDeContexto('Cámara Restaurante', ['Cámaras', 'Restaurante'])).toBe('')
  })
})

describe('tolera lo que no cambia el significado', () => {
  it('mayúsculas, tildes y espacios', () => {
    expect(nombreYaLoDice('CAMARA   restaurante', 'Cámaras')).toBe(true)
    expect(nombreYaLoDice('cámara restaurante', '  RESTAURANTE ')).toBe(true)
  })

  it('el plural simple: -s y -es', () => {
    expect(nombreYaLoDice('Impresora Taquilla', 'Impresoras')).toBe(true)
    expect(nombreYaLoDice('Switch piso 2', 'Switches')).toBe(true)
    expect(nombreYaLoDice('Router de las redes', 'Red')).toBe(true)
  })

  it('guiones y signos como separadores, y las palabras vacías de la parte', () => {
    expect(nombreYaLoDice('Impresora-Taquilla', 'Taquilla')).toBe(true)
    expect(nombreYaLoDice('Punto de red Taquilla', 'Puntos de red')).toBe(true)
    expect(nombreYaLoDice('Punto red Taquilla', 'Puntos de red')).toBe(true)
  })
})

describe('ante la duda, se muestra', () => {
  it('una ubicación con palabras que el nombre no tiene', () => {
    expect(lineaDeContexto('Impresora Taquilla', ['Impresoras', 'Taquilla Norte'])).toBe('Taquilla Norte')
    expect(lineaDeContexto('Impresora Taquilla', ['Impresoras', 'Taquilla 2'])).toBe('Taquilla 2')
  })

  it('una palabra dentro de otra no cuenta: solo palabras enteras', () => {
    expect(nombreYaLoDice('ImpresoraTaquilla', 'Taquilla')).toBe(false)
    expect(nombreYaLoDice('Caja registradora', 'Registro')).toBe(false)
    expect(nombreYaLoDice('Redondo', 'Red')).toBe(false)
  })

  it('un número o una letra suelta no bastan para callar una parte', () => {
    expect(nombreYaLoDice('Caja 2', '2')).toBe(false)
    expect(nombreYaLoDice('Rack B', 'B')).toBe(false)
    expect(nombreYaLoDice('POS 2', 'POS')).toBe(true)
  })

  it('una parte vacía o hecha solo de palabras vacías', () => {
    expect(nombreYaLoDice('Impresora', 'de la')).toBe(false)
    expect(contextoVisible('Impresora', [null, undefined, '', '  '])).toEqual([])
  })
})

describe('contextoVisible', () => {
  it('conserva el orden y no repite partes iguales entre sí', () => {
    expect(contextoVisible('HP M404', ['Impresoras', 'impresoras', 'Taquilla'])).toEqual(['Impresoras', 'Taquilla'])
  })

  it('sirve para cualquier parte, no solo categoría y ubicación', () => {
    expect(lineaDeContexto('HP M404 Taquilla', ['HP', 'M404', 'Taquilla'])).toBe('')
    expect(lineaDeContexto('Impresora de caja', ['HP', 'M404'])).toBe('HP · M404')
  })
})
