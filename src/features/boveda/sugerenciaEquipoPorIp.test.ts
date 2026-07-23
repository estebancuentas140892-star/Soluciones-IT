import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { equipoPorIpOUrl } from './sugerenciaEquipoPorIp'

function dispositivo(parcial: Partial<Dispositivo> & { id: string; nombre: string; ip: string }): Dispositivo {
  return {
    categoriaId: 'cat-1',
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: '',
    ubicacionId: null,
    responsable: '',
    responsableId: null,
    reemplazaA: null,
    estado: 'operativo',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...parcial,
  }
}

describe('equipoPorIpOUrl', () => {
  it('encuentra el equipo cuando el texto es exactamente la IP', () => {
    const d = dispositivo({ id: 'd1', nombre: 'Switch A', ip: '192.168.1.10' })
    expect(equipoPorIpOUrl('192.168.1.10', [d])).toEqual(d)
  })

  it('encuentra el equipo cuando la IP aparece dentro de una URL', () => {
    const d = dispositivo({ id: 'd1', nombre: 'Switch A', ip: '192.168.1.10' })
    expect(equipoPorIpOUrl('https://192.168.1.10/admin', [d])).toEqual(d)
  })

  it('no encuentra nada si ningún equipo tiene esa IP', () => {
    const d = dispositivo({ id: 'd1', nombre: 'Switch A', ip: '192.168.1.10' })
    expect(equipoPorIpOUrl('https://10.0.0.5/admin', [d])).toBeNull()
  })

  it('ignora un equipo sin IP registrada', () => {
    const d = dispositivo({ id: 'd1', nombre: 'Switch A', ip: '' })
    expect(equipoPorIpOUrl('cualquier texto', [d])).toBeNull()
  })

  it('devuelve null con texto vacío', () => {
    const d = dispositivo({ id: 'd1', nombre: 'Switch A', ip: '192.168.1.10' })
    expect(equipoPorIpOUrl('', [d])).toBeNull()
  })
})
