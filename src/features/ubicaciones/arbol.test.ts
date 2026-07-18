import { describe, expect, it } from 'vitest'
import type { Ubicacion } from '../../lib/db'
import {
  cadenaNombres,
  hijosDirectos,
  idsDescendientes,
  mapaPorId,
  ordenarPorRuta,
  rutaUbicacion,
} from './arbol'

function ubi(id: string, nombre: string, padreId: string | null = null, eliminadoEn: string | null = null): Ubicacion {
  return { id, nombre, padreId, notas: '', updatedAt: '', updatedBy: null, eliminadoEn }
}

const sede = ubi('sede', 'Sede Norte')
const area = ubi('area', 'Área caja', 'sede')
const taq = ubi('taq', 'Taquilla 2', 'area')
const bodega = ubi('bod', 'Bodega')
const lista = [sede, area, taq, bodega]

describe('cadenaNombres / rutaUbicacion', () => {
  it('devuelve la cadena de la raíz a la hoja', () => {
    const porId = mapaPorId(lista)
    expect(cadenaNombres('taq', porId)).toEqual(['Sede Norte', 'Área caja', 'Taquilla 2'])
    expect(rutaUbicacion('taq', porId)).toBe('Sede Norte > Área caja > Taquilla 2')
  })

  it('no se cuelga ante un ciclo', () => {
    const a = ubi('a', 'A', 'b')
    const b = ubi('b', 'B', 'a')
    const porId = mapaPorId([a, b])
    expect(cadenaNombres('a', porId).length).toBeLessThanOrEqual(2)
  })
})

describe('hijosDirectos', () => {
  it('devuelve las raíces con padre null y los hijos por id', () => {
    expect(hijosDirectos(null, lista).map((u) => u.id)).toEqual(['bod', 'sede'])
    expect(hijosDirectos('sede', lista).map((u) => u.id)).toEqual(['area'])
  })
})

describe('idsDescendientes', () => {
  it('incluye la ubicación y toda su descendencia', () => {
    expect([...idsDescendientes('sede', lista)].sort()).toEqual(['area', 'sede', 'taq'])
    expect([...idsDescendientes('bod', lista)]).toEqual(['bod'])
  })
})

describe('ordenarPorRuta', () => {
  it('ordena por la ruta completa y excluye eliminadas', () => {
    const conEliminada = [...lista, ubi('x', 'Zulú', null, '2026-01-01')]
    expect(ordenarPorRuta(conEliminada).map((u) => u.id)).toEqual(['bod', 'sede', 'area', 'taq'])
  })
})
