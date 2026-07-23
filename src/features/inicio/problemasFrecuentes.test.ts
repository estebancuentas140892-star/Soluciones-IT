import { describe, expect, it } from 'vitest'
import type { Diagnostico, EjecucionDiagnostico } from '../../lib/db'
import { problemasFrecuentesInicio } from './problemasFrecuentes'

function diagnostico(cambios: Partial<Diagnostico> & { id: string }): Diagnostico {
  return {
    categoriaId: 'cat-1',
    titulo: 'Diagnóstico',
    descripcion: '',
    nodos: [],
    updatedAt: '2026-07-01T00:00:00Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

function ejecucion(cambios: Partial<EjecucionDiagnostico> & { id: string; diagnosticoId: string }): EjecucionDiagnostico {
  return {
    diagnosticoTitulo: 'Diagnóstico',
    usuario: null,
    usuarioNombre: 'Ana',
    camino: [],
    articulosEjecutados: [],
    resuelto: 'si',
    duracionSegundos: 60,
    fechaHora: '2026-07-20T10:00:00.000Z',
    motivo: '',
    solucionPropuesta: '',
    ...cambios,
  }
}

describe('problemasFrecuentesInicio', () => {
  it('sin ejecuciones cae al fallback de los diagnósticos más recientes', () => {
    const filas = problemasFrecuentesInicio(
      [],
      [
        diagnostico({ id: 'a', titulo: 'Viejo', updatedAt: '2026-07-01T00:00:00Z' }),
        diagnostico({ id: 'b', titulo: 'Nuevo', updatedAt: '2026-07-20T00:00:00Z' }),
      ],
    )
    expect(filas.map((f) => f.titulo)).toEqual(['Nuevo', 'Viejo'])
    expect(filas.every((f) => f.ejecuciones === null)).toBe(true)
  })

  // El motivo de existir del fallback: con una sola ejecución en toda la
  // base, "más frecuente" ya es una señal real (a diferencia de cero).
  it('con al menos una ejecución usa la frecuencia real, no el fallback', () => {
    const filas = problemasFrecuentesInicio(
      [ejecucion({ id: '1', diagnosticoId: 'a' })],
      [diagnostico({ id: 'a', titulo: 'Sin red' }), diagnostico({ id: 'b', titulo: 'Nunca ejecutado' })],
    )
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ diagnosticoId: 'a', ejecuciones: 1 })
  })

  it('ordena por cantidad de ejecuciones', () => {
    const filas = problemasFrecuentesInicio(
      [
        ejecucion({ id: '1', diagnosticoId: 'a' }),
        ejecucion({ id: '2', diagnosticoId: 'b' }),
        ejecucion({ id: '3', diagnosticoId: 'b' }),
      ],
      [diagnostico({ id: 'a', titulo: 'A' }), diagnostico({ id: 'b', titulo: 'B' })],
    )
    expect(filas.map((f) => f.diagnosticoId)).toEqual(['b', 'a'])
  })

  it('omite un diagnóstico cuya ejecución quedó registrada pero ya fue eliminado', () => {
    const filas = problemasFrecuentesInicio(
      [ejecucion({ id: '1', diagnosticoId: 'eliminado', diagnosticoTitulo: 'Ya no existe' })],
      [],
    )
    expect(filas).toEqual([])
  })

  // Regla de referencia viva (src/lib/referencia.ts): el título mostrado
  // es el actual de la ficha, no el que quedó congelado en la ejecución.
  it('usa el título vivo del diagnóstico, no la copia congelada', () => {
    const filas = problemasFrecuentesInicio(
      [ejecucion({ id: '1', diagnosticoId: 'a', diagnosticoTitulo: 'Nombre viejo' })],
      [diagnostico({ id: 'a', titulo: 'Nombre actual' })],
    )
    expect(filas[0].titulo).toBe('Nombre actual')
  })

  it('respeta el límite en ambos modos', () => {
    const diagnosticos = [
      diagnostico({ id: 'a', titulo: 'A' }),
      diagnostico({ id: 'b', titulo: 'B' }),
      diagnostico({ id: 'c', titulo: 'C' }),
    ]
    expect(problemasFrecuentesInicio([], diagnosticos, 2)).toHaveLength(2)
    expect(
      problemasFrecuentesInicio(
        [
          ejecucion({ id: '1', diagnosticoId: 'a' }),
          ejecucion({ id: '2', diagnosticoId: 'b' }),
          ejecucion({ id: '3', diagnosticoId: 'c' }),
        ],
        diagnosticos,
        2,
      ),
    ).toHaveLength(2)
  })

  it('sin diagnósticos ni ejecuciones devuelve una lista vacía', () => {
    expect(problemasFrecuentesInicio([], [])).toEqual([])
  })
})
