import { describe, expect, it } from 'vitest'
import {
  claveUbicacion,
  coincidenciaDeUbicacion,
  construirMigracion,
  existenteConNombre,
  planInicial,
  posiblesCoincidencias,
  textosSinUbicacion,
  type GrupoMigracion,
} from './migracion'
import type { Dispositivo, Ubicacion } from '../../lib/db'

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

function ubic(id: string, nombre: string, eliminadoEn: string | null = null): Ubicacion {
  return { id, nombre, padreId: null, notas: '', updatedAt: '', updatedBy: null, eliminadoEn }
}

describe('claveUbicacion', () => {
  it('ignora mayusculas y espacios de sobra', () => {
    expect(claveUbicacion('  Taquilla   Norte ')).toBe('taquilla norte')
    expect(claveUbicacion('TAQUILLA NORTE')).toBe(claveUbicacion('taquilla norte'))
  })

  it('conserva las tildes: cambiar una tilde no es una equivalencia segura', () => {
    expect(claveUbicacion('Tesorería')).not.toBe(claveUbicacion('TESORERIA'))
  })
})

describe('textosSinUbicacion', () => {
  it('agrupa variantes de escritura, cuenta los equipos y enseña las variantes', () => {
    const textos = textosSinUbicacion([
      disp('1', 'Taquilla Norte'),
      disp('2', 'taquilla norte'),
      disp('3', 'Taq. Norte'),
      disp('4', 'Bodega'),
    ])
    expect(textos).toEqual([
      { texto: 'Bodega', cantidad: 1, variantes: ['Bodega'] },
      { texto: 'Taq. Norte', cantidad: 1, variantes: ['Taq. Norte'] },
      { texto: 'Taquilla Norte', cantidad: 2, variantes: ['Taquilla Norte', 'taquilla norte'] },
    ])
  })

  it('excluye eliminados, vacios y los que ya tienen ubicacionId', () => {
    const textos = textosSinUbicacion([
      disp('1', 'Bodega'),
      disp('2', '   '),
      disp('3', 'Sala', { eliminadoEn: '2026-01-01' }),
      disp('4', 'Rack A', { ubicacionId: 'u1' }),
    ])
    expect(textos).toEqual([{ texto: 'Bodega', cantidad: 1, variantes: ['Bodega'] }])
  })

  it('los ejemplos del encargo: mayúsculas y espacios se unen solos', () => {
    const textos = textosSinUbicacion([
      disp('1', 'Logistica'),
      disp('2', 'LOGISTICA'),
      disp('3', 'Compras'),
      disp('4', 'compras '),
      disp('5', 'Mantenimiento PN'),
      disp('6', 'MANTENIMIENTO  PN'),
    ])
    expect(textos.map((t) => [t.texto, t.cantidad])).toEqual([
      ['Compras', 2],
      ['Logistica', 2],
      ['Mantenimiento PN', 2],
    ])
  })
})

