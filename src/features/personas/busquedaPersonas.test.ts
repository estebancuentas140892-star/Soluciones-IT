import { describe, expect, it } from 'vitest'
import { buscarPersonas, coincidenciaDePersona } from './busquedaPersonas'

// EL BUSCADOR DE PERSONAS (encargo del 2026-11-26, sección 6). Todo lo que
// se usa aquí es INVENTADO.

const personas = [
  { id: 'a', nombre: 'Daniel Esteban García de Prueba', area: 'Control Interno' },
  { id: 'b', nombre: 'Juliana de Prueba', area: 'Mercadeo' },
  { id: 'c', nombre: 'Ana María de Prueba', area: '' },
  { id: 'd', nombre: 'Daniela de Prueba', area: 'Sistemas' },
  { id: 'e', nombre: 'Pedro de Prueba', area: 'Turno de la mañana' },
]

const ids = (lista: { id: string }[]) => lista.map((p) => p.id)

describe('buscarPersonas', () => {
  it('encuentra cada palabra en cualquier orden y sin tildes', () => {
    expect(ids(buscarPersonas(personas, 'garcia daniel'))).toEqual(['a'])
    expect(ids(buscarPersonas(personas, 'GARCÍA'))).toEqual(['a'])
  })

  it('busca también por el área, que distingue a dos personas parecidas', () => {
    expect(ids(buscarPersonas(personas, 'control interno'))).toEqual(['a'])
    expect(ids(buscarPersonas(personas, 'daniel sistemas'))).toEqual(['d'])
  })

  it('pone primero a quien empieza por lo escrito, después el resto del nombre y al final el área', () => {
    // "ana": Ana María empieza por ella; Juliana la tiene dentro; Pedro solo
    // por su área ("mañana").
    expect(ids(buscarPersonas(personas, 'ana'))).toEqual(['c', 'b', 'e'])
  })

  it('dentro de cada grupo conserva el orden de la lista', () => {
    expect(ids(buscarPersonas(personas, 'daniel'))).toEqual(['a', 'd'])
  })

  it('sin texto devuelve la lista tal cual', () => {
    expect(ids(buscarPersonas(personas, '   '))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('una palabra que no está en ningún sitio deja fuera a la persona', () => {
    expect(coincidenciaDePersona(personas[0], 'daniel tesoreria')).toBeNull()
  })

  it('tolera una persona guardada sin área', () => {
    expect(coincidenciaDePersona({ nombre: 'Rita de Prueba', area: undefined as unknown as string }, 'rita')).toBe(0)
  })
})
