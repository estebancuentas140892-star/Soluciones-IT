import { describe, expect, it } from 'vitest'
import type { Conexion, Dispositivo } from './db'
import {
  agruparConexiones,
  candidatosConexion,
  compararNatural,
  datosSegunModo,
  desdeExtremo,
  proximoPuertoLibre,
  resumenConexion,
  type ExtremoConexion,
} from './conexiones'

function dispositivo(parcial: Partial<Dispositivo> & { id: string; nombre: string }): Dispositivo {
  return {
    categoriaId: 'cat-generica',
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
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...parcial,
  }
}

function conexion(parcial: Partial<Conexion>): Conexion {
  return {
    id: parcial.id ?? 'c1',
    tipo: parcial.tipo ?? 'enlace',
    origenId: parcial.origenId ?? 'origen',
    origenNombre: parcial.origenNombre ?? 'Switch D32',
    origenPuerto: parcial.origenPuerto ?? '',
    destinoId: parcial.destinoId ?? 'destino',
    destinoNombre: parcial.destinoNombre ?? 'Punto de red D80',
    destinoPuerto: parcial.destinoPuerto ?? '',
    medio: parcial.medio ?? '',
    notas: parcial.notas ?? '',
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: parcial.eliminadoEn ?? null,
  }
}

describe('compararNatural', () => {
  it('ordena los puertos por número y no alfabéticamente', () => {
    const puertos = ['Puerto 10', 'Puerto 2', 'Puerto 1']
    expect([...puertos].sort(compararNatural)).toEqual(['Puerto 1', 'Puerto 2', 'Puerto 10'])
  })
})

describe('resumenConexion', () => {
  it('describe un enlace con sus puertos', () => {
    const texto = resumenConexion(conexion({ origenPuerto: '18' }))
    expect(texto).toBe('Switch D32 (puerto 18) → Punto de red D80')
  })

  it('describe una instalación en rack', () => {
    const texto = resumenConexion(
      conexion({ tipo: 'instalacion', origenNombre: 'Switch D32', destinoNombre: 'Rack A01' }),
    )
    expect(texto).toBe('Switch D32 instalado en Rack A01')
  })

  it('describe una relación entre equipos no de red', () => {
    const texto = resumenConexion(
      conexion({ tipo: 'relacionado', origenNombre: 'POS Caja 1', destinoNombre: 'Impresora tickets' }),
    )
    expect(texto).toBe('POS Caja 1 relacionado con Impresora tickets')
  })
})

describe('desdeExtremo', () => {
  it('ve la conexión desde el origen', () => {
    const extremo = desdeExtremo(conexion({ origenPuerto: '18' }), 'origen')
    expect(extremo.esOrigen).toBe(true)
    expect(extremo.otroId).toBe('destino')
    expect(extremo.otroNombre).toBe('Punto de red D80')
    expect(extremo.puertoLocal).toBe('18')
  })

  it('ve la misma conexión desde el destino', () => {
    const extremo = desdeExtremo(conexion({ origenPuerto: '18', destinoPuerto: '' }), 'destino')
    expect(extremo.esOrigen).toBe(false)
    expect(extremo.otroId).toBe('origen')
    expect(extremo.otroNombre).toBe('Switch D32')
    expect(extremo.puertoRemoto).toBe('18')
  })
})

