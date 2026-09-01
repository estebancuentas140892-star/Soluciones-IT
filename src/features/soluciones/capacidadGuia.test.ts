import { describe, expect, it } from 'vitest'
import type { Articulo, Procedimiento } from '../../lib/db'
import { crearBloqueTarea, crearPaso } from '../../lib/procedimiento'
import { capacidadDeGuia, lineaDeCapacidad } from './capacidadGuia'

function procedimiento(cambios: Partial<Procedimiento> = {}): Procedimiento {
  return {
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: [],
    pasos: [],
    verificacionFinal: [],
    tiempoEstimadoMin: null,
    dificultad: null,
    ...cambios,
  }
}

function articulo(proc: Procedimiento | null): Articulo {
  return {
    id: 'a1',
    categoriaId: 'c1',
    titulo: 'Guía',
    tipo: 'mantenimiento',
    contenido: '',
    etiquetas: [],
    procedimiento: proc,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: '2026-09-01T00:00:00Z',
    updatedBy: null,
    eliminadoEn: null,
  }
}

const paso = () => ({ ...crearPaso(), bloques: [crearBloqueTarea()] })

describe('capacidadDeGuia', () => {
  it('una guía con pasos, tiempo y verificación los declara todos', () => {
    const capacidad = capacidadDeGuia(
      articulo(procedimiento({ pasos: [paso(), paso()], tiempoEstimadoMin: 25, verificacionFinal: ['Imprime'] })),
    )
    expect(capacidad).toEqual({ ejecutable: true, pasos: 2, minutos: 25, tieneVerificacion: true })
  })

  it('un artículo sin procedimiento no es ejecutable', () => {
    expect(capacidadDeGuia(articulo(null))).toEqual({
      ejecutable: false,
      pasos: 0,
      minutos: null,
      tieneVerificacion: false,
    })
  })

  // Hallazgo K1: un procedimiento puede existir SOLO por su metadata
  // (descripción, portada, objetivo) y no tener ni un paso. Eso no es
  // ejecutable, aunque `procedimiento` no sea null.
  it('un procedimiento sin pasos, aunque exista, no es ejecutable', () => {
    const capacidad = capacidadDeGuia(
      articulo(procedimiento({ descripcion: 'Manual del fabricante', pasos: [] })),
    )
    expect(capacidad.ejecutable).toBe(false)
    expect(capacidad.pasos).toBe(0)
  })

  it('sin tiempo estimado no se inventa uno', () => {
    expect(capacidadDeGuia(articulo(procedimiento({ pasos: [paso()] }))).minutos).toBeNull()
  })

  it('una verificación final vacía no cuenta como verificación', () => {
    expect(
      capacidadDeGuia(articulo(procedimiento({ pasos: [paso()], verificacionFinal: [] }))).tieneVerificacion,
    ).toBe(false)
  })
})

describe('lineaDeCapacidad', () => {
  it('redacta los tres datos de una guía completa', () => {
    const linea = lineaDeCapacidad({ ejecutable: true, pasos: 7, minutos: 25, tieneVerificacion: true })
    expect(linea).toEqual({ pasos: '7 pasos', minutos: '~25 min', verificacion: true, aviso: null })
  })

  it('concuerda el singular', () => {
    expect(lineaDeCapacidad({ ejecutable: true, pasos: 1, minutos: null, tieneVerificacion: false }).pasos).toBe(
      '1 paso',
    )
  })

  it('lo no ejecutable dice lo que SÍ hay, no solo lo que falta', () => {
    const linea = lineaDeCapacidad({ ejecutable: false, pasos: 0, minutos: null, tieneVerificacion: false })
    expect(linea.pasos).toBe('Sin pasos')
    expect(linea.aviso).toBe('solo notas · no se puede ejecutar')
  })

  it('lo no ejecutable no promete tiempo ni verificación', () => {
    const linea = lineaDeCapacidad({ ejecutable: false, pasos: 0, minutos: 30, tieneVerificacion: true })
    expect(linea.minutos).toBeNull()
    expect(linea.verificacion).toBe(false)
  })
})
