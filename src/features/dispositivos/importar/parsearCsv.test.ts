import { describe, expect, it } from 'vitest'
import { decodificarBytes, detectarSeparador, parsearCsv } from './parsearCsv'

describe('decodificarBytes', () => {
  it('lee UTF-8 y quita el BOM inicial', () => {
    const bytes = new TextEncoder().encode(String.fromCharCode(0xfeff) + 'Nombre,Marca\nPOS caja 1,HP')
    expect(decodificarBytes(bytes)).toBe('Nombre,Marca\nPOS caja 1,HP')
  })

  it('cae a Windows-1252 cuando los bytes no son UTF-8 válido', () => {
    // "año" en Windows-1252: la ñ es el byte 0xF1, inválido en UTF-8.
    const bytes = new Uint8Array([0x61, 0xf1, 0x6f])
    expect(decodificarBytes(bytes)).toBe('año')
  })
})

describe('detectarSeparador', () => {
  it('detecta punto y coma, el separador de Excel en español', () => {
    expect(detectarSeparador('Nombre;Marca;Modelo\nuno;dos;tres')).toBe(';')
  })

  it('detecta coma y tabulador', () => {
    expect(detectarSeparador('Nombre,Marca\nuno,dos')).toBe(',')
    expect(detectarSeparador('Nombre\tMarca\nuno\tdos')).toBe('\t')
  })

  it('ignora los separadores que van entre comillas', () => {
    expect(detectarSeparador('"Nombre; completo",Marca\nuno,dos')).toBe(',')
  })
})

describe('parsearCsv', () => {
  it('separa filas y columnas con finales de línea de Windows', () => {
    expect(parsearCsv('a,b,c\r\nd,e,f')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ])
  })

  it('respeta comillas con separadores, saltos de línea y comillas escapadas', () => {
    const texto = '"uno, dos",tres\n"línea\npartida","con ""comillas"""'
    expect(parsearCsv(texto)).toEqual([
      ['uno, dos', 'tres'],
      ['línea\npartida', 'con "comillas"'],
    ])
  })

  it('descarta las filas vacías del final pero no las del medio', () => {
    expect(parsearCsv('a,b\n,\nc,d\n,\n,')).toEqual([
      ['a', 'b'],
      ['', ''],
      ['c', 'd'],
    ])
  })

  it('quita el BOM aunque el texto llegue ya decodificado', () => {
    expect(parsearCsv(String.fromCharCode(0xfeff) + 'a;b\nc;d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})
