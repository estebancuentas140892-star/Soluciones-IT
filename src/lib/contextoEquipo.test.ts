import { describe, expect, it } from 'vitest'
import { contextoVisible, lineaDeContexto, lineasDeContexto, nombreYaLoDice, ubicacionDeEquipo } from './contextoEquipo'

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

  it('"Impresora HP" dice la categoría pero no el lugar: queda la ubicación', () => {
    expect(lineaDeContexto('Impresora HP', ['Impresoras', 'Taquilla'])).toBe('Taquilla')
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

  it('una IP o un código nunca se callan, aunque sus números estén en el nombre', () => {
    expect(lineaDeContexto('Switch 192 168', ['192.168.1.20'])).toBe('192.168.1.20')
    expect(lineaDeContexto('Caja 2 Taquilla', ['Placa 2'])).toBe('Placa 2')
  })
})

describe('lineasDeContexto: en una lista, callar nunca vuelve iguales dos equipos distintos', () => {
  it('fila por fila, lo mismo que lineaDeContexto', () => {
    expect(
      lineasDeContexto([
        { nombre: 'Impresora Taquilla', partes: ['Impresoras', 'Taquilla'] },
        { nombre: 'HP M404', partes: ['Impresoras', 'Taquilla'] },
      ]),
    ).toEqual(['', 'Impresoras · Taquilla'])
  })

  it('dos con el mismo nombre en lugares que el nombre ya dice: se muestran los lugares', () => {
    const filas = [
      { nombre: 'Switch Taquilla Norte', partes: ['Taquilla'] },
      { nombre: 'Switch Taquilla Norte', partes: ['Taquilla Norte'] },
    ]
    expect(filas.map((f) => lineaDeContexto(f.nombre, f.partes))).toEqual(['', ''])
    expect(lineasDeContexto(filas)).toEqual(['Taquilla', 'Taquilla Norte'])
  })

  it('dos iguales de verdad (mismo nombre y mismo contexto) se quedan cortos: mostrar no los distinguiría', () => {
    const fila = { nombre: 'Impresora Taquilla', partes: ['Impresoras', 'Taquilla'] }
    expect(lineasDeContexto([fila, fila])).toEqual(['', ''])
  })
})

describe('ubicacionDeEquipo: la ubicación vinculada manda', () => {
  it('vinculada y viva: su nombre de hoy, aunque el texto del equipo sea viejo', () => {
    expect(ubicacionDeEquipo({ ubicacion: 'taquilla' }, { nombre: 'Taquilla Principal', eliminadoEn: null })).toBe(
      'Taquilla Principal',
    )
  })

  it('sin vínculo, eliminada o aún sin sincronizar: el texto heredado', () => {
    expect(ubicacionDeEquipo({ ubicacion: 'Bodega' }, null)).toBe('Bodega')
    expect(ubicacionDeEquipo({ ubicacion: 'Bodega' }, undefined)).toBe('Bodega')
    expect(ubicacionDeEquipo({ ubicacion: 'Bodega' }, { nombre: 'Bodega 2', eliminadoEn: '2026-09-01T00:00:00Z' })).toBe(
      'Bodega',
    )
    expect(ubicacionDeEquipo({ ubicacion: '' }, null)).toBe('')
  })
})
