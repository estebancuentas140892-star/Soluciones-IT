import { describe, expect, it } from 'vitest'
import type { NodoTopologia } from './arbol'
import { contiene, nodoInicial, raizPrincipal } from './nodoDeRed'

function nodo(dispositivoId: string, hijos: NodoTopologia[] = []): NodoTopologia {
  return {
    dispositivoId,
    nombre: dispositivoId,
    estado: 'activo',
    categoriaId: 'c1',
    via: '',
    tipoConexion: null,
    medio: '',
    hijos,
    truncado: false,
  }
}

// Rack con dos switches, uno de ellos con dos equipos colgando; y una
// raíz suelta sin nada debajo.
const rack = nodo('rack', [nodo('sw1', [nodo('ap1'), nodo('imp1')]), nodo('sw2')])
const suelto = nodo('suelto')
const bosque = [rack, suelto]

describe('raizPrincipal', () => {
  it('abre por la raíz de la que depende más gente', () => {
    expect(raizPrincipal(bosque)).toBe('rack')
  })

  it('a igualdad manda el orden del bosque, que ya viene natural por nombre', () => {
    expect(raizPrincipal([nodo('bravo'), nodo('alfa')])).toBe('bravo')
  })

  it('sin raíces no hay nodo de entrada', () => {
    expect(raizPrincipal([])).toBeNull()
  })
})

describe('contiene', () => {
  it('encuentra un equipo intermedio, no solo las raíces', () => {
    expect(contiene(bosque, 'ap1')).toBe(true)
    expect(contiene(bosque, 'sw2')).toBe(true)
  })

  it('dice que no cuando el equipo no está en el bosque', () => {
    expect(contiene(bosque, 'fantasma')).toBe(false)
  })
})

describe('nodoInicial', () => {
  it('respeta el nodo que se estaba recorriendo', () => {
    expect(nodoInicial('sw1', bosque)).toBe('sw1')
  })

  // Un enlace guardado a un equipo ya borrado no puede dejar la pestaña
  // en blanco: cae al nodo de entrada.
  it('cae a la raíz principal si el nodo recordado ya no existe', () => {
    expect(nodoInicial('borrado', bosque)).toBe('rack')
  })

  it('sin memoria abre por la raíz principal', () => {
    expect(nodoInicial(null, bosque)).toBe('rack')
  })

  it('sin bosque no hay nada que abrir', () => {
    expect(nodoInicial('sw1', [])).toBeNull()
  })
})
