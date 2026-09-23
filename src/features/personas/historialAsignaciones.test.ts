import { describe, expect, it } from 'vitest'
import type { HistorialEntrada } from '../../lib/db'
import { asignadoDesde, equiposAnteriores, periodosDeAsignacion, responsablesAnteriores } from './historialAsignaciones'

let secuencia = 0
function cambio(
  dispositivoId: string,
  anterior: string,
  nuevo: string,
  fechaHora: string,
  motivo = '',
): HistorialEntrada {
  secuencia += 1
  return {
    id: `h${secuencia}`,
    entidadTipo: 'dispositivo',
    entidadId: dispositivoId,
    usuario: null,
    usuarioNombre: '',
    fechaHora,
    campo: 'responsableId',
    valorAnterior: anterior,
    valorNuevo: nuevo,
    motivo,
  }
}

describe('periodos de asignación reconstruidos del historial', () => {
  it('asignar, liberar y reasignar dejan periodos con sus dos fechas', () => {
    const periodos = periodosDeAsignacion([
      cambio('jp41', '', 'ana', '2025-02-01T10:00:00.000Z'),
      cambio('jp41', 'ana', '', '2026-03-15T10:00:00.000Z', 'Retiro de Ana'),
      cambio('jp41', '', 'luis', '2026-04-01T10:00:00.000Z'),
    ])
    expect(periodos).toEqual([
      {
        dispositivoId: 'jp41',
        personaId: 'ana',
        desde: '2025-02-01T10:00:00.000Z',
        hasta: '2026-03-15T10:00:00.000Z',
        motivoFin: 'Retiro de Ana',
      },
      { dispositivoId: 'jp41', personaId: 'luis', desde: '2026-04-01T10:00:00.000Z', hasta: null, motivoFin: '' },
    ])
  })

  it('no inventa el comienzo de una asignación anterior a los registros', () => {
    // El inventario institucional asignó el equipo antes de que el
    // historial guardara ids: solo consta cuándo se soltó.
    const periodos = periodosDeAsignacion([cambio('jp10', 'ana', 'luis', '2026-09-23T10:00:00.000Z')])
    expect(periodos[0]).toMatchObject({ personaId: 'ana', desde: null, hasta: '2026-09-23T10:00:00.000Z' })
    expect(periodos[1]).toMatchObject({ personaId: 'luis', desde: '2026-09-23T10:00:00.000Z', hasta: null })
  })

  it('ordena por fecha aunque las entradas lleguen desordenadas por la sincronización', () => {
    const periodos = periodosDeAsignacion([
      cambio('jp41', 'ana', '', '2026-03-15T10:00:00.000Z'),
      cambio('jp41', '', 'ana', '2025-02-01T10:00:00.000Z'),
    ])
    expect(periodos).toHaveLength(1)
    expect(periodos[0]).toMatchObject({ desde: '2025-02-01T10:00:00.000Z', hasta: '2026-03-15T10:00:00.000Z' })
  })

  it('un equipo nunca tiene dos responsables a la vez, aunque falte la entrada de salida', () => {
    const periodos = periodosDeAsignacion([
      cambio('jp41', '', 'ana', '2026-01-01T10:00:00.000Z'),
      cambio('jp41', '', 'luis', '2026-02-01T10:00:00.000Z'),
    ])
    expect(periodos[0]).toMatchObject({ personaId: 'ana', hasta: '2026-02-01T10:00:00.000Z' })
    expect(periodos[1]).toMatchObject({ personaId: 'luis', hasta: null })
  })

  it('la misma asignación registrada dos veces no parte el periodo', () => {
    const periodos = periodosDeAsignacion([
      cambio('jp41', '', 'ana', '2026-01-01T10:00:00.000Z'),
      cambio('jp41', '', 'ana', '2026-01-01T10:05:00.000Z'),
    ])
    expect(periodos).toEqual([
      { dispositivoId: 'jp41', personaId: 'ana', desde: '2026-01-01T10:00:00.000Z', hasta: null, motivoFin: '' },
    ])
  })

  it('ignora el resto del historial (el nombre, otros campos, otras entidades)', () => {
    const periodos = periodosDeAsignacion([
      { ...cambio('jp41', '', 'Ana Pérez', '2026-01-01T10:00:00.000Z'), campo: 'responsable' },
      { ...cambio('p1', 'activa', 'retirada', '2026-01-01T10:00:00.000Z'), entidadTipo: 'persona', campo: 'estado' },
    ])
    expect(periodos).toEqual([])
  })
})

describe('preguntas de la ficha', () => {
  const periodos = periodosDeAsignacion([
    cambio('jp41', '', 'ana', '2025-02-01T10:00:00.000Z'),
    cambio('jp41', 'ana', 'luis', '2026-03-15T10:00:00.000Z'),
    cambio('jp62', '', 'ana', '2026-03-15T10:00:00.000Z'),
    cambio('jp07', 'ana', '', '2024-06-01T10:00:00.000Z'),
  ])

  it('¿qué equipos tuvo esta persona?, del más reciente al más antiguo', () => {
    expect(equiposAnteriores('ana', periodos).map((p) => [p.dispositivoId, p.desde, p.hasta])).toEqual([
      ['jp41', '2025-02-01T10:00:00.000Z', '2026-03-15T10:00:00.000Z'],
      ['jp07', null, '2024-06-01T10:00:00.000Z'],
    ])
  })

  it('¿quién tuvo este equipo antes?', () => {
    expect(responsablesAnteriores('jp41', periodos).map((p) => p.personaId)).toEqual(['ana'])
  })

  it('¿desde cuándo lo tiene?, solo si el registro lo dice', () => {
    expect(asignadoDesde('ana', 'jp62', periodos)).toBe('2026-03-15T10:00:00.000Z')
    expect(asignadoDesde('luis', 'jp41', periodos)).toBe('2026-03-15T10:00:00.000Z')
    expect(asignadoDesde('ana', 'jp99', periodos)).toBeNull()
  })
})