describe('agruparConexiones', () => {
  it('separa instalación, contenido y enlaces, y descarta las eliminadas', () => {
    const switchId = 'sw'
    const conexiones: Conexion[] = [
      conexion({ id: 'a', tipo: 'instalacion', origenId: switchId, destinoId: 'rack', destinoNombre: 'Rack A01' }),
      conexion({ id: 'b', tipo: 'enlace', origenId: switchId, origenPuerto: '2', destinoId: 'ap', destinoNombre: 'AP-01' }),
      conexion({ id: 'c', tipo: 'enlace', origenId: switchId, origenPuerto: '10', destinoId: 'cam', destinoNombre: 'C-08' }),
      conexion({ id: 'd', tipo: 'enlace', origenId: switchId, origenPuerto: '1', destinoId: 'pr', destinoNombre: 'D80' }),
      conexion({ id: 'e', tipo: 'enlace', origenId: switchId, destinoId: 'x', eliminadoEn: '2026-01-01' }),
      conexion({ id: 'f', tipo: 'enlace', origenId: 'otro', destinoId: 'noRelacionada' }),
    ]

    const grupos = agruparConexiones(conexiones, switchId)

    expect(grupos.instaladoEn.map((e) => e.otroNombre)).toEqual(['Rack A01'])
    expect(grupos.contiene).toHaveLength(0)
    // Ordenados por puerto de forma natural: 1, 2, 10.
    expect(grupos.enlaces.map((e) => e.puertoLocal)).toEqual(['1', '2', '10'])
  })

  it('desde la ficha del rack ve lo que contiene', () => {
    const conexiones: Conexion[] = [
      conexion({ id: 'a', tipo: 'instalacion', origenId: 'sw', origenNombre: 'Switch D32', destinoId: 'rack' }),
    ]
    const grupos = agruparConexiones(conexiones, 'rack')
    expect(grupos.contiene.map((e) => e.otroNombre)).toEqual(['Switch D32'])
    expect(grupos.instaladoEn).toHaveLength(0)
  })

  it('agrupa las relaciones entre equipos no de red aparte de los enlaces', () => {
    const posId = 'pos'
    const conexiones: Conexion[] = [
      conexion({ id: 'r1', tipo: 'relacionado', origenId: posId, origenNombre: 'POS Caja 1', destinoId: 'imp', destinoNombre: 'Impresora' }),
      conexion({ id: 'r2', tipo: 'relacionado', origenId: 'lector', origenNombre: 'Lector', destinoId: posId }),
    ]
    const grupos = agruparConexiones(conexiones, posId)
    expect(grupos.enlaces).toHaveLength(0)
    // Ordenados por el nombre del otro extremo (vivo se resuelve en la UI).
    expect(grupos.relacionados.map((e) => e.otroNombre)).toEqual(['Impresora', 'Lector'])
  })
})

describe('datosSegunModo', () => {
  it('"enlace": este dispositivo es el origen (da servicio al otro)', () => {
    expect(datosSegunModo('enlace')).toEqual({
      tipo: 'enlace',
      origenEsteDispositivo: true,
      conPuertos: true,
    })
  })

  it('"recibeDe": el otro dispositivo es el origen (hallazgo N1: sin esto, documentar "el switch me da servicio" desde la ficha del punto invertía la topología)', () => {
    expect(datosSegunModo('recibeDe')).toEqual({
      tipo: 'enlace',
      origenEsteDispositivo: false,
      conPuertos: true,
    })
  })

  it('"instalado": este dispositivo es el origen (se instala en el otro)', () => {
    expect(datosSegunModo('instalado')).toEqual({
      tipo: 'instalacion',
      origenEsteDispositivo: true,
      conPuertos: false,
    })
  })

  it('"contiene": el otro dispositivo es el origen (se instala en este)', () => {
    expect(datosSegunModo('contiene')).toEqual({
      tipo: 'instalacion',
      origenEsteDispositivo: false,
      conPuertos: false,
    })
  })

  it('"relacionado": sin puertos, este dispositivo como origen por convención', () => {
    expect(datosSegunModo('relacionado')).toEqual({
      tipo: 'relacionado',
      origenEsteDispositivo: true,
      conPuertos: false,
    })
  })
})

