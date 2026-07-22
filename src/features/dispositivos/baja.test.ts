import { describe, expect, it } from 'vitest'
import { dependenciasDeBaja, sinDependencias, sinDispositivo } from './baja'
import type { CampoProtegido, Conexion, Credencial } from '../../lib/db'

function conexion(id: string, origenId: string, destinoId: string, eliminadoEn: string | null = null): Conexion {
  return {
    id,
    tipo: 'enlace',
    origenId,
    origenNombre: '',
    origenPuerto: '',
    destinoId,
    destinoNombre: '',
    destinoPuerto: '',
    medio: '',
    notas: '',
    updatedAt: '',
    updatedBy: null,
    eliminadoEn,
  }
}

function credencial(id: string, dispositivos: { id: string; nombre: string }[], eliminadoEn: string | null = null): Credencial {
  return {
    id,
    titulo: 'Secreto',
    categoria: '',
    tipo: 'cuenta',
    datosCifrados: '',
    venceEn: null,
    dispositivos,
    archivo: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn,
  }
}

function campoProtegido(id: string, dispositivoId: string | null, eliminadoEn: string | null = null): CampoProtegido {
  return {
    id,
    dispositivoId,
    nombre: 'PIN',
    tipo: 'pin',
    valorCifrado: '',
    orden: 0,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn,
  }
}

describe('dependenciasDeBaja', () => {
  it('encuentra las conexiones donde el equipo es origen o destino', () => {
    const datos = {
      conexiones: [conexion('c1', 'd1', 'd2'), conexion('c2', 'd3', 'd1'), conexion('c3', 'd2', 'd3')],
      credenciales: [],
      camposProtegidos: [],
    }
    const resultado = dependenciasDeBaja('d1', datos)
    expect(resultado.conexiones.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('excluye conexiones eliminadas', () => {
    const datos = {
      conexiones: [conexion('c1', 'd1', 'd2', '2026-01-01')],
      credenciales: [],
      camposProtegidos: [],
    }
    expect(dependenciasDeBaja('d1', datos).conexiones).toEqual([])
  })

  it('encuentra las credenciales vinculadas al equipo, sin importar si tienen otros vinculos', () => {
    const datos = {
      conexiones: [],
      credenciales: [
        credencial('cr1', [{ id: 'd1', nombre: 'Equipo 1' }]),
        credencial('cr2', [{ id: 'd1', nombre: 'Equipo 1' }, { id: 'd2', nombre: 'Equipo 2' }]),
        credencial('cr3', [{ id: 'd2', nombre: 'Equipo 2' }]),
      ],
      camposProtegidos: [],
    }
    const resultado = dependenciasDeBaja('d1', datos)
    expect(resultado.credenciales.map((c) => c.id)).toEqual(['cr1', 'cr2'])
  })

  it('excluye credenciales eliminadas', () => {
    const datos = {
      conexiones: [],
      credenciales: [credencial('cr1', [{ id: 'd1', nombre: 'Equipo 1' }], '2026-01-01')],
      camposProtegidos: [],
    }
    expect(dependenciasDeBaja('d1', datos).credenciales).toEqual([])
  })

  it('encuentra los campos protegidos del equipo, no los que son de otro o no tienen equipo', () => {
    const datos = {
      conexiones: [],
      credenciales: [],
      camposProtegidos: [campoProtegido('cp1', 'd1'), campoProtegido('cp2', 'd2'), campoProtegido('cp3', null)],
    }
    const resultado = dependenciasDeBaja('d1', datos)
    expect(resultado.camposProtegidos.map((c) => c.id)).toEqual(['cp1'])
  })
})

describe('sinDependencias', () => {
  it('true cuando las tres listas estan vacias', () => {
    expect(sinDependencias({ conexiones: [], credenciales: [], camposProtegidos: [] })).toBe(true)
  })

  it('false si queda al menos una dependencia', () => {
    expect(
      sinDependencias({ conexiones: [conexion('c1', 'd1', 'd2')], credenciales: [], camposProtegidos: [] }),
    ).toBe(false)
  })
})

describe('sinDispositivo', () => {
  it('quita solo el dispositivo indicado, conserva el resto', () => {
    const resultado = sinDispositivo(
      [{ id: 'd1', nombre: 'Equipo 1' }, { id: 'd2', nombre: 'Equipo 2' }],
      'd1',
    )
    expect(resultado).toEqual([{ id: 'd2', nombre: 'Equipo 2' }])
  })
})
