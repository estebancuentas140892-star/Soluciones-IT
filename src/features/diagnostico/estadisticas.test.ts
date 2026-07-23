import { describe, expect, it } from 'vitest'
import type { EjecucionDiagnostico } from '../../lib/db'
import {
  formatearDuracion,
  formatearPorcentaje,
  motivosDeFallo,
  problemasMasFrecuentes,
  procedimientosMasUsados,
  resumirEjecuciones,
} from './estadisticas'

function ejecucion(parcial: Partial<EjecucionDiagnostico> & { id: string }): EjecucionDiagnostico {
  return {
    diagnosticoId: 'd1',
    diagnosticoTitulo: 'La impresora no imprime',
    usuario: null,
    usuarioNombre: 'Ana',
    camino: [],
    articulosEjecutados: [],
    resuelto: 'si',
    duracionSegundos: 120,
    fechaHora: '2026-07-20T10:00:00.000Z',
    motivo: '',
    solucionPropuesta: '',
    ...parcial,
  }
}

describe('resumirEjecuciones', () => {
  it('cuenta cada desenlace por separado', () => {
    const resumen = resumirEjecuciones([
      ejecucion({ id: '1', resuelto: 'si' }),
      ejecucion({ id: '2', resuelto: 'no' }),
      ejecucion({ id: '3', resuelto: 'abandonado' }),
      ejecucion({ id: '4', resuelto: 'si' }),
    ])
    expect(resumen.total).toBe(4)
    expect(resumen.resueltas).toBe(2)
    expect(resumen.noResueltas).toBe(1)
    expect(resumen.abandonadas).toBe(1)
  })

  // La decisión de diseño principal del módulo: una abandonada no es un
  // fracaso del diagnóstico, así que no entra en la tasa.
  it('la tasa de éxito ignora las abandonadas', () => {
    const resumen = resumirEjecuciones([
      ejecucion({ id: '1', resuelto: 'si' }),
      ejecucion({ id: '2', resuelto: 'no' }),
      ejecucion({ id: '3', resuelto: 'abandonado' }),
      ejecucion({ id: '4', resuelto: 'abandonado' }),
    ])
    expect(resumen.tasaExito).toBe(0.5)
  })

  it('sin ejecuciones cerradas la tasa es null, no cero', () => {
    expect(resumirEjecuciones([]).tasaExito).toBeNull()
    expect(resumirEjecuciones([ejecucion({ id: '1', resuelto: 'abandonado' })]).tasaExito).toBeNull()
  })

  it('la duración es la mediana de las resueltas', () => {
    const resumen = resumirEjecuciones([
      ejecucion({ id: '1', resuelto: 'si', duracionSegundos: 60 }),
      ejecucion({ id: '2', resuelto: 'si', duracionSegundos: 120 }),
      ejecucion({ id: '3', resuelto: 'si', duracionSegundos: 300 }),
    ])
    expect(resumen.duracionMedianaSegundos).toBe(120)
  })

  it('con un número par de resueltas promedia las dos centrales', () => {
    const resumen = resumirEjecuciones([
      ejecucion({ id: '1', resuelto: 'si', duracionSegundos: 60 }),
      ejecucion({ id: '2', resuelto: 'si', duracionSegundos: 140 }),
    ])
    expect(resumen.duracionMedianaSegundos).toBe(100)
  })

  // El motivo de usar mediana y no promedio: una ejecución olvidada
  // abierta no debe mover el número que se muestra.
  it('una ejecución larguísima no arrastra la duración típica', () => {
    const resumen = resumirEjecuciones([
      ejecucion({ id: '1', resuelto: 'si', duracionSegundos: 60 }),
      ejecucion({ id: '2', resuelto: 'si', duracionSegundos: 90 }),
      ejecucion({ id: '3', resuelto: 'si', duracionSegundos: 36000 }),
    ])
    expect(resumen.duracionMedianaSegundos).toBe(90)
  })

  it('la duración ignora las no resueltas y las abandonadas', () => {
    const resumen = resumirEjecuciones([
      ejecucion({ id: '1', resuelto: 'si', duracionSegundos: 100 }),
      ejecucion({ id: '2', resuelto: 'no', duracionSegundos: 5 }),
      ejecucion({ id: '3', resuelto: 'abandonado', duracionSegundos: 99999 }),
    ])
    expect(resumen.duracionMedianaSegundos).toBe(100)
  })

  it('sin ninguna resuelta la duración es null', () => {
    expect(resumirEjecuciones([ejecucion({ id: '1', resuelto: 'no' })]).duracionMedianaSegundos).toBeNull()
  })
})

