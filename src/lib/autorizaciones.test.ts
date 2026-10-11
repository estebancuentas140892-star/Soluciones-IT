import { describe, expect, it } from 'vitest'
import {
  ESTADOS_AUTORIZACION,
  etiquetaEstadoAutorizacion,
  formatearNumero,
  necesitaRevision,
  resumenAutorizacion,
  textoRango,
} from './autorizaciones'

// Lo que también usa el repositorio de una autorización de facturación
// (tarea 321): cómo se dicen su estado, sus números y su resumen en el
// historial de sus POS. Datos inventados.

const BASE = {
  prefijo: 'PRB',
  rangoDesde: 4100,
  rangoHasta: 90000,
  estado: 'documentada' as const,
  vencimientoConfirmado: null,
  consecutivoActual: null,
  consecutivoLeidoEn: null,
}

describe('formatearNumero', () => {
  it('agrupa los miles con punto, también los de cuatro cifras', () => {
    expect(formatearNumero(4100)).toBe('4.100')
    expect(formatearNumero(90000)).toBe('90.000')
    expect(formatearNumero(1000000)).toBe('1.000.000')
    expect(formatearNumero(999)).toBe('999')
  })
})

describe('textoRango', () => {
  it('dice los dos extremos, o nada si falta uno', () => {
    expect(textoRango(BASE)).toBe('4.100 a 90.000')
    expect(textoRango({ rangoDesde: null, rangoHasta: null })).toBe('')
    expect(textoRango({ rangoDesde: 1, rangoHasta: null })).toBe('')
  })
})

describe('estados', () => {
  it('son los cuatro de la taxonomía, y "por validar" se dice sin ambigüedad', () => {
    expect([...ESTADOS_AUTORIZACION]).toEqual(['documentada', 'confirmada', 'conflicto', 'reemplazada'])
    expect(etiquetaEstadoAutorizacion('documentada')).toBe('Documentada, por validar')
    expect(etiquetaEstadoAutorizacion('confirmada')).toBe('Confirmada')
    expect(etiquetaEstadoAutorizacion('conflicto')).toBe('En conflicto')
    expect(etiquetaEstadoAutorizacion('reemplazada')).toBe('Reemplazada')
  })

  it('piden revisión la documentada y la que está en conflicto; ni la confirmada ni la reemplazada', () => {
    expect(necesitaRevision({ estado: 'documentada' })).toBe(true)
    expect(necesitaRevision({ estado: 'conflicto' })).toBe(true)
    expect(necesitaRevision({ estado: 'confirmada' })).toBe(false)
    expect(necesitaRevision({ estado: 'reemplazada' })).toBe(false)
  })
})

describe('resumenAutorizacion', () => {
  it('prefijo, rango y estado; sin inventar vencimiento ni consecutivo', () => {
    expect(resumenAutorizacion(BASE)).toBe('PRB · 4.100 a 90.000 · Documentada, por validar')
  })

  it('con vencimiento confirmado y una lectura del consecutivo, los dice', () => {
    expect(
      resumenAutorizacion({
        ...BASE,
        estado: 'confirmada',
        vencimientoConfirmado: '2028-05-14',
        consecutivoActual: 12345,
        consecutivoLeidoEn: '2026-10-03',
      }),
    ).toBe('PRB · 4.100 a 90.000 · Confirmada · vence el 14 may 2028 · consecutivo 12.345 leído el 3 oct 2026')
  })

  it('sin rango, no lo menciona', () => {
    expect(resumenAutorizacion({ ...BASE, rangoDesde: null, rangoHasta: null })).toBe('PRB · Documentada, por validar')
  })
})
