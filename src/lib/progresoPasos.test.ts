import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  alternarInstruccionHecha,
  claveInstruccion,
  clavesDeInstrucciones,
  contarHechos,
  contarInstruccionesHechas,
  establecerPasoHecho,
  reiniciarProgreso,
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

  it('arrastra las instrucciones del paso al marcarlo y desmarcarlo', async () => {
    const claves = clavesDeInstrucciones('paso-a', 3)

    await establecerPasoHecho('articulo-1', 'paso-a', true, claves)
    let fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual(claves)

    await establecerPasoHecho('articulo-1', 'paso-a', false, claves)
    fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosHechos).toEqual([])
    expect(fila?.instruccionesHechas).toEqual([])
  })

  it('no toca las instrucciones de otros pasos', async () => {
    await alternarInstruccionHecha('articulo-1', 'paso-b', 0, 2)
    await establecerPasoHecho('articulo-1', 'paso-a', true, clavesDeInstrucciones('paso-a', 2))
    await establecerPasoHecho('articulo-1', 'paso-a', false, clavesDeInstrucciones('paso-a', 2))

    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual([claveInstruccion('paso-b', 0)])
  })

  it('lleva el avance por artículo, sin mezclarlos', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    await establecerPasoHecho('articulo-2', 'paso-b', true)

    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])
    expect((await db.progresoPasos.get('articulo-2'))?.pasosHechos).toEqual(['paso-b'])
  })
})

describe('alternarInstruccionHecha', () => {
  it('marca y desmarca una instrucción sin completar el paso', async () => {
    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 0, 3)
    expect(quedaCompleto).toBe(false)

    let fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual([claveInstruccion('paso-a', 0)])
    expect(fila?.pasosHechos).toEqual([])

    await alternarInstruccionHecha('articulo-1', 'paso-a', 0, 3)
    fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual([])
  })

  it('devuelve true y completa el paso al marcar la última instrucción', async () => {
    await alternarInstruccionHecha('articulo-1', 'paso-a', 0, 2)
    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 1, 2)

    expect(quedaCompleto).toBe(true)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])
  })

  it('desmarcar una instrucción vuelve pendiente un paso completado', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, clavesDeInstrucciones('paso-a', 2))

    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 1, 2)
    expect(quedaCompleto).toBe(false)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })
})

describe('reiniciarProgreso', () => {
  it('borra el avance del artículo, incluidas las instrucciones', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, clavesDeInstrucciones('paso-a', 2))
    await reiniciarProgreso('articulo-1')
    expect(await db.progresoPasos.get('articulo-1')).toBeUndefined()
  })
})

describe('contadores', () => {
  it('no cuenta pasos hechos que ya no existen en el procedimiento', () => {
    expect(contarHechos(['paso-a', 'paso-borrado'], ['paso-a', 'paso-b'])).toBe(1)
    expect(contarHechos([], ['paso-a'])).toBe(0)
  })

  it('cuenta solo las instrucciones marcadas del paso indicado', () => {
    const hechas = [claveInstruccion('paso-a', 0), claveInstruccion('paso-a', 2), claveInstruccion('paso-b', 0)]
    expect(contarInstruccionesHechas(hechas, 'paso-a', 3)).toBe(2)
    expect(contarInstruccionesHechas(hechas, 'paso-c', 3)).toBe(0)
    expect(contarInstruccionesHechas(undefined, 'paso-a', 3)).toBe(0)
  })
})
