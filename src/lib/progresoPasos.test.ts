import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  alternarInstruccionHecha,
  alternarVerificacionFinal,
  contarHechos,
  contarInstruccionesHechas,
  establecerPasoHecho,
  registrarEvidenciaPaso,
  reiniciarProgreso,
  verificacionFinalCompleta,
} from './progresoPasos'

beforeEach(async () => {
  await db.progresoPasos.clear()
})

describe('establecerPasoHecho', () => {
  it('marca y desmarca un paso', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])

    await establecerPasoHecho('articulo-1', 'paso-a', false)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })

  it('arrastra las tareas del paso al marcarlo y desmarcarlo', async () => {
    const tareas = ['t1', 't2', 't3']

    await establecerPasoHecho('articulo-1', 'paso-a', true, tareas)
    let fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual(tareas)

    await establecerPasoHecho('articulo-1', 'paso-a', false, tareas)
    fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosHechos).toEqual([])
    expect(fila?.instruccionesHechas).toEqual([])
  })

  it('no toca las tareas de otros pasos', async () => {
    await alternarInstruccionHecha('articulo-1', 'paso-b', 'tb1', ['tb1', 'tb2'])
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['ta1', 'ta2'])
    await establecerPasoHecho('articulo-1', 'paso-a', false, ['ta1', 'ta2'])

    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual(['tb1'])
  })

  it('conserva la verificación final al marcar un paso', async () => {
    await alternarVerificacionFinal('articulo-1', 0)
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['ta1'])
    expect((await db.progresoPasos.get('articulo-1'))?.verificacionHecha).toEqual([0])
  })

  it('lleva el avance por artículo, sin mezclarlos', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    await establecerPasoHecho('articulo-2', 'paso-b', true)

    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])
    expect((await db.progresoPasos.get('articulo-2'))?.pasosHechos).toEqual(['paso-b'])
  })
})

describe('alternarInstruccionHecha', () => {
  it('marca y desmarca una tarea sin completar el paso', async () => {
    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 't1', ['t1', 't2', 't3'])
    expect(quedaCompleto).toBe(false)

    let fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual(['t1'])
    expect(fila?.pasosHechos).toEqual([])

    await alternarInstruccionHecha('articulo-1', 'paso-a', 't1', ['t1', 't2', 't3'])
    fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual([])
  })

  it('devuelve true al marcar la última tarea, pero NO marca el paso (lo decide la vista)', async () => {
    // El paso es un contenedor: completar las tareas no basta, aun puede
    // quedar un subprocedimiento o una solución. Por eso aquí no se
    // agrega a pasosHechos; la señal (true) la usa la vista.
    await alternarInstruccionHecha('articulo-1', 'paso-a', 't1', ['t1', 't2'])
    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 't2', ['t1', 't2'])

    expect(quedaCompleto).toBe(true)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })

  it('desmarcar una tarea vuelve pendiente un paso completado', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['t1', 't2'])

    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 't2', ['t1', 't2'])
    expect(quedaCompleto).toBe(false)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })
})

describe('reiniciarProgreso', () => {
  it('borra el avance del artículo, incluidas las tareas', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['t1', 't2'])
    await reiniciarProgreso('articulo-1')
    expect(await db.progresoPasos.get('articulo-1')).toBeUndefined()
  })
})

describe('verificación final', () => {
  it('alterna casillas por índice y decide si está completa', async () => {
    expect(verificacionFinalCompleta(undefined, 0)).toBe(true) // sin items
    expect(verificacionFinalCompleta(undefined, 2)).toBe(false)

    await alternarVerificacionFinal('articulo-1', 0)
    await alternarVerificacionFinal('articulo-1', 1)
    const fila = await db.progresoPasos.get('articulo-1')
    expect(new Set(fila?.verificacionHecha)).toEqual(new Set([0, 1]))
    expect(verificacionFinalCompleta(fila?.verificacionHecha, 2)).toBe(true)

    await alternarVerificacionFinal('articulo-1', 1)
    expect(verificacionFinalCompleta((await db.progresoPasos.get('articulo-1'))?.verificacionHecha, 2)).toBe(false)
  })
})

describe('registrarEvidenciaPaso', () => {
  it('guarda el id de la entrada de historial asociada al paso', async () => {
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')
    expect((await db.progresoPasos.get('articulo-1'))?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-1' })
  })

  it('no pisa la evidencia de otros pasos del mismo artículo', async () => {
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')
    await registrarEvidenciaPaso('articulo-1', 'paso-b', 'entrada-2')
    expect((await db.progresoPasos.get('articulo-1'))?.evidenciasPorPaso).toEqual({
      'paso-a': 'entrada-1',
      'paso-b': 'entrada-2',
    })
  })

  it('conserva el resto del avance ya guardado (pasos, tareas, verificación)', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['t1'])
    await alternarVerificacionFinal('articulo-1', 0)
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')

    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosHechos).toEqual(['paso-a'])
    expect(fila?.instruccionesHechas).toEqual(['t1'])
    expect(fila?.verificacionHecha).toEqual([0])
    expect(fila?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-1' })
  })

  it('lleva la evidencia por artículo, sin mezclarla entre procedimientos', async () => {
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')
    await registrarEvidenciaPaso('articulo-2', 'paso-a', 'entrada-2')

    expect((await db.progresoPasos.get('articulo-1'))?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-1' })
    expect((await db.progresoPasos.get('articulo-2'))?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-2' })
  })
})

describe('contadores', () => {
  it('no cuenta pasos hechos que ya no existen en el procedimiento', () => {
    expect(contarHechos(['paso-a', 'paso-borrado'], ['paso-a', 'paso-b'])).toBe(1)
    expect(contarHechos([], ['paso-a'])).toBe(0)
  })

  it('cuenta solo las tareas marcadas de la lista indicada', () => {
    const hechas = ['t1', 't3', 'otro-paso-t1']
    expect(contarInstruccionesHechas(hechas, ['t1', 't2', 't3'])).toBe(2)
    expect(contarInstruccionesHechas(hechas, ['tx', 'ty'])).toBe(0)
    expect(contarInstruccionesHechas(undefined, ['t1', 't2'])).toBe(0)
  })
})