describe('problemasMasFrecuentes', () => {
  it('agrupa por diagnóstico y ordena por cantidad de ejecuciones', () => {
    const filas = problemasMasFrecuentes([
      ejecucion({ id: '1', diagnosticoId: 'a', diagnosticoTitulo: 'Sin red' }),
      ejecucion({ id: '2', diagnosticoId: 'b', diagnosticoTitulo: 'No imprime' }),
      ejecucion({ id: '3', diagnosticoId: 'b', diagnosticoTitulo: 'No imprime' }),
    ])
    expect(filas.map((f) => f.diagnosticoId)).toEqual(['b', 'a'])
    expect(filas[0].ejecuciones).toBe(2)
  })

  it('calcula la tasa de éxito por problema, sin las abandonadas', () => {
    const filas = problemasMasFrecuentes([
      ejecucion({ id: '1', diagnosticoId: 'a', resuelto: 'si' }),
      ejecucion({ id: '2', diagnosticoId: 'a', resuelto: 'no' }),
      ejecucion({ id: '3', diagnosticoId: 'a', resuelto: 'abandonado' }),
    ])
    expect(filas[0].ejecuciones).toBe(3)
    expect(filas[0].resueltas).toBe(1)
    expect(filas[0].tasaExito).toBe(0.5)
  })

  // El título congelado más reciente es el menos desactualizado, por si
  // la ficha ya no existe para resolverlo en vivo.
  it('se queda con el título de la ejecución más reciente', () => {
    const filas = problemasMasFrecuentes([
      ejecucion({
        id: '1',
        diagnosticoId: 'a',
        diagnosticoTitulo: 'Nombre viejo',
        fechaHora: '2026-07-01T10:00:00.000Z',
      }),
      ejecucion({
        id: '2',
        diagnosticoId: 'a',
        diagnosticoTitulo: 'Nombre nuevo',
        fechaHora: '2026-07-20T10:00:00.000Z',
      }),
    ])
    expect(filas[0].titulo).toBe('Nombre nuevo')
  })

  it('desempata por título para que el orden sea estable', () => {
    const filas = problemasMasFrecuentes([
      ejecucion({ id: '1', diagnosticoId: 'z', diagnosticoTitulo: 'Zeta' }),
      ejecucion({ id: '2', diagnosticoId: 'a', diagnosticoTitulo: 'Alfa' }),
    ])
    expect(filas.map((f) => f.titulo)).toEqual(['Alfa', 'Zeta'])
  })

  it('respeta el límite', () => {
    const filas = problemasMasFrecuentes(
      [
        ejecucion({ id: '1', diagnosticoId: 'a', diagnosticoTitulo: 'A' }),
        ejecucion({ id: '2', diagnosticoId: 'b', diagnosticoTitulo: 'B' }),
        ejecucion({ id: '3', diagnosticoId: 'c', diagnosticoTitulo: 'C' }),
      ],
      2,
    )
    expect(filas).toHaveLength(2)
  })

  it('sin ejecuciones devuelve una lista vacía', () => {
    expect(problemasMasFrecuentes([])).toEqual([])
  })
})

describe('procedimientosMasUsados', () => {
  it('cuenta en cuántas ejecuciones se abrió cada procedimiento', () => {
    const filas = procedimientosMasUsados([
      ejecucion({ id: '1', articulosEjecutados: [{ id: 'p1', titulo: 'Reiniciar cola' }] }),
      ejecucion({
        id: '2',
        articulosEjecutados: [
          { id: 'p1', titulo: 'Reiniciar cola' },
          { id: 'p2', titulo: 'Cambiar tóner' },
        ],
      }),
    ])
    expect(filas[0]).toEqual({ articuloId: 'p1', titulo: 'Reiniciar cola', ejecuciones: 2 })
    expect(filas[1].ejecuciones).toBe(1)
  })

  // Volver atrás dentro de un diagnóstico puede dejar el mismo
  // procedimiento dos veces en la misma ejecución: eso no lo hace más
  // usado.
  it('no cuenta dos veces el mismo procedimiento dentro de una ejecución', () => {
    const filas = procedimientosMasUsados([
      ejecucion({
        id: '1',
        articulosEjecutados: [
          { id: 'p1', titulo: 'Reiniciar cola' },
          { id: 'p1', titulo: 'Reiniciar cola' },
        ],
      }),
    ])
    expect(filas[0].ejecuciones).toBe(1)
  })

  it('sin procedimientos ejecutados devuelve una lista vacía', () => {
    expect(procedimientosMasUsados([ejecucion({ id: '1' })])).toEqual([])
  })
})

describe('motivosDeFallo', () => {
  it('solo cuenta las ejecuciones cerradas en "no"', () => {
    const filas = motivosDeFallo([
      ejecucion({ id: '1', resuelto: 'no', motivo: 'no_funciono' }),
      ejecucion({ id: '2', resuelto: 'si', motivo: 'no_funciono' }),
      ejecucion({ id: '3', resuelto: 'abandonado', motivo: 'faltan_pasos' }),
    ])
    expect(filas).toEqual([{ motivo: 'no_funciono', veces: 1 }])
  })

  // Las ejecuciones anteriores a la fase D3 no tienen motivo.
  it('ignora las que no registraron motivo', () => {
    expect(motivosDeFallo([ejecucion({ id: '1', resuelto: 'no', motivo: '' })])).toEqual([])
  })

  it('devuelve los motivos en el orden de la pregunta, no por cantidad', () => {
    const filas = motivosDeFallo([
      ejecucion({ id: '1', resuelto: 'no', motivo: 'otro' }),
      ejecucion({ id: '2', resuelto: 'no', motivo: 'otro' }),
      ejecucion({ id: '3', resuelto: 'no', motivo: 'no_funciono' }),
    ])
    expect(filas).toEqual([
      { motivo: 'no_funciono', veces: 1 },
      { motivo: 'otro', veces: 2 },
    ])
  })
})

describe('formatearDuracion', () => {
  it('menos de un minuto va en segundos', () => {
    expect(formatearDuracion(45)).toBe('45 s')
  })

  it('minutos redondeados', () => {
    expect(formatearDuracion(120)).toBe('2 min')
    expect(formatearDuracion(200)).toBe('3 min')
  })

  it('a partir de una hora separa horas y minutos', () => {
    expect(formatearDuracion(3600)).toBe('1 h')
    expect(formatearDuracion(4800)).toBe('1 h 20 min')
  })

  it('nunca muestra una duración negativa', () => {
    expect(formatearDuracion(-10)).toBe('0 s')
  })
})

describe('formatearPorcentaje', () => {
  it('redondea a entero', () => {
    expect(formatearPorcentaje(0.8)).toBe('80 %')
    expect(formatearPorcentaje(0.666)).toBe('67 %')
    expect(formatearPorcentaje(0)).toBe('0 %')
    expect(formatearPorcentaje(1)).toBe('100 %')
  })
})
