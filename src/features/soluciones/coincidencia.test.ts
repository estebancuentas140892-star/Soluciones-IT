import { describe, expect, it } from 'vitest'
import type { Articulo } from '../../lib/db'
import { coincidenciaArticulo, partirTitulo } from './coincidencia'

describe('partirTitulo', () => {
  it('deja el título entero en pre cuando no hay consulta', () => {
    expect(partirTitulo('Instalar Zebra', '')).toEqual({ pre: 'Instalar Zebra', match: '', post: '' })
  })

  it('deja el título entero en pre cuando la consulta no aparece', () => {
    expect(partirTitulo('Instalar Zebra', 'switch')).toEqual({
      pre: 'Instalar Zebra',
      match: '',
      post: '',
    })
  })

  it('parte en tres tramos y conserva mayúsculas y acentos del original', () => {
    expect(partirTitulo('Consola de Cámaras', 'camaras')).toEqual({
      pre: 'Consola de ',
      match: 'Cámaras',
      post: '',
    })
  })

  it('resalta la primera aparición cuando el término se repite', () => {
    expect(partirTitulo('Zebra y otra Zebra', 'zebra')).toEqual({
      pre: '',
      match: 'Zebra',
      post: ' y otra Zebra',
    })
  })
})

// Solo los campos que mira la función; el resto de Articulo no influye.
function articulo(parcial: Partial<Articulo>): Articulo {
  return {
    titulo: 'Instalar impresora Zebra ZT411',
    tipo: 'instalacion',
    etiquetas: [],
    ...parcial,
  } as Articulo
}

describe('coincidenciaArticulo', () => {
  it('no coincide con una consulta vacía', () => {
    expect(coincidenciaArticulo(articulo({}), '', 'Impresoras')).toBeNull()
  })

  it('devuelve null cuando no coincide en ningún campo', () => {
    expect(coincidenciaArticulo(articulo({}), 'switch', 'Impresoras')).toBeNull()
  })

  it('coincide en el título sin pedir explicación (se resalta ahí)', () => {
    expect(coincidenciaArticulo(articulo({}), 'zebra', 'Impresoras')).toEqual({
      enTitulo: true,
      donde: null,
      valor: null,
    })
  })

  it('explica la coincidencia por etiqueta y devuelve la etiqueta real', () => {
    const a = articulo({ titulo: 'Alinear el sensor de etiqueta', etiquetas: ['Zebra', 'taquilla'] })
    expect(coincidenciaArticulo(a, 'zebra', 'Impresoras')).toEqual({
      enTitulo: false,
      donde: 'la etiqueta',
      valor: 'Zebra',
    })
  })

  it('explica la coincidencia por categoría', () => {
    const a = articulo({ titulo: 'Alinear el sensor' })
    expect(coincidenciaArticulo(a, 'impresora', 'Impresoras')).toEqual({
      enTitulo: false,
      donde: 'la categoría',
      valor: 'Impresoras',
    })
  })

  it('explica la coincidencia por tipo, con la etiqueta legible del tipo', () => {
    const a = articulo({ titulo: 'Alinear el sensor', tipo: 'mantenimiento' })
    expect(coincidenciaArticulo(a, 'mantenim', 'Impresoras')).toEqual({
      enTitulo: false,
      donde: 'el tipo',
      valor: 'Mantenimiento',
    })
  })

  // El buscador de Soluciones compara en texto normalizado: quien escribe
  // "camaras" sin tilde en el teclado del teléfono debe encontrar "Cámaras".
  it('ignora acentos y mayúsculas al comparar', () => {
    const a = articulo({ titulo: 'Consola de cámaras' })
    expect(coincidenciaArticulo(a, 'camaras', 'Cámaras')?.enTitulo).toBe(true)
  })

  it('prioriza el título sobre la etiqueta cuando coinciden los dos', () => {
    const a = articulo({ titulo: 'Instalar Zebra', etiquetas: ['zebra'] })
    expect(coincidenciaArticulo(a, 'zebra', 'Impresoras')?.enTitulo).toBe(true)
  })

  it('prioriza la etiqueta sobre la categoría, que es más específica', () => {
    const a = articulo({ titulo: 'Alinear el sensor', etiquetas: ['impresora fiscal'] })
    expect(coincidenciaArticulo(a, 'impresora', 'Impresoras')).toEqual({
      enTitulo: false,
      donde: 'la etiqueta',
      valor: 'impresora fiscal',
    })
  })

  it('tolera un artículo sin etiquetas', () => {
    const a = { ...articulo({ titulo: 'Alinear el sensor' }), etiquetas: undefined } as unknown as Articulo
    expect(coincidenciaArticulo(a, 'impresora', 'Impresoras')?.donde).toBe('la categoría')
  })
})
