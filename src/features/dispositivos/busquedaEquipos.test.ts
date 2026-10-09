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

describe('buscarEquipos por la persona responsable', () => {
  // Se conoce a la persona antes que el nombre de su equipo. Se busca por
  // la copia legible `responsable`, con la misma regla que los demás campos.
  const CON_PERSONAS = [
    equipo('PC Contabilidad', 'cat-pc', {
      responsable: 'Johana Carolina Pérez',
      responsableId: 'persona-1',
      ip: '10.0.1.15',
      serial: 'SN-4821',
    }),
    equipo('Portátil de prueba', 'cat-portatiles', {
      responsable: 'Esteban Ríos',
      responsableId: 'persona-2',
      marca: 'Lenovo',
      modelo: 'T14',
      placaInventario: 'INV-90',
    }),
    equipo('SW-PISO-3', 'cat-switches', { responsable: 'Carolina Gómez', responsableId: 'persona-3' }),
    equipo('PC retirada', 'cat-pc', {
      responsable: 'Johana Carolina Pérez',
      responsableId: 'persona-1',
      eliminadoEn: '2026-09-01T00:00:00.000Z',
    }),
  ]
  const nombres = (texto: string, categoriaId = '') =>
    buscarEquipos(CON_PERSONAS, RED, { texto, categoriaId }).generales.map((d) => d.nombre)

  it('lo encuentra por un nombre, un apellido, el nombre completo o una parte', () => {
    for (const texto of ['johana', 'carolina', 'pérez', 'Johana Carolina Pérez', 'JOHANA', 'caro']) {
      expect(nombres(texto)).toEqual(['PC Contabilidad'])
    }
    expect(nombres('esteban')).toEqual(['Portátil de prueba'])
  })

  it('un equipo eliminado no aparece aunque la persona coincida', () => {
    const { generales, deRed } = buscarEquipos(CON_PERSONAS, RED, { texto: 'johana', categoriaId: '' })
    expect([...generales, ...deRed].map((d) => d.nombre)).not.toContain('PC retirada')
  })

  it('un equipo de red de esa persona sale aparte, y con un chip no sale', () => {
    const { generales, deRed } = buscarEquipos(CON_PERSONAS, RED, { texto: 'carolina', categoriaId: '' })
    expect(generales.map((d) => d.nombre)).toEqual(['PC Contabilidad'])
    expect(deRed.map((d) => d.nombre)).toEqual(['SW-PISO-3'])
    expect(conteosDeChips(CON_PERSONAS, RED, 'carolina').todos).toBe(2)

    const conChip = buscarEquipos(CON_PERSONAS, RED, { texto: 'carolina', categoriaId: 'cat-pc' })
    expect(conChip.generales.map((d) => d.nombre)).toEqual(['PC Contabilidad'])
    expect(conChip.deRed).toEqual([])
    expect(nombres('carolina', 'cat-portatiles')).toEqual([])
  })

  it('sigue encontrando por nombre, IP, serial, placa, marca y modelo', () => {
    expect(nombres('contabilidad')).toEqual(['PC Contabilidad'])
    expect(nombres('10.0.1.15')).toEqual(['PC Contabilidad'])
    expect(nombres('sn-4821')).toEqual(['PC Contabilidad'])
    expect(nombres('inv-90')).toEqual(['Portátil de prueba'])
    expect(nombres('lenovo')).toEqual(['Portátil de prueba'])
    expect(nombres('t14')).toEqual(['Portátil de prueba'])
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