describe('posibles coincidencias (se señalan, nunca se unen solas)', () => {
  it('una abreviatura: "ADMINISTRACION PN" y "Administración Parque Norte"', () => {
    expect(coincidenciaDeUbicacion('ADMINISTRACION PN', 'Administración Parque Norte')).toBe('abreviatura')
    expect(coincidenciaDeUbicacion('Taq. Norte', 'Taquilla Norte')).toBe('abreviatura')
  })

  it('solo las tildes: "TESORERIA" y "Tesorería"', () => {
    expect(coincidenciaDeUbicacion('TESORERIA', 'Tesorería')).toBe('tildes')
  })

  it('un error de tecleo en un nombre largo', () => {
    expect(coincidenciaDeUbicacion('Mantenimeinto', 'Mantenimiento')).toBe('escritura')
  })

  it('no confunde lugares distintos', () => {
    expect(coincidenciaDeUbicacion('Sala 1', 'Sala 2')).toBeNull()
    expect(coincidenciaDeUbicacion('Archivo', 'Archivo Central')).toBeNull()
    expect(coincidenciaDeUbicacion('Sistemas', 'Contabilidad')).toBeNull()
    expect(coincidenciaDeUbicacion('Compras', 'Caja')).toBeNull()
  })

  it('lo que ya es equivalente de forma segura no se pregunta', () => {
    expect(coincidenciaDeUbicacion('LOGISTICA', 'Logistica')).toBeNull()
  })

  it('se pregunta al texto con menos equipos, y primero por las ubicaciones que ya existen', () => {
    const textos = textosSinUbicacion([
      disp('1', 'Administración Parque Norte'),
      disp('2', 'Administración Parque Norte'),
      disp('3', 'ADMINISTRACION PN'),
      disp('4', 'SISTEMAS'),
      disp('5', 'Tesoreria'),
    ])
    const existentes = [ubic('u-sis', 'Sistemas'), ubic('u-tes', 'Tesorería')]
    const coincidencias = posiblesCoincidencias(textos, existentes)
    // "SISTEMAS" ya es "Sistemas" (equivalencia segura): no se pregunta.
    expect(coincidencias).toEqual([
      { clave: 'tesoreria', con: { tipo: 'ubicacion', id: 'u-tes', nombre: 'Tesorería' }, motivo: 'tildes' },
      {
        clave: 'administracion pn',
        con: { tipo: 'texto', clave: 'administración parque norte', texto: 'Administración Parque Norte' },
        motivo: 'abreviatura',
      },
    ])
  })
})

describe('planInicial', () => {
  it('crea un grupo por texto distinto con id del factory', () => {
    let n = 0
    const grupos = planInicial(
      [
        { texto: 'Bodega', cantidad: 1, variantes: ['Bodega'] },
        { texto: 'Sala', cantidad: 2, variantes: ['Sala'] },
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
    expect(resultado.existentesUsadas).toEqual([])
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

  it('un nombre que ya existe reutiliza esa ubicacion en vez de duplicarla', () => {
    const grupos: GrupoMigracion[] = [
      { id: 'nuevo-bodega', nombre: 'BODEGA', claves: ['bodega'] },
      { id: 'u-taq', nombre: 'Taquilla Norte', claves: ['taquilla norte'] },
    ]
    const existentes = [ubic('u-bodega', 'Bodega')]
    const resultado = construirMigracion(dispositivos, grupos, existentes)
    expect(resultado.ubicaciones).toEqual([{ id: 'u-taq', nombre: 'Taquilla Norte' }])
    expect(resultado.existentesUsadas).toEqual([{ id: 'u-bodega', nombre: 'Bodega' }])
    // El equipo se vincula a la existente y toma su nombre tal cual.
    expect(resultado.asignaciones.find((a) => a.dispositivoId === '3')).toEqual({
      dispositivoId: '3',
      ubicacionId: 'u-bodega',
      nombre: 'Bodega',
    })
  })

  it('si dos ubicaciones se llaman igual, no adivina cual: el grupo no se aplica', () => {
    const existentes = [ubic('u-a', 'Bodega'), ubic('u-b', 'Bodega')]
    expect(existenteConNombre('Bodega', existentes)).toBeNull()
    const resultado = construirMigracion(dispositivos, [{ id: 'g', nombre: 'Bodega', claves: ['bodega'] }], existentes)
    expect(resultado.asignaciones).toEqual([])
    expect(resultado.ubicaciones).toEqual([])
  })

  it('una ubicacion eliminada no se reutiliza', () => {
    const existentes = [ubic('u-vieja', 'Bodega', '2026-01-01T00:00:00.000Z')]
    const resultado = construirMigracion(dispositivos, [{ id: 'g', nombre: 'Bodega', claves: ['bodega'] }], existentes)
    expect(resultado.ubicaciones).toEqual([{ id: 'g', nombre: 'Bodega' }])
  })
})
