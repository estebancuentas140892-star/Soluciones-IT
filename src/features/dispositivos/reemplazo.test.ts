import { describe, expect, it } from 'vitest'
import { migrarCampoProtegido, migrarConexion, migrarCredencial } from './reemplazo'
import type { CampoProtegido, Conexion, Credencial } from '../../lib/db'

const nuevo = { id: 'd-nuevo', nombre: 'Switch nuevo' }

function conexion(origenId: string, destinoId: string): Conexion {
  return {
    id: 'c1',
    tipo: 'enlace',
    origenId,
    origenNombre: 'Origen viejo',
    origenPuerto: '3',
    destinoId,
    destinoNombre: 'Destino viejo',
    destinoPuerto: '',
    medio: 'UTP',
    notas: '',
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
  }
}

function credencial(dispositivos: { id: string; nombre: string }[]): Credencial {
  return {
    id: 'cr1',
    titulo: 'Secreto',
    categoria: '',
    tipo: 'cuenta',
    datosCifrados: 'cifrado-original',
    venceEn: null,
    dispositivos,
    archivo: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
  }
}

function campoProtegido(dispositivoId: string | null): CampoProtegido {
  return {
    id: 'cp1',
    dispositivoId,
    nombre: 'PIN',
    tipo: 'pin',
    valorCifrado: 'cifrado-original',
    orden: 0,
    venceEn: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
  }
}

describe('migrarConexion', () => {
  it('reasigna el extremo origen cuando es el equipo saliente', () => {
    const resultado = migrarConexion(conexion('d-viejo', 'd-otro'), 'd-viejo', nuevo)
    expect(resultado.origenId).toBe('d-nuevo')
    expect(resultado.origenNombre).toBe('Switch nuevo')
    expect(resultado.destinoId).toBe('d-otro')
    expect(resultado.destinoNombre).toBe('Destino viejo')
  })

  it('reasigna el extremo destino cuando es el equipo saliente', () => {
    const resultado = migrarConexion(conexion('d-otro', 'd-viejo'), 'd-viejo', nuevo)
    expect(resultado.destinoId).toBe('d-nuevo')
    expect(resultado.destinoNombre).toBe('Switch nuevo')
    expect(resultado.origenId).toBe('d-otro')
  })

  it('no toca la conexion si ninguno de los extremos es el saliente', () => {
    const original = conexion('d-a', 'd-b')
    expect(migrarConexion(original, 'd-viejo', nuevo)).toEqual(original)
  })
})

describe('migrarCredencial', () => {
  it('reemplaza al saliente por el entrante, conserva otros vinculos y el contenido cifrado', () => {
    const original = credencial([{ id: 'd-viejo', nombre: 'Switch viejo' }, { id: 'd-otro', nombre: 'Otro equipo' }])
    const resultado = migrarCredencial(original, 'd-viejo', nuevo)
    expect(resultado.dispositivos).toEqual([
      { id: 'd-nuevo', nombre: 'Switch nuevo' },
      { id: 'd-otro', nombre: 'Otro equipo' },
    ])
    expect(resultado.datosCifrados).toBe('cifrado-original')
  })
})

describe('migrarCampoProtegido', () => {
  it('reasigna el dueño sin tocar el valor cifrado', () => {
    const resultado = migrarCampoProtegido(campoProtegido('d-viejo'), 'd-nuevo')
    expect(resultado.dispositivoId).toBe('d-nuevo')
    expect(resultado.valorCifrado).toBe('cifrado-original')
  })
})
