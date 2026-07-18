import { describe, expect, it } from 'vitest'
import type { Conexion, Dispositivo } from '../../lib/db'
import {
  caminoAscendente,
  construirArbol,
  construirBosque,
  contarImpacto,
  infoDeDispositivos,
  type InfoDispositivo,
  type NodoTopologia,
} from './arbol'

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
    ubicacionId: null,
    ip: '',
    estado: '',
    observaciones: '',
    detalles: {},
    foto: null,
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

function nombresDe(...ids: string[]): Map<string, InfoDispositivo> {
  return new Map(ids.map((id) => [id, { nombre: id, estado: '', categoriaId: '' }]))
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

  it('ignora las conexiones relacionado: no entran en la topología', () => {
    // Grupo N3: relacionar un POS con su impresora (equipos no de red) no
    // es una dependencia de servicio y no debe aparecer en el árbol.
    const dispositivos = [
      dispositivo('pos', 'POS Caja 1', 'pos'),
      dispositivo('imp', 'Impresora', 'pos'),
    ]
    const relacionado: Conexion = { ...enlace('r', 'pos', '', 'imp'), tipo: 'relacionado' }
    const bosque = construirBosque(dispositivos, [relacionado], esRed)
    expect(bosque).toHaveLength(0)
  })
})

describe('contarImpacto', () => {
  it('cuenta todos los descendientes agrupados por categoria, no solo los hijos directos', () => {
    const dispositivos = [
      dispositivo('rack', 'Rack A01', 'red'),
      dispositivo('sw', 'Switch D32', 'red'),
      dispositivo('pos1', 'POS Caja 1', 'pos'),
      dispositivo('pos2', 'POS Caja 2', 'pos'),
      dispositivo('imp', 'Impresora Caja 1', 'impresoras'),
    ]
    const conexiones = [
      instalacion('i', 'sw', 'rack'),
      enlace('a', 'sw', '1', 'pos1'),
      enlace('b', 'sw', '2', 'pos2'),
      enlace('c', 'pos1', '', 'imp'),
    ]
    const infoPorId = infoDeDispositivos(dispositivos)
    const arbolDesdeRack = construirArbol('rack', conexiones, infoPorId)
    const impacto = contarImpacto(arbolDesdeRack)
    expect(impacto.get('red')).toBe(1) // el switch
    expect(impacto.get('pos')).toBe(2)
    expect(impacto.get('impresoras')).toBe(1)
  })

  it('no cuenta nada para un nodo sin hijos', () => {
    const infoPorId = infoDeDispositivos([dispositivo('sw', 'Switch', 'red')])
    const arbol = construirArbol('sw', [], infoPorId)
    expect(contarImpacto(arbol).size).toBe(0)
  })
})

describe('caminoAscendente', () => {
  it('devuelve la cadena de dependencia del padre inmediato hasta la raíz', () => {
    const dispositivos = [
      dispositivo('rack', 'Rack A01', 'red'),
      dispositivo('sw', 'Switch Oficina', 'red'),
      dispositivo('pos1', 'POS Caja 1', 'pos'),
    ]
    const conexiones = [instalacion('i', 'sw', 'rack'), enlace('a', 'sw', '12', 'pos1')]
    const infoPorId = infoDeDispositivos(dispositivos)
    const camino = caminoAscendente('pos1', conexiones, infoPorId)
    expect(camino.map((p) => p.dispositivoId)).toEqual(['sw', 'rack'])
    expect(camino[0].via).toBe('Puerto 12')
    expect(camino[0].nombre).toBe('Switch Oficina')
    expect(camino[1].via).toBe('Instalado')
  })

  it('devuelve una lista vacía si el dispositivo no depende de nada', () => {
    const infoPorId = infoDeDispositivos([dispositivo('rack', 'Rack A01', 'red')])
    expect(caminoAscendente('rack', [], infoPorId)).toEqual([])
  })

  it('se detiene ante un ciclo sin colgarse', () => {
    const dispositivos = [dispositivo('sw1', 'Switch 1', 'red'), dispositivo('sw2', 'Switch 2', 'red')]
    const conexiones = [enlace('a', 'sw1', '1', 'sw2'), enlace('b', 'sw2', '1', 'sw1')]
    const infoPorId = infoDeDispositivos(dispositivos)
    const camino = caminoAscendente('sw1', conexiones, infoPorId)
    expect(camino.map((p) => p.dispositivoId)).toEqual(['sw2'])
  })
})
