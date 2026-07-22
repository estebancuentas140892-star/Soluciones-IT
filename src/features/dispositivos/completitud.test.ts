import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { completitudDispositivo } from './completitud'

function dispositivoCompleto(): Dispositivo {
  return {
    id: 'disp-1',
    categoriaId: 'cat-1',
    nombre: 'Impresora Taquilla Norte',
    marca: 'Zebra',
    modelo: 'ZD230',
    serial: 'ZBR-991',
    placaInventario: '',
    ubicacion: 'Taquilla Norte',
    ubicacionId: 'ubi-1',
    responsable: '',
    responsableId: null,
    reemplazaA: null,
    ip: '',
    estado: 'operativo',
    observaciones: '',
    detalles: {},
    foto: { referencia: 'ref', nombre: 'foto.jpg', tipo: 'image/jpeg' },
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
  }
}

describe('completitudDispositivo', () => {
  it('una ficha con todas las señales da 100% y sin faltantes', () => {
    const resultado = completitudDispositivo(dispositivoCompleto(), false)
    expect(resultado).toEqual({ porcentaje: 100, faltantes: [] })
  })

  it('sin foto ni serial, calcula el porcentaje sobre las 8 señales base y los lista', () => {
    const dispositivo = { ...dispositivoCompleto(), foto: null, serial: '' }
    const resultado = completitudDispositivo(dispositivo, false)
    expect(resultado.porcentaje).toBe(75) // 6 de 8
    expect(resultado.faltantes).toEqual(['serial', 'foto'])
  })

  it('la ubicación cuenta como completa con solo el texto libre (sin migrar a la entidad)', () => {
    const dispositivo = { ...dispositivoCompleto(), ubicacionId: null }
    const resultado = completitudDispositivo(dispositivo, false)
    expect(resultado.faltantes).not.toContain('ubicación')
  })

  it('la ubicación falta si no hay ni entidad ni texto libre', () => {
    const dispositivo = { ...dispositivoCompleto(), ubicacionId: null, ubicacion: '' }
    const resultado = completitudDispositivo(dispositivo, false)
    expect(resultado.faltantes).toContain('ubicación')
  })

  it('la IP solo cuenta como señal en categorías de red', () => {
    const dispositivo = { ...dispositivoCompleto(), ip: '' }
    expect(completitudDispositivo(dispositivo, false).faltantes).not.toContain('dirección IP')
    expect(completitudDispositivo(dispositivo, true).faltantes).toContain('dirección IP')
  })

  it('una categoría de red completa (con IP) da 100% sobre 9 señales', () => {
    const dispositivo = { ...dispositivoCompleto(), ip: '10.0.0.5' }
    expect(completitudDispositivo(dispositivo, true)).toEqual({ porcentaje: 100, faltantes: [] })
  })

  it('trata como vacíos los campos undefined de migraciones sin backfill', () => {
    const dispositivo = { ...dispositivoCompleto() }
    // Simula un registro viejo donde el campo nunca se guardó.
    // @ts-expect-error prueba deliberada de un campo ausente
    delete dispositivo.serial
    const resultado = completitudDispositivo(dispositivo, false)
    expect(resultado.faltantes).toContain('serial')
  })

  it('una ficha vacía da 0%', () => {
    const vacio: Dispositivo = {
      id: 'disp-2',
      categoriaId: '',
      nombre: '',
      marca: '',
      modelo: '',
      serial: '',
      placaInventario: '',
      ubicacion: '',
      ubicacionId: null,
      responsable: '',
      responsableId: null,
      reemplazaA: null,
      ip: '',
      estado: '',
      observaciones: '',
      detalles: {},
      foto: null,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      eliminadoEn: null,
    }
    expect(completitudDispositivo(vacio, false).porcentaje).toBe(0)
  })
})
