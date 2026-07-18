import { describe, expect, it } from 'vitest'
import {
  claveUbicacion,
  construirMigracion,
  planInicial,
  textosSinUbicacion,
  type GrupoMigracion,
} from './migracion'
import type { Dispositivo } from '../../lib/db'

// Dispositivo minimo para las pruebas: solo los campos que la migracion
// mira. El cast evita repetir los ~15 campos que no intervienen.
function disp(
  id: string,
  ubicacion: string,
  extra: Partial<Pick<Dispositivo, 'ubicacionId' | 'eliminadoEn'>> = {},
): Dispositivo {
  return {
    id,
    ubicacion,
    ubicacionId: extra.ubicacionId ?? null,
    eliminadoEn: extra.eliminadoEn ?? null,
  } as Dispositivo
}

describe('claveUbicacion', () => {
  it('ignora mayusculas y espacios de sobra', () => {
    expect(claveUbicacion('  Taquilla   Norte ')).toBe('taquilla norte')
    expect(claveUbicacion('TAQUILLA NORTE')).toBe(claveUbicacion('taquilla norte'))
  })
})

describe('textosSinUbicacion', () => {
  it('agrupa variantes de escritura y cuenta los equipos', () => {
    const textos = textosSinUbicacion([
      disp('1', 'Taquilla Norte'),
      disp('2', 'taquilla norte'),
      disp('3', 'Taq. Norte'),
      disp('4', 'Bodega'),
    ])
    expect(textos).toEqual([
      { texto: 'Bodega', cantidad: 1 },
      { texto: 'Taq. Norte', cantidad: 1 },
      { texto: 'Taquilla Norte', cantidad: 2 },
    ])
  })

  it('excluye eliminados, vacios y los que ya tienen ubicacionId', () => {
    const textos = textosSinUbicacion([
      disp('1', 'Bodega'),
      disp('2', '   '),
      disp('3', 'Sala', { eliminadoEn: '2026-01-01' }),
      disp('4', 'Rack A', { ubicacionId: 'u1' }),
    ])
    expect(textos).toEqual([{ texto: 'Bodega', cantidad: 1 }])
  })
})

describe('planInicial', () => {
  it('crea un grupo por texto distinto con id del factory', () => {
    let n = 0
    const grupos = planInicial(
      [
        { texto: 'Bodega', cantidad: 1 },
        { texto: 'Sala', cantidad: 2 },
      ],
      () => `id-${++n}`,
    )
    expect(grupos).toEqual([
      { id: 'id-1', nombre: 'Bodega', claves: ['bodega'] },
      { id: 'id-2', nombre: 'Sala', claves: ['sala'] },
    ])
  })
})

describe('construirMigracion', () => {
  const dispositivos = [
    disp('1', 'Taquilla Norte'),
    disp('2', 'taquilla norte'),
    disp('3', 'Bodega'),
    disp('4', 'Rack A', { ubicacionId: 'ya' }),
  ]

  it('crea una ubicacion por grupo y asigna cada dispositivo', () => {
    const grupos: GrupoMigracion[] = [
      { id: 'u-taq', nombre: 'Taquilla Norte', claves: ['taquilla norte'] },
      { id: 'u-bod', nombre: 'Bodega', claves: ['bodega'] },
    ]
    const resultado = construirMigracion(dispositivos, grupos)
    expect(resultado.ubicaciones).toEqual([
      { id: 'u-taq', nombre: 'Taquilla Norte' },
      { id: 'u-bod', nombre: 'Bodega' },
    ])
    // Los dos equipos con variantes del mismo texto caen en la misma
    // ubicacion; el que ya tenia ubicacionId no se toca.
    expect(resultado.asignaciones).toEqual([
      { dispositivoId: '1', ubicacionId: 'u-taq', nombre: 'Taquilla Norte' },
      { dispositivoId: '2', ubicacionId: 'u-taq', nombre: 'Taquilla Norte' },
      { dispositivoId: '3', ubicacionId: 'u-bod', nombre: 'Bodega' },
    ])
  })

  it('fusiona varios textos en una sola ubicacion', () => {
    const grupos: GrupoMigracion[] = [
      { id: 'u1', nombre: 'Taquilla Norte', claves: ['taquilla norte', 'bodega'] },
    ]
    const resultado = construirMigracion(dispositivos, grupos)
    expect(resultado.ubicaciones).toEqual([{ id: 'u1', nombre: 'Taquilla Norte' }])
    expect(resultado.asignaciones.map((a) => a.dispositivoId).sort()).toEqual(['1', '2', '3'])
    expect(resultado.asignaciones.every((a) => a.ubicacionId === 'u1')).toBe(true)
  })

  it('descarta grupos sin nombre y no crea ubicaciones vacias', () => {
    const grupos: GrupoMigracion[] = [
      { id: 'u1', nombre: '   ', claves: ['taquilla norte'] },
      { id: 'u2', nombre: 'Bodega', claves: ['bodega'] },
      { id: 'u3', nombre: 'Sala sin equipos', claves: ['sala sin equipos'] },
    ]
    const resultado = construirMigracion(dispositivos, grupos)
    // u1 se descarta (sin nombre), u3 no tiene equipos: solo se crea u2.
    expect(resultado.ubicaciones).toEqual([{ id: 'u2', nombre: 'Bodega' }])
    expect(resultado.asignaciones).toEqual([
      { dispositivoId: '3', ubicacionId: 'u2', nombre: 'Bodega' },
    ])
  })
})
