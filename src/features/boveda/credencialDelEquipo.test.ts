import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Credencial, Dispositivo, TipoSecreto } from '../../lib/db'
import {
  claveDeFinalidad,
  credencialesDeAccesoDelEquipo,
  esIdDeEquipo,
  resolverCredencialDelEquipo,
  TIPOS_DE_ACCESO,
} from './credencialDelEquipo'

// La credencial del equipo con el que se trabaja (tarea 290, fase 2):
// reglas puras. Datos INVENTADOS con la forma de los reales: ningún
// equipo, credencial, IP ni secreto existe. `datosCifrados` lleva un
// texto que NO es un cifrado real y que no debe aparecer nunca en lo que
// devuelve la resolución más allá de la propia fila.

const SECRETO_FALSO = 'cifrado-falso-que-nunca-se-lee'

function equipo(id: string, extra: Partial<Dispositivo> = {}): Pick<Dispositivo, 'id' | 'eliminadoEn'> & Partial<Dispositivo> {
  return { id, nombre: `Equipo ${id}`, eliminadoEn: null, ...extra }
}

function credencial(
  id: string,
  equipos: string[],
  extra: Partial<Omit<Credencial, 'tipo'>> & { tipo?: TipoSecreto } = {},
): Credencial {
  return {
    id,
    titulo: `Credencial ${id}`,
    categoria: '',
    tipo: 'cuenta',
    datosCifrados: SECRETO_FALSO,
    venceEn: null,
    dispositivos: equipos.map((e) => ({ id: e, nombre: `Equipo ${e}` })),
    archivo: null,
    updatedAt: '2026-10-03T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...extra,
  }
}

const resolver = (
  equipoId: unknown,
  credenciales: Credencial[],
  equipos: ReturnType<typeof equipo>[],
  finalidad?: unknown,
) => resolverCredencialDelEquipo({ equipoId, finalidad }, { equipos, credenciales })

