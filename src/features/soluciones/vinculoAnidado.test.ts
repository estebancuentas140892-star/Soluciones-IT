import { describe, expect, it } from 'vitest'
import type { Procedimiento } from '../../lib/db'
import { fraseAvanceDocumento, modoVinculo } from './vinculoAnidado'

function procedimientoCon(pasos: number): Procedimiento {
  return {
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: [],
    tiempoEstimadoMin: null,
    dificultad: null,
    pasos: Array.from({ length: pasos }, (_, i) => ({
      id: `p${i}`,
      titulo: `Paso ${i + 1}`,
      objetivo: '',
      bloques: [],
      adjuntos: [],
      subArticuloId: '',
      subArticuloTitulo: '',
      solucionArticuloId: '',
      solucionArticuloTitulo: '',
      vinculoProtegido: null,
    })),
    verificacionFinal: [],
  } as unknown as Procedimiento
}

describe('modoVinculo', () => {
  it('despliega en el nivel 0 cuando el vinculado tiene pasos', () => {
    expect(modoVinculo(0, procedimientoCon(3))).toBe('expandible')
  })

  it('solo enlaza a partir del nivel 1, para cortar los ciclos A -> B -> A', () => {
    expect(modoVinculo(1, procedimientoCon(3))).toBe('enlazado')
    expect(modoVinculo(2, procedimientoCon(3))).toBe('enlazado')
  })

  it('solo enlaza si el vinculado no tiene pasos que ejecutar', () => {
    expect(modoVinculo(0, procedimientoCon(0))).toBe('enlazado')
  })

  it('solo enlaza si el vínculo está roto o el artículo fue eliminado', () => {
    expect(modoVinculo(0, null)).toBe('enlazado')
  })
})

describe('fraseAvanceDocumento', () => {
  it('nombra el documento al que pertenece el avance, no solo el número', () => {
    expect(fraseAvanceDocumento(0, 3, 'guía')).toBe('Paso 1 de 3 de esta guía')
    expect(fraseAvanceDocumento(1, 3, 'guía')).toBe('Paso 2 de 3 de esta guía')
  })

  it('usa el sustantivo de la contingencia cuando el vínculo es una contingencia', () => {
    expect(fraseAvanceDocumento(1, 4, 'contingencia')).toBe('Paso 2 de 4 de esta contingencia')
  })

  it('dice que está completa en vez de anunciar un paso que ya no existe', () => {
    expect(fraseAvanceDocumento(3, 3, 'guía')).toBe('Esta guía está completa, 3 de 3')
    expect(fraseAvanceDocumento(5, 3, 'guía')).toBe('Esta guía está completa, 3 de 3')
  })

  it('no inventa pasos cuando el documento vinculado no tiene ninguno', () => {
    expect(fraseAvanceDocumento(0, 0, 'guía')).toBe('Esta guía no tiene pasos')
  })
})
