import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { buscarEquipos, conteosDeChips } from './busquedaEquipos'

// El buscador de Equipos (tarea 256): el inventario general sin texto y,
// al escribir, también los equipos de red, aparte. Todo es inventado.

function equipo(id: string, categoriaId: string, cambios: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id,
    categoriaId,
    nombre: id,
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: '',
    ubicacionId: null,
    responsable: '',
    responsableId: null,
    reemplazaA: null,
    ip: '',
    estado: 'operativo',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: '2026-09-22T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

const RED = new Set(['cat-switches'])
const EQUIPOS = [
  equipo('PC Caja 2', 'cat-pc', { ip: '10.0.0.21', ubicacion: 'Taquilla de prueba' }),
  equipo('PC Caja 10', 'cat-pc', { ip: '10.0.0.30' }),
  equipo('Impresora de prueba', 'cat-impresoras', { marca: 'Zebra', modelo: 'ZD230', placaInventario: 'INV-77' }),
  equipo('SW-CENTRAL-02', 'cat-switches', { ip: '10.0.0.2', ubicacion: 'Rack de prueba' }),
  equipo('PC de baja', 'cat-pc', { eliminadoEn: '2026-09-01T00:00:00.000Z' }),
]

describe('buscarEquipos', () => {
  it('sin texto es el inventario general, sin la red ni lo eliminado, en orden natural', () => {
    const { generales, deRed } = buscarEquipos(EQUIPOS, RED, { texto: '', categoriaId: '' })
    expect(generales.map((d) => d.nombre)).toEqual(['Impresora de prueba', 'PC Caja 2', 'PC Caja 10'])
    expect(deRed).toEqual([])
  })

  it('al escribir también salen los equipos de red, aparte', () => {
    const { generales, deRed } = buscarEquipos(EQUIPOS, RED, { texto: 'central', categoriaId: '' })
    expect(generales).toEqual([])
    expect(deRed.map((d) => d.nombre)).toEqual(['SW-CENTRAL-02'])
  })

  it('la IP de la red coincide con equipos de los dos lados', () => {
    const { generales, deRed } = buscarEquipos(EQUIPOS, RED, { texto: '10.0.0.2', categoriaId: '' })
    expect(generales.map((d) => d.nombre)).toEqual(['PC Caja 2'])
    expect(deRed.map((d) => d.nombre)).toEqual(['SW-CENTRAL-02'])
  })

  it('con un chip de categoría no salen los de red: no pueden estar en ella', () => {
    const { generales, deRed } = buscarEquipos(EQUIPOS, RED, { texto: '10.0.0', categoriaId: 'cat-pc' })
    expect(generales.map((d) => d.nombre)).toEqual(['PC Caja 2', 'PC Caja 10'])
    expect(deRed).toEqual([])
  })

  it('busca también por placa, marca y modelo', () => {
    expect(buscarEquipos(EQUIPOS, RED, { texto: 'inv-77', categoriaId: '' }).generales).toHaveLength(1)
    expect(buscarEquipos(EQUIPOS, RED, { texto: 'zebra', categoriaId: '' }).generales).toHaveLength(1)
    expect(buscarEquipos(EQUIPOS, RED, { texto: 'zd230', categoriaId: '' }).generales).toHaveLength(1)
  })
})

describe('conteosDeChips', () => {
  it('"Todos" promete también los de red que salen al escribir; cada categoría, los suyos', () => {
    const { todos, porCategoria } = conteosDeChips(EQUIPOS, RED, '10.0.0.2')
    expect(todos).toBe(2)
    expect(porCategoria.get('cat-pc')).toBe(1)
    expect(porCategoria.has('cat-switches')).toBe(false)
  })

  it('sin texto cuenta solo el inventario general', () => {
    expect(conteosDeChips(EQUIPOS, RED, '').todos).toBe(3)
  })
})
