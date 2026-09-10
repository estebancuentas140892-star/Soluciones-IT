import { describe, expect, it } from 'vitest'
import { accionDeGuia } from './accionGuia'

const PASOS = ['p1', 'p2', 'p3']

describe('accionDeGuia', () => {
  it('sin ejecucion abierta ofrece empezar, desde el paso 1', () => {
    expect(accionDeGuia(PASOS, undefined, false)).toMatchObject({
      estado: 'empezar',
      destino: 0,
      numeroPaso: 1,
    })
  })

  it('una ejecucion recien creada ya es continuar, aunque no tenga pasos hechos', () => {
    expect(accionDeGuia(PASOS, [], true)).toMatchObject({
      estado: 'continuar',
      numeroPaso: 1,
      pasosHechos: 0,
    })
  })

  it('con avance a medias continua en el primer paso pendiente', () => {
    expect(accionDeGuia(PASOS, ['p1'], true)).toMatchObject({
      estado: 'continuar',
      destino: 1,
      numeroPaso: 2,
    })
  })

  it('con los pasos cerrados fuera de orden abre el pendiente correcto', () => {
    // Dos y tres hechos, el uno no: la cuenta de hechos diria "paso 3",
    // que ya esta hecho. El pendiente de verdad es el 1.
    expect(accionDeGuia(PASOS, ['p2', 'p3'], true)).toMatchObject({
      estado: 'continuar',
      destino: 0,
      numeroPaso: 1,
      pasosHechos: 2,
    })
  })

  it('con todo hecho ofrece repetir, no continuar', () => {
    expect(accionDeGuia(PASOS, ['p1', 'p2', 'p3'], true)).toMatchObject({
      estado: 'repetir',
      destino: null,
      numeroPaso: null,
    })
  })

  it('no cuenta los pasos que ya no existen en el procedimiento', () => {
    const accion = accionDeGuia(PASOS, ['p1', 'paso-borrado'], true)
    expect(accion.pasosHechos).toBe(1)
    expect(accion.numeroPaso).toBe(2)
  })

  it('una guia sin pasos no se da por repetible', () => {
    expect(accionDeGuia([], undefined, false)).toMatchObject({
      estado: 'empezar',
      destino: null,
      total: 0,
    })
  })
})
