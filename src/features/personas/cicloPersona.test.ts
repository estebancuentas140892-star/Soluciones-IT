import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import {
  candidatosParaAsignar,
  categoriasQueSeAsignan,
  equiposActuales,
  equiposPorValidar,
  esDeBaja,
  esFechaValida,
  estadoAlAsignar,
  estadoDePersona,
  fechaDeHoy,
  fechaLegible,
  responsablePorValidar,
  sugerirDisponible,
} from './cicloPersona'

function equipo(id: string, datos: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id,
    categoriaId: 'cat-computadores',
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
    estado: 'Operativo',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: '2026-09-23T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  }
}

describe('estado de una persona', () => {
  it('sin estado guardado (fila anterior a la tarea 266) es activa', () => {
    expect(estadoDePersona({ estado: undefined as never })).toBe('activa')
    expect(estadoDePersona({ estado: 'activa' })).toBe('activa')
    expect(estadoDePersona({ estado: 'retirada' })).toBe('retirada')
  })
})

describe('equipos actuales de una persona', () => {
  const dispositivos = [
    equipo('metrojp62', { responsableId: 'p1' }),
    equipo('metrojp41', { responsableId: 'p1', estado: 'De baja' }),
    equipo('metrojp10', { responsableId: 'p1', estado: 'Dado de baja' }),
    equipo('metrojp05', { responsableId: 'p1', eliminadoEn: '2026-09-01T00:00:00.000Z' }),
    equipo('metrojp03', { responsableId: 'p2' }),
    equipo('metrojp01', { responsableId: 'p1', estado: 'En mantenimiento' }),
  ]

  it('solo los que tiene hoy: ni de baja (o su sinónimo) ni eliminados ni de otra persona', () => {
    expect(equiposActuales('p1', dispositivos).map((d) => d.id)).toEqual(['metrojp01', 'metrojp62'])
  })

  it('reconoce "Dado de baja" como el mismo estado que "De baja"', () => {
    expect(esDeBaja({ estado: 'Dado de baja' })).toBe(true)
    expect(esDeBaja({ estado: 'DE BAJA' })).toBe(true)
    expect(esDeBaja({ estado: 'Baja temporal' })).toBe(false)
  })
})

describe('qué estado queda al liberar o asignar un equipo', () => {
  it('un equipo que funcionaba se sugiere Disponible', () => {
    expect(sugerirDisponible('Operativo')).toBe('si')
    expect(sugerirDisponible('OPERATIVO')).toBe('si')
    expect(sugerirDisponible('Disponible')).toBe('si')
  })

  it('si el estado no dice si funciona, se pregunta en vez de suponerlo', () => {
    expect(sugerirDisponible('')).toBe('preguntar')
    expect(sugerirDisponible('Bueno')).toBe('preguntar')
  })

  it('en mantenimiento, fuera de servicio o de baja conserva su estado', () => {
    expect(sugerirDisponible('En mantenimiento')).toBe('no')
    expect(sugerirDisponible('Fuera de servicio')).toBe('no')
    expect(sugerirDisponible('De baja')).toBe('no')
  })

  it('al asignar, un Disponible pasa a Operativo y el resto no cambia', () => {
    expect(estadoAlAsignar('Disponible')).toBe('Operativo')
    expect(estadoAlAsignar('En mantenimiento')).toBe('En mantenimiento')
    expect(estadoAlAsignar('')).toBe('')
  })
})

describe('equipos que se ofrecen al asignar', () => {
  const dispositivos = [
    equipo('pc-b', { responsableId: 'otra' }),
    equipo('pc-a', { estado: 'Disponible' }),
    equipo('pc-c'),
    equipo('pc-d', { estado: 'Fuera de servicio' }),
    equipo('pc-e', { estado: 'De baja' }),
    equipo('pc-f', { responsableId: 'p1' }),
    equipo('switch', { categoriaId: 'cat-red' }),
    equipo('pc-g', { eliminadoEn: '2026-09-01T00:00:00.000Z' }),
  ]

  it('primero los disponibles, luego sin responsable (los que funcionan antes) y al final los de otra persona', () => {
    const candidatos = candidatosParaAsignar(dispositivos, 'p1', new Set(['cat-red']))
    expect(candidatos.map((c) => [c.dispositivo.id, c.grupo])).toEqual([
      ['pc-a', 'disponible'],
      ['pc-c', 'sinResponsable'],
      ['pc-d', 'sinResponsable'],
      ['pc-b', 'deOtraPersona'],
    ])
  })

  it('dentro de cada grupo van primero las categorías que ya se entregan a personas', () => {
    const inventario = [
      equipo('impresora', { categoriaId: 'cat-impresoras' }),
      equipo('pc-z', { categoriaId: 'cat-computadores' }),
      equipo('pc-de-ana', { categoriaId: 'cat-computadores', responsableId: 'ana' }),
    ]
    const habituales = categoriasQueSeAsignan(inventario)
    expect([...habituales]).toEqual(['cat-computadores'])
    const candidatos = candidatosParaAsignar(inventario, 'p1', new Set(), habituales)
    expect(candidatos.filter((c) => c.grupo === 'sinResponsable').map((c) => c.dispositivo.id)).toEqual([
      'pc-z',
      'impresora',
    ])
  })
})

describe('responsable escrito que no es una persona', () => {
  it('se muestra como texto por validar solo si no hay persona vinculada', () => {
    expect(responsablePorValidar(equipo('x', { responsable: 'Archivo' }))).toBe('Archivo')
    expect(responsablePorValidar(equipo('x', { responsable: 'Ana', responsableId: 'p1' }))).toBe('')
    expect(responsablePorValidar(equipo('x', { responsable: '  ' }))).toBe('')
  })

  it('lista los equipos por validar sin resolver ninguno', () => {
    const lista = equiposPorValidar([
      equipo('a', { responsable: 'Archivo' }),
      equipo('b', { responsable: 'Ana Pérez / Luis Gómez' }),
      equipo('c', { responsable: 'Ana', responsableId: 'p1' }),
      equipo('d', { responsable: 'Facturación', estado: 'De baja' }),
    ])
    expect(lista.map((d) => d.id)).toEqual(['a', 'b'])
  })
})

describe('fechas', () => {
  it('hoy con la fecha local del teléfono', () => {
    expect(fechaDeHoy(new Date(2026, 8, 3, 23, 30))).toBe('2026-09-03')
  })

  it('valida una fecha de calendario real', () => {
    expect(esFechaValida('2026-02-28')).toBe(true)
    expect(esFechaValida('2026-02-30')).toBe(false)
    expect(esFechaValida('')).toBe(false)
  })

  it('una fecha de calendario no se corre de día por la zona horaria', () => {
    expect(fechaLegible('2025-03-12')).toBe('12 mar 2025')
  })
})
