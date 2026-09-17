import { describe, expect, it } from 'vitest'
import type { Articulo, ProgresoPasos } from '../../lib/db'
import { lineaAvanceGuia } from './accionGuia'
import { accionesDeGuia } from './useAccionesDeGuia'

// El reparto que comparten el catalogo de Guias y las acciones directas
// del buscador global (tarea 241). La decision de QUE ofrece cada guia
// sigue siendo de `accionDeGuia`, probada aparte: aqui se comprueba que
// el mapa la aplica sobre las guias correctas y con el avance correcto.

function articulo(id: string, nPasos: number): Articulo {
  return {
    id,
    titulo: `Guía ${id}`,
    tipo: 'instalacion',
    procedimiento: {
      pasos: Array.from({ length: nPasos }, (_, i) => ({ id: `p${i + 1}`, titulo: `Paso ${i + 1}` })),
    },
  } as unknown as Articulo
}

/** Un artículo sin procedimiento: un manual, o un borrador vacío. */
function sinPasos(id: string): Articulo {
  return { id, titulo: `Notas ${id}`, tipo: 'instalacion', procedimiento: null } as unknown as Articulo
}

function progreso(articuloId: string, pasosHechos: string[]): ProgresoPasos {
  return { articuloId, pasosHechos, actualizadoEn: '2026-09-15T10:00:00.000Z' } as ProgresoPasos
}

describe('accionesDeGuia', () => {
  it('sin avance guardado, una guía ejecutable ofrece empezar', () => {
    const mapa = accionesDeGuia([articulo('a', 3)], [])
    expect(mapa.get('a')?.estado).toBe('empezar')
    expect(lineaAvanceGuia(mapa.get('a'))).toBeNull()
  })

  it('con avance a medias ofrece continuar, diciendo en qué paso va', () => {
    const mapa = accionesDeGuia([articulo('a', 3)], [progreso('a', ['p1'])])
    expect(mapa.get('a')?.estado).toBe('continuar')
    expect(lineaAvanceGuia(mapa.get('a'))).toBe('Vas en el paso 2 de 3')
  })

  it('el paso pendiente es el primero SIN hacer, no "hechos + 1"', () => {
    // Cerrar el 2 y el 3 saltándose el 1 debe seguir llevando al 1.
    const mapa = accionesDeGuia([articulo('a', 3)], [progreso('a', ['p2', 'p3'])])
    expect(lineaAvanceGuia(mapa.get('a'))).toBe('Vas en el paso 1 de 3')
  })

  it('con todo hecho ofrece repetir', () => {
    const mapa = accionesDeGuia([articulo('a', 2)], [progreso('a', ['p1', 'p2'])])
    expect(mapa.get('a')?.estado).toBe('repetir')
  })

  it('una guía sin pasos NO entra en el mapa: no hay ejecución que ofrecer', () => {
    const mapa = accionesDeGuia([sinPasos('n'), articulo('a', 1)], [])
    expect(mapa.has('n')).toBe(false)
    expect(mapa.has('a')).toBe(true)
  })

  it('un progreso huérfano (su guía ya no está) no inventa ninguna entrada', () => {
    const mapa = accionesDeGuia([articulo('a', 2)], [progreso('a', ['p1']), progreso('fantasma', ['p1'])])
    expect([...mapa.keys()]).toEqual(['a'])
  })
})
