import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { agruparPorUbicacion, SIN_UBICACION } from './grupoUbicacion'

function equipo(nombre: string, ubicacion: string, ubicacionId: string | null = null): Dispositivo {
  return {
    id: `d-${nombre}`,
    categoriaId: 'c1',
    nombre,
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion,
    ubicacionId,
    responsable: '',
    responsableId: null,
    reemplazaA: null,
    ip: '',
    estado: 'activo',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: '2026-09-01T00:00:00Z',
    updatedBy: null,
    eliminadoEn: null,
  }
}

const nombres = new Map([['u1', 'Rack principal']])

describe('agruparPorUbicacion', () => {
  // El hallazgo M-019: el mismo rack escrito de dos maneras producía dos
  // grupos, así que el técnico no encontraba el equipo donde lo buscaba.
  it('el mismo ubicacionId es un solo grupo aunque el texto esté escrito distinto', () => {
    const grupos = agruparPorUbicacion(
      [equipo('SW1', 'Rack 1', 'u1'), equipo('SW2', 'rack 1 ', 'u1')],
      nombres,
    )
    expect(grupos).toHaveLength(1)
    expect(grupos[0].equipos.map((e) => e.nombre)).toEqual(['SW1', 'SW2'])
  })

  it('el nombre del grupo lo pone la entidad, no la copia de referencia', () => {
    const grupos = agruparPorUbicacion([equipo('SW1', 'Rack 1', 'u1')], nombres)
    expect(grupos[0].nombre).toBe('Rack principal')
  })

  // La copia de referencia existe justo para esto: el id llegó pero la
  // fila de `ubicaciones` todavía no sincronizó.
  it('con la entidad sin sincronizar, el grupo se queda con la copia de referencia', () => {
    const grupos = agruparPorUbicacion([equipo('SW1', 'Rack 9', 'u9')], nombres)
    expect(grupos[0].nombre).toBe('Rack 9')
  })

  it('sin ubicacionId agrupa por el texto, sin distinguir acentos, mayúsculas ni espacios', () => {
    const grupos = agruparPorUbicacion(
      [equipo('SW1', 'Bodegón  Norte'), equipo('SW2', 'bodegon norte'), equipo('SW3', 'BODEGÓN NORTE')],
      nombres,
    )
    expect(grupos).toHaveLength(1)
    expect(grupos[0].equipos).toHaveLength(3)
  })

  // Elegir "la primera que apareció" haría que el nombre del grupo
  // cambiara con el orden de llegada de la sincronización.
  it('el nombre del grupo por texto es la grafía más repetida', () => {
    const grupos = agruparPorUbicacion(
      [equipo('SW1', 'rack 1'), equipo('SW2', 'Rack 1'), equipo('SW3', 'Rack 1')],
      nombres,
    )
    expect(grupos[0].nombre).toBe('Rack 1')
  })

  it('a igualdad de repeticiones desempata la comparación estricta, para que el nombre no baile', () => {
    const grupos = agruparPorUbicacion([equipo('SW1', 'rack 1'), equipo('SW2', 'Rack 1')], nombres)
    expect(grupos[0].nombre).toBe('Rack 1')
  })

  it('un equipo con id y otro con solo texto NO se mezclan: el id es el dato canónico', () => {
    const grupos = agruparPorUbicacion(
      [equipo('SW1', 'Rack principal', 'u1'), equipo('SW2', 'Rack principal')],
      nombres,
    )
    expect(grupos).toHaveLength(2)
  })

  it('los equipos sin ubicación quedan al final, en su propio grupo', () => {
    const grupos = agruparPorUbicacion(
      [equipo('SW1', ''), equipo('SW2', 'Zona Z'), equipo('SW3', 'Almacén')],
      nombres,
    )
    expect(grupos.map((g) => g.nombre)).toEqual(['Almacén', 'Zona Z', SIN_UBICACION])
  })

  it('ordena los grupos y sus equipos en orden natural', () => {
    const grupos = agruparPorUbicacion(
      [equipo('SW10', 'Rack 2'), equipo('SW2', 'Rack 2'), equipo('SW1', 'Rack 10')],
      nombres,
    )
    expect(grupos.map((g) => g.nombre)).toEqual(['Rack 2', 'Rack 10'])
    expect(grupos[0].equipos.map((e) => e.nombre)).toEqual(['SW2', 'SW10'])
  })

  it('redacta la cuenta con el singular concordado', () => {
    const grupos = agruparPorUbicacion([equipo('SW1', 'Rack 1'), equipo('SW2', 'Rack 2')], nombres)
    expect(grupos.map((g) => g.cuenta)).toEqual(['1 equipo', '1 equipo'])
  })

  it('sin equipos no hay grupos', () => {
    expect(agruparPorUbicacion([], nombres)).toEqual([])
  })
})
