import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { buscarEquipos } from './busquedaEquipos'
import { agruparPorPersona, contextoDePersona, tituloEnLista } from './listaPorPersona'
import type { PersonasPorId } from './responsableEnLista'

// LA PERSONA PRIMERO (tarea 364, D4 de la auditoría del 2026-10-27). Todo es
// inventado.

function equipo(id: string, cambios: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id,
    categoriaId: 'cat-pc',
    nombre: id,
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
    estado: 'operativo',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: '2026-10-27T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

const PERSONAS: PersonasPorId = new Map([
  ['dr', { nombre: 'Daniel Restrepo', area: 'Compras', eliminadoEn: null }],
  ['da', { nombre: 'Daniel Arango', area: 'Tesorería', eliminadoEn: null }],
  ['lg', { nombre: 'Laura Gómez', area: '', eliminadoEn: null }],
])

const EQUIPOS = [
  equipo('PC-COMPRAS-04', { responsableId: 'dr', ubicacion: 'Parque de prueba' }),
  equipo('PC-TESORERIA-02', { responsableId: 'da', ubicacion: 'Sede de prueba' }),
  equipo('PORT-COMPRAS-07', { responsableId: 'dr', ubicacion: 'Parque de prueba' }),
  equipo('PC-BODEGA-01', { responsable: 'Archivo' }),
  equipo('PC-VIEJO', { responsableId: 'lg', estado: 'De baja' }),
]

describe('tituloEnLista', () => {
  it('quien tiene el equipo; si nadie (o está de baja o anotado), el equipo', () => {
    expect(tituloEnLista(EQUIPOS[0], PERSONAS)).toBe('Daniel Restrepo')
    expect(tituloEnLista(EQUIPOS[3], PERSONAS)).toBe('PC-BODEGA-01')
    expect(tituloEnLista(EQUIPOS[4], PERSONAS)).toBe('PC-VIEJO')
  })
})

describe('buscarEquipos por persona', () => {
  it('ordena por lo que se lee primero y, dentro de una persona, por el equipo', () => {
    const { generales } = buscarEquipos(EQUIPOS, new Set(), { texto: '', categoriaId: '' }, PERSONAS, { porPersona: true })
    expect(generales.map((d) => tituloEnLista(d, PERSONAS) + ' / ' + d.nombre)).toEqual([
      'Daniel Arango / PC-TESORERIA-02',
      'Daniel Restrepo / PC-COMPRAS-04',
      'Daniel Restrepo / PORT-COMPRAS-07',
      'PC-BODEGA-01 / PC-BODEGA-01',
      'PC-VIEJO / PC-VIEJO',
    ])
  })
})

describe('agruparPorPersona', () => {
  it('una persona con dos o más equipos, en un solo elemento en el sitio del primero', () => {
    const { generales } = buscarEquipos(EQUIPOS, new Set(), { texto: 'daniel', categoriaId: '' }, PERSONAS, { porPersona: true })
    const elementos = agruparPorPersona(generales, PERSONAS)
    expect(elementos.map((e) => (e.tipo === 'persona' ? `${e.nombre} (${e.equipos.length})` : e.dispositivo.nombre))).toEqual([
      'PC-TESORERIA-02',
      'Daniel Restrepo (2)',
    ])
    const grupo = elementos[1]
    expect(grupo.tipo === 'persona' && grupo.area).toBe('Compras')
  })

  it('lo anotado y lo de baja nunca se agrupan como una persona', () => {
    const lista = [
      equipo('A', { responsable: 'Archivo' }),
      equipo('B', { responsable: 'Archivo' }),
      equipo('C', { responsableId: 'lg', estado: 'De baja' }),
      equipo('D', { responsableId: 'lg', estado: 'De baja' }),
    ]
    expect(agruparPorPersona(lista, PERSONAS).every((e) => e.tipo === 'equipo')).toBe(true)
  })
})

describe('contextoDePersona', () => {
  it('el área y el sitio común una vez; sin sitio común, cada uno en su fila', () => {
    expect(contextoDePersona('Compras', ['Parque', 'Parque'])).toEqual({ cabecera: 'Compras · Parque', ubicacionEnFila: false })
    expect(contextoDePersona('Compras', ['Parque', 'Sede'])).toEqual({ cabecera: 'Compras', ubicacionEnFila: true })
    expect(contextoDePersona('Sistemas', ['Sistemas', 'Sistemas'])).toEqual({ cabecera: 'Sistemas', ubicacionEnFila: false })
    expect(contextoDePersona('', ['', ''])).toEqual({ cabecera: 'Sin área registrada', ubicacionEnFila: true })
  })
})
