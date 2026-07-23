import { describe, expect, it } from 'vitest'
import type { CampoProtegido } from '../../lib/db'
import { equiposConContrasenaProtegida } from './solapamientoSecreto'

function campo(parcial: Partial<CampoProtegido> = {}): CampoProtegido {
  return {
    id: 'cp1',
    dispositivoId: 'd1',
    nombre: 'Contraseña',
    tipo: 'contrasena',
    valorCifrado: '',
    orden: 0,
    venceEn: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...parcial,
  }
}

describe('equiposConContrasenaProtegida', () => {
  it('incluye un equipo vinculado que ya tiene una contraseña protegida', () => {
    const resultado = equiposConContrasenaProtegida(
      [{ id: 'd1', nombre: 'Switch A' }],
      [campo({ dispositivoId: 'd1' })],
    )
    expect(resultado).toEqual([{ id: 'd1', nombre: 'Switch A' }])
  })

  it('no incluye un equipo sin campo protegido de tipo contrasena', () => {
    const resultado = equiposConContrasenaProtegida(
      [{ id: 'd1', nombre: 'Switch A' }],
      [campo({ dispositivoId: 'd1', tipo: 'pin' })],
    )
    expect(resultado).toEqual([])
  })

  it('ignora un campo protegido eliminado', () => {
    const resultado = equiposConContrasenaProtegida(
      [{ id: 'd1', nombre: 'Switch A' }],
      [campo({ dispositivoId: 'd1', eliminadoEn: '2026-07-01T00:00:00Z' })],
    )
    expect(resultado).toEqual([])
  })

  it('no incluye un equipo que no está entre los vinculados', () => {
    const resultado = equiposConContrasenaProtegida(
      [{ id: 'd1', nombre: 'Switch A' }],
      [campo({ dispositivoId: 'd2' })],
    )
    expect(resultado).toEqual([])
  })
})
