import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { buscarEquipos, chipsDeEquipos, CHIP_RED, conteosDeChips } from './busquedaEquipos'

// LA FILA DE CATEGORÍAS DE EQUIPOS, BUSCANDO (tarea 363, D3 de la auditoría
// del 2026-10-27). Sin texto, como siempre; con texto, solo lo que sirve, la
// elegida aunque quede en 0 y «Red». Todo es inventado.

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
    updatedAt: '2026-10-27T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

const RED = new Set(['cat-switches'])
const CATEGORIAS = [
  { id: 'cat-pos', nombre: 'POS' },
  { id: 'cat-impresoras', nombre: 'Impresoras' },
  { id: 'cat-pc', nombre: 'Computadores' },
]
const EQUIPOS = [
  equipo('PC-COMPRAS-04', 'cat-pc', { ubicacion: 'Parque de prueba' }),
  equipo('PORT-COMPRAS-07', 'cat-pc', { ubicacion: 'Parque de prueba' }),
  equipo('POS-TAQ-01', 'cat-pos', { ubicacion: 'Parque de prueba' }),
  equipo('Impresora Mercadeo', 'cat-impresoras', { ubicacion: 'Sede de prueba' }),
  equipo('SW-PARQUE-01', 'cat-switches', { ubicacion: 'Parque de prueba' }),
]

const nombres = (chips: ReturnType<typeof chipsDeEquipos>) => chips.map((c) => `${c.nombre} ${c.cantidad}`)

describe('conteosDeChips con «Red»', () => {
  it('los números suman «Todos»: cada categoría y los de red', () => {
    const conteos = conteosDeChips(EQUIPOS, RED, 'parque')
    expect(conteos.todos).toBe(4)
    expect(conteos.porCategoria.get('cat-pc')).toBe(2)
    expect(conteos.porCategoria.get('cat-pos')).toBe(1)
    expect(conteos.red).toBe(1)
    expect([...conteos.porCategoria.values()].reduce((a, b) => a + b, 0) + conteos.red).toBe(conteos.todos)
  })
})

describe('chipsDeEquipos', () => {
  it('sin texto, todas las categorías generales, también las vacías, y sin «Red»', () => {
    const conteos = conteosDeChips(EQUIPOS, RED, '')
    expect(nombres(chipsDeEquipos(CATEGORIAS, conteos, { conTexto: false, categoriaId: '' }))).toEqual([
      'Todos 4',
      'POS 1',
      'Impresoras 1',
      'Computadores 2',
    ])
  })

  it('con texto, «Todos» y solo las categorías con resultados, en su orden de siempre', () => {
    const conteos = conteosDeChips(EQUIPOS, RED, 'compras')
    expect(nombres(chipsDeEquipos(CATEGORIAS, conteos, { conTexto: true, categoriaId: '' }))).toEqual([
      'Todos 2',
      'Computadores 2',
    ])
  })

  it('la elegida se queda aunque quede en 0', () => {
    const conteos = conteosDeChips(EQUIPOS, RED, 'compras')
    expect(nombres(chipsDeEquipos(CATEGORIAS, conteos, { conTexto: true, categoriaId: 'cat-impresoras' }))).toEqual([
      'Todos 2',
      'Impresoras 0',
      'Computadores 2',
    ])
  })

  it('«Red», separado y al final, si coinciden equipos de red', () => {
    const conteos = conteosDeChips(EQUIPOS, RED, 'parque')
    const chips = chipsDeEquipos(CATEGORIAS, conteos, { conTexto: true, categoriaId: '' })
    expect(nombres(chips)).toEqual(['Todos 4', 'POS 1', 'Computadores 2', 'Red 1'])
    expect(chips.at(-1)).toMatchObject({ id: CHIP_RED, separado: true })
  })

  it('sin coincidencias, solo «Todos 0»', () => {
    const conteos = conteosDeChips(EQUIPOS, RED, 'zzz')
    expect(nombres(chipsDeEquipos(CATEGORIAS, conteos, { conTexto: true, categoriaId: '' }))).toEqual(['Todos 0'])
  })
})

describe('buscarEquipos con el chip «Red»', () => {
  it('buscando, solo los de red', () => {
    const { generales, deRed } = buscarEquipos(EQUIPOS, RED, { texto: 'parque', categoriaId: CHIP_RED })
    expect(generales).toEqual([])
    expect(deRed.map((d) => d.nombre)).toEqual(['SW-PARQUE-01'])
  })

  it('sin texto no hay chip «Red»: vale como «Todos»', () => {
    const { generales, deRed } = buscarEquipos(EQUIPOS, RED, { texto: '', categoriaId: CHIP_RED })
    expect(generales).toHaveLength(4)
    expect(deRed).toEqual([])
  })
})