let consola: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  consola = (['log', 'info', 'warn', 'error', 'debug'] as const).map((metodo) =>
    vi.spyOn(console, metodo).mockImplementation(() => {}),
  )
})
afterEach(() => {
  // Ninguna regla escribe en consola: ni un aviso, ni un error, ni un dato.
  for (const espia of consola) expect(espia).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

describe('el caso representativo: una guía de impresoras para varias impresoras', () => {
  // Muchos equipos con una credencial, como la Bóveda ya los relaciona:
  // A da acceso a dos impresoras, B a otras tres. C no tiene credencial.
  // D tiene dos credenciales de la misma finalidad. E, dos de finalidades
  // distintas.
  const equipos = ['imp-a1', 'imp-a2', 'imp-b1', 'imp-b2', 'imp-b3', 'imp-c', 'imp-d', 'srv-e'].map((id) => equipo(id))
  const credenciales = [
    credencial('cred-a', ['imp-a1', 'imp-a2'], { categoria: 'Impresoras' }),
    credencial('cred-b', ['imp-b1', 'imp-b2', 'imp-b3'], { categoria: 'Impresoras' }),
    credencial('cred-d1', ['imp-d'], { categoria: 'Impresoras' }),
    credencial('cred-d2', ['imp-d'], { categoria: 'Impresoras' }),
    credencial('cred-e-remoto', ['srv-e'], { categoria: 'Escritorio remoto' }),
    credencial('cred-e-programa', ['srv-e'], { categoria: 'Programa de caja' }),
  ]

  it('impresora A: la credencial A', () => {
    const r = resolver('imp-a1', credenciales, equipos)
    expect(r).toEqual({ estado: 'resuelta', credencial: credenciales[0] })
    expect(resolver('imp-a2', credenciales, equipos)).toMatchObject({ estado: 'resuelta', credencial: { id: 'cred-a' } })
  })

  it('impresora B: la credencial B, en las tres impresoras que comparte', () => {
    for (const id of ['imp-b1', 'imp-b2', 'imp-b3']) {
      expect(resolver(id, credenciales, equipos)).toMatchObject({ estado: 'resuelta', credencial: { id: 'cred-b' } })
    }
  })

  it('impresora C, sin credencial: ninguna, sin buscar otra', () => {
    expect(resolver('imp-c', credenciales, equipos)).toEqual({ estado: 'ninguna' })
  })

  it('impresora D, con dos de la misma finalidad: ambigua, sin elegir una', () => {
    expect(resolver('imp-d', credenciales, equipos)).toEqual({ estado: 'varias', cuantas: 2 })
    expect(resolver('imp-d', credenciales, equipos, 'Impresoras')).toEqual({ estado: 'varias', cuantas: 2 })
  })

  it('equipo E, con dos finalidades distintas: la acción que pide una resuelve solo esa', () => {
    expect(resolver('srv-e', credenciales, equipos, 'Escritorio remoto')).toMatchObject({
      estado: 'resuelta',
      credencial: { id: 'cred-e-remoto' },
    })
    expect(resolver('srv-e', credenciales, equipos, 'Programa de caja')).toMatchObject({
      estado: 'resuelta',
      credencial: { id: 'cred-e-programa' },
    })
    // Sin decir cuál, no se puede saber: no se escoge la primera.
    expect(resolver('srv-e', credenciales, equipos)).toEqual({ estado: 'varias', cuantas: 2 })
  })
})

describe('el equipo en contexto', () => {
  const equipos = [equipo('eq-1'), equipo('eq-borrado', { eliminadoEn: '2026-09-01T00:00:00.000Z' })]
  const credenciales = [credencial('cred-1', ['eq-1']), credencial('cred-borrado', ['eq-borrado'])]

  it('sin equipo, o con un identificador que no es un texto con contenido: sin equipo', () => {
    for (const invalido of [null, undefined, '', '   ', 42, {}, ['eq-1'], true]) {
      expect(resolver(invalido, credenciales, equipos)).toEqual({ estado: 'sin-equipo' })
    }
    expect(esIdDeEquipo('eq-1')).toBe(true)
    expect(esIdDeEquipo(' ')).toBe(false)
  })

  it('un equipo que no existe en este teléfono: no disponible, aunque una credencial lo nombre', () => {
    const conRelacionHuerfana = [...credenciales, credencial('cred-huerfana', ['eq-inexistente'])]
    expect(resolver('eq-inexistente', conRelacionHuerfana, equipos)).toEqual({ estado: 'equipo-no-disponible' })
  })

  it('un equipo eliminado: no disponible, y su credencial no se usa', () => {
    expect(resolver('eq-borrado', credenciales, equipos)).toEqual({ estado: 'equipo-no-disponible' })
  })

  it('el identificador se compara exacto: ni recortado, ni sin mayúsculas', () => {
    expect(resolver(' eq-1', credenciales, equipos)).toEqual({ estado: 'equipo-no-disponible' })
    expect(resolver('EQ-1', credenciales, equipos)).toEqual({ estado: 'equipo-no-disponible' })
  })
})

describe('solo por la relación de la Bóveda, nunca por nombres, modelos ni IP', () => {
  it('una credencial que nombra al equipo en su título o su categoría, sin relación, no cuenta', () => {
    const equipos = [equipo('imp-x', { nombre: 'Impresora de prueba X', modelo: 'Modelo 9', ip: '192.0.2.10' })]
    const credenciales = [
      credencial('cred-titulo', [], { titulo: 'Impresora de prueba X', categoria: 'Modelo 9' }),
      credencial('cred-ip', [], { titulo: 'Acceso 192.0.2.10' }),
    ]
    expect(resolver('imp-x', credenciales, equipos)).toEqual({ estado: 'ninguna' })
  })

  it('dos equipos con el mismo nombre y la misma IP se distinguen por su identificador', () => {
    const equipos = [
      equipo('gemelo-1', { nombre: 'Impresora gemela', ip: '192.0.2.20' }),
      equipo('gemelo-2', { nombre: 'Impresora gemela', ip: '192.0.2.20' }),
    ]
    const credenciales = [credencial('cred-g1', ['gemelo-1']), credencial('cred-g2', ['gemelo-2'])]
    expect(resolver('gemelo-1', credenciales, equipos)).toMatchObject({ credencial: { id: 'cred-g1' } })
    expect(resolver('gemelo-2', credenciales, equipos)).toMatchObject({ credencial: { id: 'cred-g2' } })
  })
})

describe('qué cuenta como credencial del equipo', () => {
  const equipos = [equipo('eq')]

  it('una credencial eliminada no se usa: si era la única, ninguna', () => {
    const credenciales = [credencial('cred-eliminada', ['eq'], { eliminadoEn: '2026-09-30T00:00:00.000Z' })]
    expect(resolver('eq', credenciales, equipos)).toEqual({ estado: 'ninguna' })
  })

  it('una eliminada tampoco empata: con otra viva, resuelve la viva', () => {
    const credenciales = [
      credencial('cred-eliminada', ['eq'], { eliminadoEn: '2026-09-30T00:00:00.000Z' }),
      credencial('cred-viva', ['eq']),
    ]
    expect(resolver('eq', credenciales, equipos)).toMatchObject({ estado: 'resuelta', credencial: { id: 'cred-viva' } })
  })

  it('una credencial que no está en este teléfono no existe para la resolución', () => {
    expect(resolver('eq', [], equipos)).toEqual({ estado: 'ninguna' })
  })

  it('solo los accesos compiten: un token, un archivo o una nota del equipo no', () => {
    expect([...TIPOS_DE_ACCESO]).toEqual(['cuenta', 'red'])
    const credenciales = [
      credencial('cred-acceso', ['eq'], { tipo: 'cuenta' }),
      credencial('cred-licencia', ['eq'], { tipo: 'llave' }),
      credencial('cred-archivo', ['eq'], { tipo: 'archivo' }),
      credencial('cred-nota', ['eq'], { tipo: 'nota' }),
    ]
    expect(resolver('eq', credenciales, equipos)).toMatchObject({ estado: 'resuelta', credencial: { id: 'cred-acceso' } })
    // Una clave o PIN también es un acceso.
    const conPin = [...credenciales, credencial('cred-pin', ['eq'], { tipo: 'red' })]
    expect(resolver('eq', conPin, equipos)).toEqual({ estado: 'varias', cuantas: 2 })
  })

  it('una fila sin clase (de antes de la columna) es una cuenta', () => {
    const sinTipo = { ...credencial('cred-vieja', ['eq']), tipo: undefined } as unknown as Credencial
    expect(resolver('eq', [sinTipo], equipos)).toMatchObject({ estado: 'resuelta', credencial: { id: 'cred-vieja' } })
  })

  it('una credencial vencida no es una eliminada: se resuelve (la consulta muestra su aviso)', () => {
    const credenciales = [credencial('cred-vencida', ['eq'], { venceEn: '2020-01-01' })]
    expect(resolver('eq', credenciales, equipos)).toMatchObject({ estado: 'resuelta', credencial: { id: 'cred-vencida' } })
  })

  it('una relación malformada no rompe nada ni cuenta', () => {
    const rotas = [
      { ...credencial('cred-nula', []), dispositivos: null },
      { ...credencial('cred-texto', []), dispositivos: 'eq' },
      { ...credencial('cred-elementos', []), dispositivos: [null, 'eq', 7, { nombre: 'eq' }] },
    ] as unknown as Credencial[]
    expect(resolver('eq', rotas, equipos)).toEqual({ estado: 'ninguna' })
  })

  it('la misma fila repetida cuenta una vez', () => {
    const una = credencial('cred-repetida', ['eq'])
    expect(resolver('eq', [una, { ...una }], equipos)).toMatchObject({ estado: 'resuelta', credencial: { id: 'cred-repetida' } })
    expect(credencialesDeAccesoDelEquipo('eq', [una, { ...una }]).map((c) => c.id)).toEqual(['cred-repetida'])
  })
})

describe('la finalidad', () => {
  const equipos = [equipo('srv')]
  const credenciales = [
    credencial('cred-remoto', ['srv'], { categoria: 'Escritorio remoto' }),
    credencial('cred-programa', ['srv'], { categoria: 'Programa de caja' }),
  ]

  it('se compara exacta, sin mayúsculas, tildes ni espacios de más', () => {
    expect(claveDeFinalidad('  Escritorio   REMOTO ')).toBe('escritorio remoto')
    expect(claveDeFinalidad('Administración')).toBe(claveDeFinalidad('administracion'))
    expect(resolver('srv', credenciales, equipos, 'escritorio  remóto')).toMatchObject({
      estado: 'resuelta',
      credencial: { id: 'cred-remoto' },
    })
  })

  it('nunca parcial: "Escritorio" no es "Escritorio remoto"', () => {
    expect(resolver('srv', credenciales, equipos, 'Escritorio')).toEqual({ estado: 'ninguna' })
  })

  it('una finalidad que el equipo no tiene: ninguna, aunque tenga otras', () => {
    expect(resolver('srv', credenciales, equipos, 'Base de datos')).toEqual({ estado: 'ninguna' })
  })

  it('una finalidad vacía o que no es texto equivale a no pedir ninguna', () => {
    for (const sinFinalidad of ['', '   ', undefined, null, 3]) {
      expect(resolver('srv', credenciales, equipos, sinFinalidad)).toEqual({ estado: 'varias', cuantas: 2 })
    }
  })

  it('con finalidad, una credencial sin categoría no se supone de esa finalidad', () => {
    const conUnaSinCategoria = [credencial('cred-sin-categoria', ['srv'])]
    expect(resolver('srv', conUnaSinCategoria, equipos, 'Escritorio remoto')).toEqual({ estado: 'ninguna' })
    expect(resolver('srv', conUnaSinCategoria, equipos)).toMatchObject({ estado: 'resuelta' })
  })
})

describe('sin efectos', () => {
  it('no cambia lo que recibe y devuelve la fila tal cual, sin nada descifrado', () => {
    const equipos = [equipo('eq')]
    const credenciales = [credencial('cred', ['eq'], { categoria: 'Impresoras' })]
    const copia = structuredClone(credenciales)
    const r = resolver('eq', credenciales, equipos, 'impresoras')
    expect(credenciales).toEqual(copia)
    expect(r).toMatchObject({ estado: 'resuelta' })
    // La resolución no añade datos: lo único "secreto" que lleva es el
    // bloque cifrado que la fila ya traía, que la interfaz no pinta.
    expect(Object.keys(r).sort()).toEqual(['credencial', 'estado'])
  })

  it('un equipo sin nada no lanza: ninguna regla tira errores con datos dentro', () => {
    expect(() => resolver('eq', [], [])).not.toThrow()
    expect(resolver('eq', [], [])).toEqual({ estado: 'equipo-no-disponible' })
  })
})