describe('candidatosConexion', () => {
  const equipoActual = dispositivo({ id: 'e1', nombre: 'Punto de red D80', ubicacionId: 'ubi-1' })
  const idsRed = new Set(['cat-red'])

  it('con texto, filtra por nombre/ubicación/ip igual que antes', () => {
    const candidatos = [
      dispositivo({ id: 'd1', nombre: 'Switch A', ubicacion: 'Bodega' }),
      dispositivo({ id: 'd2', nombre: 'Impresora B', ubicacion: 'Oficina' }),
    ]
    expect(candidatosConexion(candidatos, 'switch', equipoActual, idsRed).map((d) => d.id)).toEqual(['d1'])
  })

  it('con texto, ordena primero el candidato de la misma ubicación', () => {
    const candidatos = [
      dispositivo({ id: 'd1', nombre: 'Switch A', ubicacionId: 'ubi-2' }),
      dispositivo({ id: 'd2', nombre: 'Switch B', ubicacionId: 'ubi-1' }),
    ]
    expect(candidatosConexion(candidatos, 'switch', equipoActual, idsRed).map((d) => d.id)).toEqual([
      'd2',
      'd1',
    ])
  })

  it('con texto, ordena primero una categoría de red cuando no hay coincidencia de ubicación', () => {
    const candidatos = [
      dispositivo({ id: 'd1', nombre: 'Switch A', categoriaId: 'cat-generica' }),
      dispositivo({ id: 'd2', nombre: 'Switch B', categoriaId: 'cat-red' }),
    ]
    expect(candidatosConexion(candidatos, 'switch', equipoActual, idsRed).map((d) => d.id)).toEqual([
      'd2',
      'd1',
    ])
  })

  it('sin texto, pre-sugiere los candidatos de la misma ubicación o de categoría de red', () => {
    const candidatos = [
      dispositivo({ id: 'd1', nombre: 'Rack A', ubicacionId: 'ubi-1' }),
      dispositivo({ id: 'd2', nombre: 'Switch de otra sede', categoriaId: 'cat-red' }),
      dispositivo({ id: 'd3', nombre: 'Impresora', categoriaId: 'cat-generica' }),
    ]
    expect(candidatosConexion(candidatos, '', equipoActual, idsRed).map((d) => d.id)).toEqual(['d1', 'd2'])
  })

  it('sin texto y sin ninguna pista real, no sugiere nada', () => {
    const candidatos = [dispositivo({ id: 'd1', nombre: 'Impresora', categoriaId: 'cat-generica' })]
    expect(candidatosConexion(candidatos, '', equipoActual, idsRed)).toEqual([])
  })

  it('respeta el límite', () => {
    const candidatos = Array.from({ length: 10 }, (_, i) =>
      dispositivo({ id: `d${i}`, nombre: `Switch ${i}`, ubicacionId: 'ubi-1' }),
    )
    expect(candidatosConexion(candidatos, 'switch', equipoActual, idsRed, 3)).toHaveLength(3)
  })
})

function extremoConPuerto(puertoLocal: string): ExtremoConexion {
  return desdeExtremo(conexion({ origenId: 'yo', origenPuerto: puertoLocal }), 'yo')
}

describe('proximoPuertoLibre', () => {
  it('propone el puerto 1 cuando el switch no tiene ningún enlace', () => {
    expect(proximoPuertoLibre([])).toBe('1')
  })

  it('propone el siguiente consecutivo tras los ya usados', () => {
    expect(proximoPuertoLibre([extremoConPuerto('1'), extremoConPuerto('2'), extremoConPuerto('3')])).toBe(
      '4',
    )
  })

  it('propone el menor puerto libre, no el máximo + 1, si hay un hueco', () => {
    expect(proximoPuertoLibre([extremoConPuerto('1'), extremoConPuerto('3')])).toBe('2')
  })

  it('ignora puertos no numéricos sin romper el cálculo', () => {
    expect(proximoPuertoLibre([extremoConPuerto('Gi0/1'), extremoConPuerto('1')])).toBe('2')
  })

  it('ignora puertos vacíos o en blanco', () => {
    expect(proximoPuertoLibre([extremoConPuerto(''), extremoConPuerto('1')])).toBe('2')
  })
})
