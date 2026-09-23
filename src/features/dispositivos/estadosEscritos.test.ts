import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { cambiosDeEstado, cuantosEstadosPorUnificar, estadosPorUnificar, sugerenciaDeEstado } from './estadosEscritos'

function equipo(id: string, estado: string, eliminadoEn: string | null = null): Dispositivo {
  return { id, estado, eliminadoEn } as Dispositivo
}

describe('estados escritos a mano', () => {
  const inventario = [
    equipo('1', 'Operativo'),
    equipo('2', 'OPERATIVO'),
    equipo('3', 'operativo '),
    equipo('4', 'Activo'),
    equipo('5', 'ACTIVO'),
    equipo('6', 'Dado de baja'),
    equipo('7', 'Pendiente de revisar'),
    equipo('8', ''),
    equipo('9', 'Dañado'),
    equipo('10', 'Asignado'),
    equipo('11', 'ACTIVO', '2026-01-01T00:00:00.000Z'),
  ]

  it('lo ya escrito como en la lista y los equipos sin estado no aparecen', () => {
    const textos = estadosPorUnificar(inventario)
    expect(textos.some((t) => t.variantes.includes('Operativo'))).toBe(false)
    expect(textos.some((t) => t.texto === '')).toBe(false)
  })

  it('primero las equivalencias seguras, luego lo que tiene sugerencia y al final lo demás', () => {
    const textos = estadosPorUnificar(inventario)
    expect(textos.map((t) => [t.texto, t.cantidad, t.canonico, t.sugerido])).toEqual([
      ['OPERATIVO', 2, 'Operativo', null],
      ['Dado de baja', 1, 'De baja', null],
      ['Activo', 2, null, 'Operativo'],
      ['Dañado', 1, null, 'Fuera de servicio'],
      ['Asignado', 1, null, null],
      ['Pendiente de revisar', 1, null, null],
    ])
    expect(textos[0].variantes).toEqual(['OPERATIVO', 'operativo'])
  })

  it('una sugerencia es solo una sugerencia: palabras que no dicen si funciona no sugieren nada', () => {
    expect(sugerenciaDeEstado('En uso')).toBe('Operativo')
    expect(sugerenciaDeEstado('En reparación')).toBe('En mantenimiento')
    expect(sugerenciaDeEstado('Inactivo')).toBeNull()
    expect(sugerenciaDeEstado('Asignado')).toBeNull()
  })

  it('solo cambia lo que el técnico eligió', () => {
    const elecciones = new Map([
      ['operativo', 'Operativo'],
      ['activo', 'Operativo'],
    ])
    expect(cambiosDeEstado(inventario, elecciones)).toEqual([
      { dispositivoId: '2', de: 'OPERATIVO', a: 'Operativo' },
      { dispositivoId: '3', de: 'operativo ', a: 'Operativo' },
      { dispositivoId: '4', de: 'Activo', a: 'Operativo' },
      { dispositivoId: '5', de: 'ACTIVO', a: 'Operativo' },
    ])
  })

  it('cuenta equipos, no textos', () => {
    expect(cuantosEstadosPorUnificar(inventario)).toBe(8)
  })
})
