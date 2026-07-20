import { describe, expect, it } from 'vitest'
import type { EjecucionDiagnostico, HistorialEntrada } from '../../lib/db'
import { agruparActividad, tiempoRelativo } from './actividadEquipo'

let contador = 0
function entrada(datos: Partial<HistorialEntrada> & { fechaHora: string }): HistorialEntrada {
  contador += 1
  return {
    id: `h-${contador}`,
    entidadTipo: 'articulo',
    entidadId: 'art-1',
    usuario: 'user-1',
    usuarioNombre: 'Ana',
    campo: 'titulo',
    valorAnterior: 'Antes',
    valorNuevo: 'Después',
    motivo: '',
    ...datos,
  }
}

function ejecucion(datos: Partial<EjecucionDiagnostico> & { fechaHora: string }): EjecucionDiagnostico {
  contador += 1
  return {
    id: `e-${contador}`,
    diagnosticoId: 'diag-1',
    diagnosticoTitulo: 'La impresora no imprime',
    usuario: 'user-1',
    usuarioNombre: 'Ana',
    camino: [],
    articulosEjecutados: [],
    resuelto: 'si',
    duracionSegundos: 60,
    motivo: '',
    solucionPropuesta: '',
    ...datos,
  }
}

const T0 = '2026-07-20T10:00:00.000Z'
const min = (n: number) => new Date(new Date(T0).getTime() + n * 60000).toISOString()

describe('agruparActividad', () => {
  it('agrupa ediciones del mismo usuario sobre la misma ficha dentro de la ráfaga en un solo evento', () => {
    const historial = [
      entrada({ fechaHora: min(0), campo: 'titulo' }),
      entrada({ fechaHora: min(5), campo: 'contenido' }),
      entrada({ fechaHora: min(10), campo: 'etiquetas' }),
    ]
    const eventos = agruparActividad(historial, [])
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({
      tipo: 'cambio',
      accion: 'edito',
      cantidadCambios: 3,
      fechaHora: min(10),
    })
  })

  it('no agrupa si el usuario es distinto, aunque sea la misma ficha y esté cerca en el tiempo', () => {
    const historial = [
      entrada({ fechaHora: min(0), usuario: 'user-1', usuarioNombre: 'Ana' }),
      entrada({ fechaHora: min(5), usuario: 'user-2', usuarioNombre: 'Beto' }),
    ]
    const eventos = agruparActividad(historial, [])
    expect(eventos).toHaveLength(2)
  })

  it('no agrupa si el hueco entre ediciones supera el umbral de ráfaga', () => {
    const historial = [
      entrada({ fechaHora: min(0) }),
      entrada({ fechaHora: min(45) }), // 45 min > 30 min de umbral
    ]
    const eventos = agruparActividad(historial, [])
    expect(eventos).toHaveLength(2)
  })

  it('no agrupa entre fichas distintas aunque sean del mismo usuario y tipo', () => {
    const historial = [
      entrada({ fechaHora: min(0), entidadId: 'art-1' }),
      entrada({ fechaHora: min(5), entidadId: 'art-2' }),
    ]
    const eventos = agruparActividad(historial, [])
    expect(eventos).toHaveLength(2)
  })

  it('detecta creación: toma el título congelado de la entrada de creacion', () => {
    const historial = [
      entrada({ fechaHora: min(0), campo: 'creacion', valorNuevo: 'Instalar impresora Zebra' }),
      entrada({ fechaHora: min(3), campo: 'contenido' }),
    ]
    const eventos = agruparActividad(historial, [])
    expect(eventos[0]).toMatchObject({
      accion: 'creo',
      tituloCongelado: 'Instalar impresora Zebra',
    })
  })

  it('detecta eliminación aunque haya ediciones previas en la misma ráfaga', () => {
    const historial = [
      entrada({ fechaHora: min(0), campo: 'titulo' }),
      entrada({ fechaHora: min(5), campo: 'eliminacion', valorAnterior: 'Instalar impresora Zebra' }),
    ]
    const eventos = agruparActividad(historial, [])
    expect(eventos[0]).toMatchObject({
      accion: 'elimino',
      tituloCongelado: 'Instalar impresora Zebra',
    })
  })

  it('excluye credenciales, categorías y ubicaciones del feed', () => {
    const historial = [
      entrada({ fechaHora: min(0), entidadTipo: 'credencial', entidadId: 'cred-1' }),
      entrada({ fechaHora: min(1), entidadTipo: 'categoria', entidadId: 'cat-1' }),
      entrada({ fechaHora: min(2), entidadTipo: 'ubicacion', entidadId: 'ubi-1' }),
      entrada({ fechaHora: min(3), entidadTipo: 'dispositivo', entidadId: 'disp-1' }),
    ]
    const eventos = agruparActividad(historial, [])
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({ entidadTipo: 'dispositivo' })
  })

  it('combina cambios y ejecuciones de diagnóstico ordenados por fecha, sin agrupar las ejecuciones entre sí', () => {
    const historial = [entrada({ fechaHora: min(0) })]
    const ejecuciones = [
      ejecucion({ fechaHora: min(2), diagnosticoTitulo: 'Diagnóstico A' }),
      ejecucion({ fechaHora: min(4), diagnosticoTitulo: 'Diagnóstico B' }),
    ]
    const eventos = agruparActividad(historial, ejecuciones, 10)
    expect(eventos.map((e) => e.tipo)).toEqual(['ejecucion', 'ejecucion', 'cambio'])
    expect(eventos.map((e) => e.fechaHora)).toEqual([min(4), min(2), min(0)])
  })

  it('respeta el límite de eventos devueltos, los más recientes primero', () => {
    const historial = [
      entrada({ fechaHora: min(0), entidadId: 'art-1' }),
      entrada({ fechaHora: min(60), entidadId: 'art-2' }),
      entrada({ fechaHora: min(120), entidadId: 'art-3' }),
    ]
    const eventos = agruparActividad(historial, [], 2)
    expect(eventos).toHaveLength(2)
    expect(eventos.map((e) => (e.tipo === 'cambio' ? e.entidadId : ''))).toEqual(['art-3', 'art-2'])
  })
})

describe('tiempoRelativo', () => {
  const ahora = new Date(T0)

  it('minutos, horas y días', () => {
    expect(tiempoRelativo(min(0), ahora)).toBe('justo ahora')
    expect(tiempoRelativo(new Date(ahora.getTime() - 5 * 60000).toISOString(), ahora)).toBe('hace 5 min')
    expect(tiempoRelativo(new Date(ahora.getTime() - 3 * 3600000).toISOString(), ahora)).toBe('hace 3 h')
    expect(tiempoRelativo(new Date(ahora.getTime() - 2 * 86400000).toISOString(), ahora)).toBe('hace 2 d')
  })

  it('más de una semana cae a fecha corta', () => {
    const hace10dias = new Date(ahora.getTime() - 10 * 86400000).toISOString()
    expect(tiempoRelativo(hace10dias, ahora)).not.toMatch(/^hace/)
  })
})
