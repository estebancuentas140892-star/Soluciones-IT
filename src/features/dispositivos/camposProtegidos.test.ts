import { describe, expect, it } from 'vitest'
import type { CampoProtegido } from '../../lib/db'
import {
  camposDeDispositivo,
  esOcultoPorDefecto,
  etiquetaTipo,
  siguienteOrden,
  validarNombre,
} from './camposProtegidos'

function campo(parcial: Partial<CampoProtegido> = {}): CampoProtegido {
  return {
    id: 'c1',
    dispositivoId: 'd1',
    nombre: 'Contraseña',
    tipo: 'contrasena',
    valorCifrado: 'v1.600000.a.b.c',
    orden: 0,
    updatedAt: '2026-07-21T10:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...parcial,
  }
}

describe('camposDeDispositivo', () => {
  it('devuelve solo los del equipo pedido y excluye los eliminados', () => {
    const campos = [
      campo({ id: 'a', dispositivoId: 'd1', nombre: 'Usuario' }),
      campo({ id: 'b', dispositivoId: 'd2', nombre: 'Otro equipo' }),
      campo({ id: 'c', dispositivoId: 'd1', nombre: 'Borrado', eliminadoEn: '2026-07-21T11:00:00.000Z' }),
    ]
    expect(camposDeDispositivo(campos, 'd1').map((c) => c.id)).toEqual(['a'])
  })

  it('ordena por orden y, a igualdad, por nombre', () => {
    const campos = [
      campo({ id: 'a', nombre: 'PIN', orden: 2 }),
      campo({ id: 'b', nombre: 'Zeta', orden: 0 }),
      campo({ id: 'c', nombre: 'Alfa', orden: 0 }),
    ]
    expect(camposDeDispositivo(campos, 'd1').map((c) => c.id)).toEqual(['c', 'b', 'a'])
  })

  it('un dispositivo sin campos devuelve lista vacia', () => {
    expect(camposDeDispositivo([campo({ dispositivoId: 'otro' })], 'd1')).toEqual([])
  })
})

describe('siguienteOrden', () => {
  it('empieza en 0 cuando no hay campos', () => {
    expect(siguienteOrden([])).toBe(0)
  })

  it('va al final de los existentes', () => {
    expect(siguienteOrden([campo({ orden: 0 }), campo({ orden: 4 }), campo({ orden: 2 })])).toBe(5)
  })
})

describe('validarNombre', () => {
  const existentes = [campo({ id: 'a', nombre: 'Contraseña' }), campo({ id: 'b', nombre: 'PIN' })]

  it('rechaza un nombre vacio o solo espacios', () => {
    expect(validarNombre('', existentes, null)).toBeTruthy()
    expect(validarNombre('   ', existentes, null)).toBeTruthy()
  })

  it('rechaza un duplicado sin distinguir mayusculas ni acentos', () => {
    expect(validarNombre('contrasena', existentes, null)).toBeTruthy()
    expect(validarNombre('  CONTRASEÑA ', existentes, null)).toBeTruthy()
  })

  it('acepta un nombre nuevo', () => {
    expect(validarNombre('Token API', existentes, null)).toBeNull()
  })

  it('al editar, no se considera duplicado de si mismo', () => {
    expect(validarNombre('Contraseña', existentes, 'a')).toBeNull()
    // Pero si sigue chocando con OTRO campo, se rechaza.
    expect(validarNombre('PIN', existentes, 'a')).toBeTruthy()
  })
})

describe('tipos de campo', () => {
  it('el usuario se muestra en claro y los secretos ocultos', () => {
    expect(esOcultoPorDefecto('usuario')).toBe(false)
    expect(esOcultoPorDefecto('contrasena')).toBe(true)
    expect(esOcultoPorDefecto('pin')).toBe(true)
  })

  it('un tipo desconocido cae a oculto (lado seguro)', () => {
    expect(esOcultoPorDefecto('inventado' as never)).toBe(true)
    expect(etiquetaTipo('inventado' as never)).toBe('Otro dato')
  })
})
