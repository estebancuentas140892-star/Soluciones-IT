import { describe, expect, it } from 'vitest'
import { mapaDeTextos, nombreVivo, textoVivo } from './referencia'

describe('textoVivo', () => {
  it('prefiere el dato vivo cuando existe', () => {
    expect(textoVivo('Switch nuevo', 'Switch viejo')).toBe('Switch nuevo')
  })

  it('cae a la copia cuando el vivo es null, undefined o vacío', () => {
    expect(textoVivo(null, 'copia')).toBe('copia')
    expect(textoVivo(undefined, 'copia')).toBe('copia')
    expect(textoVivo('', 'copia')).toBe('copia')
  })

  it('un vivo de solo espacios no gana a una copia con contenido', () => {
    expect(textoVivo('   ', 'copia')).toBe('copia')
  })

  it('recorta el vivo antes de mostrarlo', () => {
    expect(textoVivo('  Switch  ', 'copia')).toBe('Switch')
  })

  it('si ambos están vacíos devuelve la copia (vacía)', () => {
    expect(textoVivo('', '')).toBe('')
  })
})

describe('mapaDeTextos', () => {
  const filas = [
    { id: 'a', nombre: 'Switch A', eliminadoEn: null },
    { id: 'b', nombre: 'Switch B', eliminadoEn: '2026-01-01' },
    { id: 'c', nombre: 'Switch C' },
  ]

  it('mapea id a texto excluyendo las filas eliminadas', () => {
    const mapa = mapaDeTextos(filas, (f) => f.nombre)
    expect(mapa.get('a')).toBe('Switch A')
    expect(mapa.get('c')).toBe('Switch C')
    expect(mapa.has('b')).toBe(false)
  })
})

describe('nombreVivo', () => {
  const mapa = mapaDeTextos(
    [{ id: 'a', titulo: 'Router principal', eliminadoEn: null }],
    (f) => f.titulo,
  )

  it('resuelve el título vivo cuando la fila existe', () => {
    expect(nombreVivo(mapa, 'a', 'Router (copia vieja)')).toBe('Router principal')
  })

  it('cae a la copia cuando la fila no está en el mapa (sin sincronizar o eliminada)', () => {
    expect(nombreVivo(mapa, 'z', 'Nombre de referencia')).toBe('Nombre de referencia')
  })
})
