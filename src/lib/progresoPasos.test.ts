import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { alternarPasoHecho, contarHechos, reiniciarProgreso } from './progresoPasos'

beforeEach(async () => {
  await db.progresoPasos.clear()
})

describe('progreso local de procedimientos', () => {
  it('marca y desmarca un paso', async () => {
    await alternarPasoHecho('articulo-1', 'paso-a')
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])

    await alternarPasoHecho('articulo-1', 'paso-a')
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })

  it('lleva el avance por artículo, sin mezclarlos', async () => {
    await alternarPasoHecho('articulo-1', 'paso-a')
    await alternarPasoHecho('articulo-2', 'paso-b')

    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])
    expect((await db.progresoPasos.get('articulo-2'))?.pasosHechos).toEqual(['paso-b'])
  })

  it('reiniciar borra el avance del artículo', async () => {
    await alternarPasoHecho('articulo-1', 'paso-a')
    await reiniciarProgreso('articulo-1')
    expect(await db.progresoPasos.get('articulo-1')).toBeUndefined()
  })

  it('no cuenta pasos hechos que ya no existen en el procedimiento', () => {
    expect(contarHechos(['paso-a', 'paso-borrado'], ['paso-a', 'paso-b'])).toBe(1)
    expect(contarHechos([], ['paso-a'])).toBe(0)
  })
})
