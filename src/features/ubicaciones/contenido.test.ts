import { describe, expect, it } from 'vitest'
import type { Categoria, Dispositivo, Ubicacion } from '../../lib/db'
import { contenidoDeUbicacion, totalConSububicaciones } from './contenido'

function equipo(id: string, categoriaId: string, datos: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id,
    nombre: id,
    categoriaId,
    ubicacionId: 'u-mant',
    estado: 'Operativo',
    eliminadoEn: null,
    ...datos,
  } as Dispositivo
}

const categorias = [
  { id: 'cat-pc', nombre: 'Computadores', orden: 1 },
  { id: 'cat-imp', nombre: 'Impresoras', orden: 2 },
  { id: 'cat-sw', nombre: 'Switches', orden: 5 },
  { id: 'cat-pto', nombre: 'Puntos de red', orden: 6 },
] as Categoria[]

describe('¿qué hay aquí?', () => {
  const dispositivos = [
    equipo('PC-10', 'cat-pc'),
    equipo('PC-2', 'cat-pc'),
    equipo('SW-1', 'cat-sw'),
    equipo('IMP-1', 'cat-imp'),
    equipo('PT-7', 'cat-pto'),
    equipo('PC-VIEJO', 'cat-pc', { estado: 'De baja' }),
    equipo('PC-BORRADO', 'cat-pc', { eliminadoEn: '2026-01-01T00:00:00.000Z' }),
    equipo('PC-OTRO-LUGAR', 'cat-pc', { ubicacionId: 'u-otro' }),
    equipo('RARO', 'cat-inexistente'),
  ]

  it('agrupa por la categoría real, en su orden, y por nombre dentro de cada grupo', () => {
    const contenido = contenidoDeUbicacion('u-mant', dispositivos, categorias)
    expect(contenido.grupos.map((g) => [g.titulo, g.equipos.map((e) => e.id)])).toEqual([
      ['Computadores', ['PC-2', 'PC-10']],
      ['Impresoras', ['IMP-1']],
      ['Switches', ['SW-1']],
      ['Puntos de red', ['PT-7']],
      ['Sin categoría', ['RARO']],
    ])
  })

  it('los de baja van aparte; los eliminados y los de otro lugar no están', () => {
    const contenido = contenidoDeUbicacion('u-mant', dispositivos, categorias)
    expect(contenido.deBaja.map((e) => e.id)).toEqual(['PC-VIEJO'])
    expect(contenido.total).toBe(7)
  })
})

describe('total con sububicaciones', () => {
  it('suma los equipos de toda la rama, sin inventar jerarquía', () => {
    const ubicaciones = [
      { id: 'sede', padreId: null, eliminadoEn: null },
      { id: 'area', padreId: 'sede', eliminadoEn: null },
      { id: 'otra', padreId: null, eliminadoEn: null },
    ] as Ubicacion[]
    const dispositivos = [
      { ubicacionId: 'sede', eliminadoEn: null },
      { ubicacionId: 'area', eliminadoEn: null },
      { ubicacionId: 'area', eliminadoEn: null },
      { ubicacionId: 'otra', eliminadoEn: null },
      { ubicacionId: 'area', eliminadoEn: '2026-01-01T00:00:00.000Z' },
    ] as Dispositivo[]
    expect(totalConSububicaciones('sede', ubicaciones, dispositivos)).toBe(3)
    expect(totalConSububicaciones('area', ubicaciones, dispositivos)).toBe(2)
  })
})
