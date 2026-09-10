import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento, Procedimiento } from '../../lib/db'
import { accionDeGuia, estrenaEjecucion, etiquetaAccionGuia } from './accionGuia'

function paso(id: string): PasoProcedimiento {
  return {
    id,
    titulo: id,
    objetivo: '',
    bloques: [],
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

function guia(pasos: string[], verificacionFinal: string[] = []): Procedimiento {
  return {
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: [],
    pasos: pasos.map(paso),
    verificacionFinal,
    tiempoEstimadoMin: null,
    dificultad: null,
  }
}

const TRES = guia(['p1', 'p2', 'p3'])

describe('accionDeGuia', () => {
  it('sin ejecucion abierta ofrece empezar, desde el paso 1', () => {
    const accion = accionDeGuia(TRES, undefined, false)
    expect(accion.estado).toBe('empezar')
    expect(accion.pendiente).toEqual({ tipo: 'paso', indice: 0, numero: 1 })
  })

  it('una ejecucion recien creada ya es continuar, aunque no tenga pasos hechos', () => {
    const accion = accionDeGuia(TRES, { pasosHechos: [] }, true)
    expect(accion.estado).toBe('continuar')
    expect(accion.pasosHechos).toBe(0)
    expect(etiquetaAccionGuia(accion, 'barra')).toBe('Continuar en el paso 1 de 3')
  })

  it('con avance a medias continua en el primer paso pendiente', () => {
    const accion = accionDeGuia(TRES, { pasosHechos: ['p1'] }, true)
    expect(accion.estado).toBe('continuar')
    expect(accion.pendiente).toEqual({ tipo: 'paso', indice: 1, numero: 2 })
  })

  it('con los pasos cerrados fuera de orden abre el pendiente correcto', () => {
    // Dos y tres hechos, el uno no: la cuenta de hechos diria "paso 3",
    // que ya esta hecho. El pendiente de verdad es el 1.
    const accion = accionDeGuia(TRES, { pasosHechos: ['p2', 'p3'] }, true)
    expect(accion.pendiente).toEqual({ tipo: 'paso', indice: 0, numero: 1 })
    expect(accion.pasosHechos).toBe(2)
  })

  it('con todo hecho y sin comprobaciones ofrece repetir', () => {
    const accion = accionDeGuia(TRES, { pasosHechos: ['p1', 'p2', 'p3'] }, true)
    expect(accion.estado).toBe('repetir')
    expect(accion.pendiente).toEqual({ tipo: 'ninguno' })
  })

  it('no cuenta los pasos que ya no existen en el procedimiento', () => {
    const accion = accionDeGuia(TRES, { pasosHechos: ['p1', 'paso-borrado'] }, true)
    expect(accion.pasosHechos).toBe(1)
    expect(accion.pendiente).toEqual({ tipo: 'paso', indice: 1, numero: 2 })
  })

  it('una guia sin pasos no se da por repetible', () => {
    const accion = accionDeGuia(guia([]), undefined, false)
    expect(accion.estado).toBe('empezar')
    expect(accion.total).toBe(0)
  })
})

// LAS COMPROBACIONES FINALES CUENTAN (encargo del 2026-09-09). Antes
// "terminada" miraba solo `pasosHechos`, asi que una guia con los pasos
// cerrados y las comprobaciones sin marcar ofrecia "Repetir guia", que
// estrena ejecucion: borraba una ejecucion que no habia terminado.
describe('accionDeGuia con comprobaciones finales', () => {
  const CON_COMPROBACIONES = guia(['p1', 'p2'], ['Comprobar A', 'Comprobar B'])

  it('con los pasos cerrados y comprobaciones pendientes sigue siendo continuar', () => {
    const accion = accionDeGuia(CON_COMPROBACIONES, { pasosHechos: ['p1', 'p2'] }, true)
    expect(accion.estado).toBe('continuar')
    expect(accion.pendiente).toEqual({ tipo: 'verificacion' })
  })

  it('el destino de las comprobaciones no inventa un numero de paso', () => {
    const accion = accionDeGuia(
      CON_COMPROBACIONES,
      { pasosHechos: ['p1', 'p2'], verificacionHecha: [0] },
      true,
    )
    expect(accion.pendiente).toEqual({ tipo: 'verificacion' })
    expect(etiquetaAccionGuia(accion, 'barra')).toBe('Continuar con las comprobaciones finales')
    expect(etiquetaAccionGuia(accion, 'tarjeta')).toBe('Continuar con las comprobaciones finales')
  })

  it('solo ofrece repetir cuando ademas estan todas marcadas', () => {
    const accion = accionDeGuia(
      CON_COMPROBACIONES,
      { pasosHechos: ['p1', 'p2'], verificacionHecha: [0, 1] },
      true,
    )
    expect(accion.estado).toBe('repetir')
  })

  it('con pasos pendientes manda el paso, no las comprobaciones', () => {
    const accion = accionDeGuia(CON_COMPROBACIONES, { pasosHechos: ['p1'] }, true)
    expect(accion.pendiente).toEqual({ tipo: 'paso', indice: 1, numero: 2 })
  })
})

describe('etiquetaAccionGuia y estrenaEjecucion', () => {
  it('la tarjeta abrevia y la barra escribe la frase entera', () => {
    const accion = accionDeGuia(TRES, { pasosHechos: ['p1'] }, true)
    expect(etiquetaAccionGuia(accion, 'tarjeta')).toBe('Continuar · paso 2 de 3')
    expect(etiquetaAccionGuia(accion, 'barra')).toBe('Continuar en el paso 2 de 3')
  })

  it('empezar y repetir estrenan ejecucion; continuar no', () => {
    expect(estrenaEjecucion(accionDeGuia(TRES, undefined, false))).toBe(true)
    expect(estrenaEjecucion(accionDeGuia(TRES, { pasosHechos: ['p1', 'p2', 'p3'] }, true))).toBe(true)
    expect(estrenaEjecucion(accionDeGuia(TRES, { pasosHechos: ['p1'] }, true))).toBe(false)
  })

  it('nombra repetir con la palabra guia', () => {
    const accion = accionDeGuia(TRES, { pasosHechos: ['p1', 'p2', 'p3'] }, true)
    expect(etiquetaAccionGuia(accion, 'barra')).toBe('Repetir guía')
    expect(etiquetaAccionGuia(accion, 'tarjeta')).toBe('Repetir guía')
  })
})
