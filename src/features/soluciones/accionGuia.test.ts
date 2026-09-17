import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento, Procedimiento } from '../../lib/db'
import { accionDeGuia, lineaAvanceGuia } from './accionGuia'

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
    expect(lineaAvanceGuia(accion)).toBe('Faltan las comprobaciones finales')
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

// Encargo del 2026-09-17, sección 3: abrir la guía ya lleva al paso
// pendiente, así que la tarjeta no necesita un botón con verbo. Queda la
// información de dónde va, solo cuando hay algo que retomar.
describe('lineaAvanceGuia', () => {
  it('sin ejecucion abierta no dice nada: abrir la guia empieza en el paso 1', () => {
    expect(lineaAvanceGuia(accionDeGuia(TRES, undefined, false))).toBeNull()
    expect(lineaAvanceGuia(null)).toBeNull()
  })

  it('con pasos hechos dice en que paso va y cuantos hay', () => {
    expect(lineaAvanceGuia(accionDeGuia(TRES, { pasosHechos: ['p1'] }, true))).toBe('Vas en el paso 2 de 3')
  })

  it('una ejecucion abierta sin ningun paso cerrado no inventa un paso en el que vas', () => {
    expect(lineaAvanceGuia(accionDeGuia(TRES, { pasosHechos: [] }, true))).toBeNull()
  })

  it('con los pasos cerrados fuera de orden nombra el pendiente de verdad', () => {
    expect(lineaAvanceGuia(accionDeGuia(TRES, { pasosHechos: ['p2', 'p3'] }, true))).toBe('Vas en el paso 1 de 3')
  })

  it('con los pasos cerrados y las comprobaciones pendientes lo dice sin numero de paso', () => {
    const accion = accionDeGuia(guia(['p1'], ['Comprobar A']), { pasosHechos: ['p1'] }, true)
    expect(lineaAvanceGuia(accion)).toBe('Faltan las comprobaciones finales')
  })

  it('una guia terminada no lleva linea: abrirla estrena un caso nuevo', () => {
    expect(lineaAvanceGuia(accionDeGuia(TRES, { pasosHechos: ['p1', 'p2', 'p3'] }, true))).toBeNull()
  })
})
