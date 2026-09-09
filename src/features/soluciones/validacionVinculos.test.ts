import { describe, expect, it } from 'vitest'
import type { Articulo, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS, crearPaso } from '../../lib/procedimiento'
import { avisoDeVinculo, cierraCiclo, destinosDe } from './validacionVinculos'

function paso(parcial: Partial<PasoProcedimiento>): PasoProcedimiento {
  return { ...crearPaso(), titulo: 'Paso', ...parcial }
}

function articulo(id: string, pasos: PasoProcedimiento[], extra: Partial<Articulo> = {}): Articulo {
  return {
    id,
    categoriaId: 'cat',
    titulo: `Guía ${id}`,
    tipo: 'configuracion',
    contenido: '',
    etiquetas: [],
    procedimiento: {
      descripcion: '',
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      pasos,
      verificacionFinal: [],
      tiempoEstimadoMin: null,
      dificultad: null,
    },
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    ordenRutaInicio: 0,
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: '2026-09-09T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...extra,
  }
}

describe('destinosDe', () => {
  it('recoge los cuatro tipos de vínculo de un procedimiento', () => {
    const a = articulo('a', [
      paso({ subArticuloId: 'b', subArticuloTitulo: 'B' }),
      paso({ solucionArticuloId: 'c', solucionArticuloTitulo: 'C' }),
      paso({
        bloques: [
          { ...CAMPOS_BLOQUE_VACIOS, id: 't1', tipo: 'tarea', texto: '¿?', tipoTarea: 'decision', decisionArticuloId: 'd' },
          { ...CAMPOS_BLOQUE_VACIOS, id: 'g1', tipo: 'guia', guiaArticuloId: 'e', intencionGuia: 'necesario' },
        ],
      }),
    ])
    expect([...destinosDe(a)].sort()).toEqual(['b', 'c', 'd', 'e'])
  })

  it('un artículo sin procedimiento no apunta a nada', () => {
    expect(destinosDe(articulo('a', [], { procedimiento: null }))).toEqual(new Set())
  })
})

describe('cierraCiclo', () => {
  it('detecta el ciclo directo A -> B -> A', () => {
    const mapa = new Map([
      ['a', articulo('a', [])],
      ['b', articulo('b', [paso({ subArticuloId: 'a', subArticuloTitulo: 'A' })])],
    ])
    expect(cierraCiclo('a', 'b', mapa)).toBe(true)
  })

  it('detecta el ciclo indirecto A -> B -> C -> A', () => {
    const mapa = new Map([
      ['a', articulo('a', [])],
      ['b', articulo('b', [paso({ subArticuloId: 'c', subArticuloTitulo: 'C' })])],
      ['c', articulo('c', [paso({ solucionArticuloId: 'a', solucionArticuloTitulo: 'A' })])],
    ])
    expect(cierraCiclo('a', 'b', mapa)).toBe(true)
  })

  it('no confunde un vínculo normal con un ciclo', () => {
    const mapa = new Map([
      ['a', articulo('a', [])],
      ['b', articulo('b', [paso({ subArticuloId: 'c', subArticuloTitulo: 'C' })])],
      ['c', articulo('c', [])],
    ])
    expect(cierraCiclo('a', 'b', mapa)).toBe(false)
  })

  it('un ciclo entre terceros no cuelga la búsqueda', () => {
    const mapa = new Map([
      ['a', articulo('a', [])],
      ['b', articulo('b', [paso({ subArticuloId: 'c', subArticuloTitulo: 'C' })])],
      ['c', articulo('c', [paso({ subArticuloId: 'b', subArticuloTitulo: 'B' })])],
    ])
    expect(cierraCiclo('a', 'b', mapa)).toBe(false)
  })

  it('vincularse a sí mismo es un ciclo', () => {
    expect(cierraCiclo('a', 'a', new Map())).toBe(true)
  })
})

describe('avisoDeVinculo', () => {
  const base = new Map([['a', articulo('a', [])]])

  it('avisa de un destino que ya no está', () => {
    expect(avisoDeVinculo('a', 'zzz', base)).toContain('ya no está disponible')
  })

  it('avisa de un destino sin publicar', () => {
    const mapa = new Map(base)
    mapa.set('b', articulo('b', [], { estado: 'borrador' }))
    expect(avisoDeVinculo('a', 'b', mapa)).toContain('no está publicada')
  })

  it('avisa del recorrido circular con el nombre de la guía', () => {
    const mapa = new Map(base)
    mapa.set('b', articulo('b', [paso({ subArticuloId: 'a', subArticuloTitulo: 'A' })]))
    expect(avisoDeVinculo('a', 'b', mapa)).toContain('vuelve a apuntar a esta guía')
  })

  it('un vínculo correcto no genera aviso', () => {
    const mapa = new Map(base)
    mapa.set('b', articulo('b', []))
    expect(avisoDeVinculo('a', 'b', mapa)).toBeNull()
  })
})
