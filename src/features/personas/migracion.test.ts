import { describe, expect, it } from 'vitest'
import {
  candidatosPersona,
  clavePersona,
  construirMigracion,
  textosSinPersona,
  type GrupoMigracion,
} from './migracion'
import type { Dispositivo } from '../../lib/db'

// Dispositivo minimo para las pruebas: solo los campos que la migracion
// mira. El cast evita repetir los ~15 campos que no intervienen.
function disp(
  id: string,
  detalles: Record<string, string>,
  extra: Partial<Pick<Dispositivo, 'responsableId' | 'eliminadoEn'>> = {},
): Dispositivo {
  return {
    id,
    detalles,
    responsableId: extra.responsableId ?? null,
    eliminadoEn: extra.eliminadoEn ?? null,
  } as Dispositivo
}

describe('clavePersona', () => {
  it('ignora mayusculas y espacios de sobra', () => {
    expect(clavePersona('  Juan   Perez ')).toBe('juan perez')
    expect(clavePersona('JUAN PEREZ')).toBe(clavePersona('juan perez'))
  })
})

describe('candidatosPersona', () => {
  it('encuentra la clave candidata sin distinguir mayusculas ni acentos', () => {
    const candidatos = candidatosPersona([
      disp('1', { 'Usuario asignado': 'Juan Pérez' }),
      disp('2', { RESPONSABLE: 'Ana Ruiz' }),
      disp('3', { 'Asignado a': 'Luis Gómez' }),
      disp('4', { Marca: 'HP' }),
    ])
    expect(candidatos).toEqual([
      { dispositivoId: '1', claveDetalle: 'Usuario asignado', texto: 'Juan Pérez' },
      { dispositivoId: '2', claveDetalle: 'RESPONSABLE', texto: 'Ana Ruiz' },
      { dispositivoId: '3', claveDetalle: 'Asignado a', texto: 'Luis Gómez' },
    ])
  })

  it('excluye eliminados, sin valor y los que ya tienen responsableId', () => {
    const candidatos = candidatosPersona([
      disp('1', { Responsable: 'Ana Ruiz' }),
      disp('2', { Responsable: '   ' }),
      disp('3', { Responsable: 'Sala' }, { eliminadoEn: '2026-01-01' }),
      disp('4', { Responsable: 'Ya migrado' }, { responsableId: 'p1' }),
    ])
    expect(candidatos).toEqual([{ dispositivoId: '1', claveDetalle: 'Responsable', texto: 'Ana Ruiz' }])
  })

  it('con varias claves candidatas en el mismo equipo, gana la de mayor prioridad', () => {
    const candidatos = candidatosPersona([disp('1', { Empleado: 'Ana', 'Usuario asignado': 'Juan' })])
    expect(candidatos).toEqual([{ dispositivoId: '1', claveDetalle: 'Usuario asignado', texto: 'Juan' }])
  })
})

describe('textosSinPersona', () => {
  it('agrupa variantes de escritura y cuenta los equipos', () => {
    const candidatos = candidatosPersona([
      disp('1', { Responsable: 'Juan Perez' }),
      disp('2', { Responsable: 'juan perez' }),
      disp('3', { Responsable: 'Ana Ruiz' }),
    ])
    expect(textosSinPersona(candidatos)).toEqual([
      { texto: 'Ana Ruiz', cantidad: 1 },
      { texto: 'Juan Perez', cantidad: 2 },
    ])
  })
})

describe('construirMigracion', () => {
  const candidatos = candidatosPersona([
    disp('1', { Responsable: 'Juan Perez' }),
    disp('2', { 'Usuario asignado': 'juan perez' }),
    disp('3', { Responsable: 'Ana Ruiz' }),
    disp('4', { Responsable: 'Ya migrado' }, { responsableId: 'ya' }),
  ])

  it('crea una persona por grupo, asigna cada dispositivo y conserva su clave de detalle', () => {
    const grupos: GrupoMigracion[] = [
      { id: 'p-juan', nombre: 'Juan Pérez', claves: ['juan perez'] },
      { id: 'p-ana', nombre: 'Ana Ruiz', claves: ['ana ruiz'] },
    ]
    const resultado = construirMigracion(candidatos, grupos)
    expect(resultado.personas).toEqual([
      { id: 'p-juan', nombre: 'Juan Pérez' },
      { id: 'p-ana', nombre: 'Ana Ruiz' },
    ])
    expect(resultado.asignaciones).toEqual([
      { dispositivoId: '1', personaId: 'p-juan', nombre: 'Juan Pérez', claveDetalle: 'Responsable' },
      { dispositivoId: '2', personaId: 'p-juan', nombre: 'Juan Pérez', claveDetalle: 'Usuario asignado' },
      { dispositivoId: '3', personaId: 'p-ana', nombre: 'Ana Ruiz', claveDetalle: 'Responsable' },
    ])
  })

  it('fusiona varios textos en una sola persona', () => {
    const grupos: GrupoMigracion[] = [
      { id: 'p1', nombre: 'Juan Pérez', claves: ['juan perez', 'ana ruiz'] },
    ]
    const resultado = construirMigracion(candidatos, grupos)
    expect(resultado.personas).toEqual([{ id: 'p1', nombre: 'Juan Pérez' }])
    expect(resultado.asignaciones.map((a) => a.dispositivoId).sort()).toEqual(['1', '2', '3'])
    expect(resultado.asignaciones.every((a) => a.personaId === 'p1')).toBe(true)
  })

  it('descarta grupos sin nombre y no crea personas vacias', () => {
    const grupos: GrupoMigracion[] = [
      { id: 'p1', nombre: '   ', claves: ['juan perez'] },
      { id: 'p2', nombre: 'Ana Ruiz', claves: ['ana ruiz'] },
      { id: 'p3', nombre: 'Sin equipos', claves: ['sin equipos'] },
    ]
    const resultado = construirMigracion(candidatos, grupos)
    expect(resultado.personas).toEqual([{ id: 'p2', nombre: 'Ana Ruiz' }])
    expect(resultado.asignaciones).toEqual([
      { dispositivoId: '3', personaId: 'p2', nombre: 'Ana Ruiz', claveDetalle: 'Responsable' },
    ])
  })
})
