import { describe, expect, it } from 'vitest'
import { incluyeTexto, texto } from './texto'

describe('texto', () => {
  it('deja pasar las cadenas tal cual', () => {
    expect(texto('Zebra')).toBe('Zebra')
  })

  it('cualquier cosa que no sea cadena cae a vacío', () => {
    expect(texto(null)).toBe('')
    expect(texto(undefined)).toBe('')
    expect(texto(42)).toBe('')
    expect(texto({})).toBe('')
  })
})

describe('incluyeTexto', () => {
  it('encuentra la subcadena en cualquiera de los campos', () => {
    expect(incluyeTexto(['Switch núcleo', '192.168.1.1', 'Rack A'], 'rack')).toBe(true)
    expect(incluyeTexto(['Switch núcleo', '192.168.1.1', 'Rack A'], '168')).toBe(true)
  })

  it('no distingue mayúsculas', () => {
    expect(incluyeTexto(['Impresora Zebra'], 'ZEBRA')).toBe(true)
  })

  // Una consulta vacía no filtra: el buscador en blanco muestra todo.
  it('con la consulta vacía acepta cualquier ficha', () => {
    expect(incluyeTexto(['Impresora'], '')).toBe(true)
    expect(incluyeTexto(['Impresora'], '   ')).toBe(true)
    expect(incluyeTexto([], '')).toBe(true)
  })

  it('devuelve falso cuando no coincide ningún campo', () => {
    expect(incluyeTexto(['Impresora Zebra', 'Bodega'], 'switch')).toBe(false)
  })

  // Las tres pantallas pasaban valores posiblemente ausentes (por
  // ejemplo `nombreCategoria.get(id)`, que puede ser undefined).
  it('tolera campos nulos o ausentes', () => {
    expect(incluyeTexto(['Impresora', null, undefined], 'impresora')).toBe(true)
    expect(incluyeTexto([null, undefined], 'algo')).toBe(false)
  })

  it('recorta los espacios de la consulta', () => {
    expect(incluyeTexto(['Impresora Zebra'], '  zebra  ')).toBe(true)
  })

  // Los campos se unen con un espacio, así que un término no puede
  // atravesar el límite entre dos campos distintos.
  it('no cruza el límite entre dos campos', () => {
    expect(incluyeTexto(['abc', 'def'], 'abcdef')).toBe(false)
    expect(incluyeTexto(['abc', 'def'], 'abc def')).toBe(true)
  })
})
