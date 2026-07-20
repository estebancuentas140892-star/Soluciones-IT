import { describe, expect, it } from 'vitest'
import {
  calcularCompletitud,
  senalesDeArticulo,
  type DatosCompletitud,
  type SenalCompletitud,
} from './completitudArticulo'

const VACIO: DatosCompletitud = {
  titulo: '',
  cantidadPasos: 0,
  descripcion: '',
  cantidadEtiquetas: 0,
  requisitos: '',
  tiempoEstimadoMin: '',
  dificultad: '',
  verificacionFinal: '',
  objetivoGeneral: '',
}

const COMPLETO: DatosCompletitud = {
  titulo: 'Instalar impresora de bodega',
  cantidadPasos: 3,
  descripcion: 'Cuando llega una impresora nueva',
  cantidadEtiquetas: 2,
  requisitos: 'Acceso a la red',
  tiempoEstimadoMin: '20',
  dificultad: 'intermedio',
  verificacionFinal: 'La impresión de prueba salió',
  objetivoGeneral: 'Dejar la impresora operativa',
}

describe('calcularCompletitud', () => {
  it('un artículo vacío da 0 % y uno completo da 100 %', () => {
    expect(calcularCompletitud(senalesDeArticulo(VACIO)).porcentaje).toBe(0)
    expect(calcularCompletitud(senalesDeArticulo(COMPLETO)).porcentaje).toBe(100)
  })

  it('un artículo completo no deja ninguna pestaña marcada', () => {
    const completitud = calcularCompletitud(senalesDeArticulo(COMPLETO))
    expect(completitud.sugerencias).toEqual([])
    expect(completitud.pestanasPendientes.size).toBe(0)
  })

  it('las señales sin texto suman al porcentaje pero no generan sugerencia', () => {
    // El título es obligatorio y no merece una línea propia; con solo
    // el título escrito el porcentaje sube, pero la pestaña General
    // sigue marcada por sus otras señales (descripción, etiquetas...).
    const soloTitulo = calcularCompletitud(senalesDeArticulo({ ...VACIO, titulo: 'Algo' }))
    expect(soloTitulo.porcentaje).toBe(10)
    expect(soloTitulo.sugerencias.some((s) => s.texto.toLowerCase().includes('título'))).toBe(false)
  })

  it('el segundo paso suma al porcentaje sin agregar una sugerencia nueva', () => {
    const unPaso = calcularCompletitud(senalesDeArticulo({ ...VACIO, cantidadPasos: 1 }))
    const dosPasos = calcularCompletitud(senalesDeArticulo({ ...VACIO, cantidadPasos: 2 }))
    expect(dosPasos.porcentaje).toBeGreaterThan(unPaso.porcentaje)
    expect(dosPasos.sugerencias).toHaveLength(unPaso.sugerencias.length)
  })

  it('cada sugerencia apunta a la pestaña donde se resuelve', () => {
    const completitud = calcularCompletitud(senalesDeArticulo(VACIO))
    const porTexto = new Map(completitud.sugerencias.map((s) => [s.texto, s.pestana]))
    expect(porTexto.get('Agregar al menos un paso')).toBe('pasos')
    expect(porTexto.get('Escribir la verificación final')).toBe('pasos')
    expect(porTexto.get('Anotar los requisitos previos')).toBe('pasos')
    expect(porTexto.get('Escribir cuándo usar este procedimiento')).toBe('general')
    expect(porTexto.get('Agregar etiquetas para el buscador')).toBe('general')
    expect(porTexto.get('Indicar el objetivo general')).toBe('general')
    expect(porTexto.get('Indicar el tiempo estimado')).toBe('detalles')
    expect(porTexto.get('Indicar la dificultad')).toBe('detalles')
  })

  it('Publicación nunca queda marcada: no tiene señales de completitud', () => {
    const completitud = calcularCompletitud(senalesDeArticulo(VACIO))
    expect(completitud.pestanasPendientes.has('publicacion')).toBe(false)
  })

  it('una pestaña deja de estar marcada al completar todas sus señales', () => {
    const conDetalles = calcularCompletitud(
      senalesDeArticulo({ ...VACIO, tiempoEstimadoMin: '15', dificultad: 'principiante' }),
    )
    expect(conDetalles.pestanasPendientes.has('detalles')).toBe(false)
    expect(conDetalles.pestanasPendientes.has('pasos')).toBe(true)
  })

  it('no divide por cero si no llegan señales', () => {
    const vacio: SenalCompletitud[] = []
    expect(calcularCompletitud(vacio)).toEqual({
      porcentaje: 0,
      sugerencias: [],
      pestanasPendientes: new Set(),
    })
  })

  it('los espacios en blanco no cuentan como contenido', () => {
    const soloEspacios = calcularCompletitud(
      senalesDeArticulo({ ...VACIO, descripcion: '   ', objetivoGeneral: '\n\t' }),
    )
    expect(soloEspacios.porcentaje).toBe(0)
  })
})
