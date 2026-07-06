import { describe, expect, it } from 'vitest'
import type { Conexion, Dispositivo } from '../../lib/db'
import { construirArbol, construirBosque, type NodoTopologia } from './arbol'

function dispositivo(id: string, nombre: string, categoriaId: string, eliminadoEn: string | null = null): Dispositivo {
  return {
    id,
    categoriaId,
    nombre,
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: '',
    ip: '',
    estado: '',
    observaciones: '',
    detalles: {},
    updatedAt: '',
    updatedBy: null,
    eliminadoEn,
  }
}

function enlace(id: string, origenId: string, puerto: string, destinoId: string): Conexion {
  return {
    id,
    tipo: 'enlace',
    origenId,
    origenNombre: origenId,
    origenPuerto: puerto,
    destinoId,
    destinoNombre: destinoId,
    destinoPuerto: '',
    medio: '',
    notas: '',
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
  }
}

function instalacion(id: string, equipoId: string, rackId: string): Conexion {
  return { ...enlace(id, equipoId, '', rackId), tipo: 'instalacion' }
}

function nombresDe(...ids: string[]): Map<string, string> {
  return new Map(ids.map((id) => [id, id]))
}

function hijos(nodo: NodoTopologia): string[] {
  return nodo.hijos.map((h) => h.dispositivoId)
}

describe('construirArbol', () => {
  it('expande un switch con sus dispositivos ordenados por puerto', () => {
    const conexiones = [
      enlace('a', 'sw', '2', 'ap'),
      enlace('b', 'sw', '10', 'cam'),
      enlace('c', 'sw', '1', 'pr'),
    ]
    const arbol = construirArbol('sw', conexiones, nombresDe('sw', 'ap', 'cam', 'pr'))
    expect(hijos(arbol)).toEqual(['pr', 'ap', 'cam'])
    expect(arbol.hijos[0].via).toBe('Puerto 1')
  })

  it('anida un rack que contiene un switch que enlaza equipos', () => {
    const conexiones = [instalacion('i', 'sw', 'rack'), enlace('a', 'sw', '1', 'ap')]
    const arbol = construirArbol('rack', conexiones, nombresDe('rack', 'sw', 'ap'))
    expect(hijos(arbol)).toEqual(['sw'])
    expect(arbol.hijos[0].via).toBe('Instalado')
    expect(hijos(arbol.hijos[0])).toEqual(['ap'])
  })

  it('corta los ciclos marcando el nodo repetido como truncado', () => {
    const conexiones = [enlace('a', 'sw1', '1', 'sw2'), enlace('b', 'sw2', '1', 'sw1')]
    const arbol = construirArbol('sw1', conexiones, nombresDe('sw1', 'sw2'))
    const sw2 = arbol.hijos[0]
    expect(sw2.dispositivoId).toBe('sw2')
    const sw1Repetido = sw2.hijos[0]
    expect(sw1Repetido.dispositivoId).toBe('sw1')
    expect(sw1Repetido.truncado).toBe(true)
    expect(sw1Repetido.hijos).toHaveLength(0)
  })
})

describe('construirBosque', () => {
  const esRed = (categoriaId: string) => categoriaId === 'red'

  it('usa como raíces los dispositivos sin padre y anida el resto', () => {
    const dispositivos = [
      dispositivo('rack', 'Rack A01', 'red'),
      dispositivo('sw', 'Switch D32', 'red'),
      dispositivo('ap', 'AP-01', 'red'),
    ]
    const conexiones = [instalacion('i', 'sw', 'rack'), enlace('a', 'sw', '1', 'ap')]
    const bosque = construirBosque(dispositivos, conexiones, esRed)
    expect(bosque.map((n) => n.dispositivoId)).toEqual(['rack'])
    expect(hijos(bosque[0])).toEqual(['sw'])
  })

  it('deja fuera los dispositivos que no son de red y no tienen conexiones', () => {
    const dispositivos = [
      dispositivo('sw', 'Switch D32', 'red'),
      dispositivo('pc', 'Computador recepción', 'computadores'),
    ]
    const bosque = construirBosque(dispositivos, [], esRed)
    expect(bosque.map((n) => n.dispositivoId)).toEqual(['sw'])
  })

  it('incluye un dispositivo que no es de red si participa en una conexión', () => {
    const dispositivos = [
      dispositivo('sw', 'Switch D32', 'red'),
      dispositivo('pc', 'Computador recepción', 'computadores'),
    ]
    const conexiones = [enlace('a', 'sw', '5', 'pc')]
    const bosque = construirBosque(dispositivos, conexiones, esRed)
    expect(bosque.map((n) => n.dispositivoId)).toEqual(['sw'])
    expect(hijos(bosque[0])).toEqual(['pc'])
  })
})
