import { describe, expect, it } from 'vitest'
import type { Mantenimiento } from './db'
import {
  esPorValidar,
  estaAbierto,
  fechaConAnio,
  nombreMantenimiento,
  resumenMantenimiento,
  SUFIJO_POR_VALIDAR,
  textoIntervencionDeMantenimiento,
} from './mantenimientos'

// Lo que un mantenimiento dice de sí mismo (tarea 320): qué cuenta como
// abierto, cómo se resume en el historial del equipo y qué texto deja la
// intervención al cerrarlo. Todo inventado.

type Resumible = Parameters<typeof resumenMantenimiento>[0]

function base(cambios: Partial<Mantenimiento> = {}): Resumible {
  return {
    tipo: 'preventivo',
    estado: 'programado',
    fechaProgramada: '2026-10-20',
    fechaRealizada: null,
    validacion: 'confirmado',
    ...cambios,
  }
}

describe('estaAbierto y esPorValidar', () => {
  it('programado y pospuesto siguen abiertos; realizado y cancelado lo cierran', () => {
    expect(estaAbierto({ estado: 'programado' })).toBe(true)
    expect(estaAbierto({ estado: 'pospuesto' })).toBe(true)
    expect(estaAbierto({ estado: 'realizado' })).toBe(false)
    expect(estaAbierto({ estado: 'cancelado' })).toBe(false)
  })

  it('solo un antecedente documentado está por validar', () => {
    expect(esPorValidar({ validacion: 'documentado_por_validar' })).toBe(true)
    expect(esPorValidar({ validacion: 'confirmado' })).toBe(false)
  })
})

describe('nombreMantenimiento y fechaConAnio', () => {
  it('dicen el tipo y la fecha con su año', () => {
    expect(nombreMantenimiento('preventivo')).toBe('Mantenimiento preventivo')
    expect(nombreMantenimiento('correctivo')).toBe('Mantenimiento correctivo')
    expect(fechaConAnio('2026-10-20')).toBe('20 oct 2026')
    expect(fechaConAnio('no es fecha')).toBe('')
  })
})

describe('resumenMantenimiento', () => {
  it('describe cada estado en una línea', () => {
    expect(resumenMantenimiento(base())).toBe('Preventivo para el 20 oct 2026')
    expect(resumenMantenimiento(base({ estado: 'pospuesto', fechaProgramada: '2026-11-03' }))).toBe(
      'Preventivo, pospuesto al 3 nov 2026',
    )
    expect(resumenMantenimiento(base({ estado: 'cancelado' }))).toBe('Preventivo para el 20 oct 2026, cancelado')
    expect(resumenMantenimiento(base({ estado: 'realizado', fechaRealizada: '2026-10-12' }))).toBe(
      'Preventivo, realizado el 12 oct 2026',
    )
    expect(resumenMantenimiento(base({ tipo: 'correctivo', fechaProgramada: null }))).toBe('Correctivo, sin fecha')
  })

  it('un antecedente dice que está documentado y por validar', () => {
    const resumen = resumenMantenimiento(base({ validacion: 'documentado_por_validar' }))
    expect(resumen).toBe(`Preventivo para el 20 oct 2026${SUFIJO_POR_VALIDAR}`)
    expect(resumen.endsWith(SUFIJO_POR_VALIDAR)).toBe(true)
  })
})

describe('textoIntervencionDeMantenimiento', () => {
  it('dice qué mantenimiento, cuándo, quién y qué se hizo', () => {
    expect(
      textoIntervencionDeMantenimiento({
        tipo: 'preventivo',
        fechaRealizada: '2026-10-12',
        tecnico: '  Técnico de prueba ',
        resultado: ' Limpieza interna y cambio de pasta térmica. ',
      }),
    ).toBe('Mantenimiento preventivo realizado el 12 oct 2026 por Técnico de prueba: Limpieza interna y cambio de pasta térmica.')
  })

  it('sin técnico no inventa uno', () => {
    expect(
      textoIntervencionDeMantenimiento({ tipo: 'correctivo', fechaRealizada: '2026-10-12', tecnico: '', resultado: 'Cambio de fuente.' }),
    ).toBe('Mantenimiento correctivo realizado el 12 oct 2026: Cambio de fuente.')
  })
})
