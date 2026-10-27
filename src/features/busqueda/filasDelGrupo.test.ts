import { describe, expect, it } from 'vitest'
import { alcanceDelGrupo, textoVerAlcance, TOPE_EN_TODO } from './alcanceBusqueda'
import { filasDelGrupo, soloLaMenciona, textoMencionan } from './presentacionResultados'
import { agruparResultados } from './resultados'
import type { CampoIndice, ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// TRES POR GRUPO EN «TODO» Y LO QUE SOLO MENCIONA (tarea 362, D1). Datos
// inventados.

function resultado(
  id: string,
  tipo: TipoResultado,
  campos?: CampoIndice[],
  ruta = '/',
): ResultadoBusqueda {
  return { id, tipo, titulo: id, subtitulo: '', ruta, portadaRef: '', camposCoincidentes: campos }
}

describe('soloLaMenciona', () => {
  it('una guía que solo coincide en su contenido', () => {
    expect(soloLaMenciona(resultado('articulo:a', 'articulo', ['texto']))).toBe(true)
    expect(soloLaMenciona(resultado('diagnostico:a', 'diagnostico', ['texto']))).toBe(true)
  })

  it('no, si también coincide por lo que es, por un sinónimo o si no se sabe', () => {
    expect(soloLaMenciona(resultado('articulo:a', 'articulo', ['titulo', 'texto']))).toBe(false)
    expect(soloLaMenciona(resultado('articulo:a', 'articulo', ['sintomas']))).toBe(false)
    expect(
      soloLaMenciona({ ...resultado('articulo:a', 'articulo', ['texto']), camposPorSinonimo: [['formasBusqueda']] }),
    ).toBe(false)
    expect(soloLaMenciona(resultado('articulo:a', 'articulo'))).toBe(false)
    // Solo las guías: un equipo nunca «la menciona».
    expect(soloLaMenciona(resultado('dispositivo:a', 'dispositivo', ['texto']))).toBe(false)
  })
})

describe('filasDelGrupo', () => {
  const guias = [
    resultado('articulo:1', 'articulo', ['titulo']),
    resultado('articulo:2', 'articulo', ['texto']),
    resultado('articulo:3', 'articulo', ['titulo']),
    resultado('categoria:c', 'categoria', ['titulo']),
    resultado('articulo:4', 'articulo', ['cuandoUsar']),
    resultado('articulo:5', 'articulo', ['titulo']),
  ]

  it('en «Todo», las principales hasta el tope y que hay más', () => {
    const { filas, mencionan, categorias, hayMas } = filasDelGrupo('soluciones', guias, true, TOPE_EN_TODO.telefono)
    expect(filas.map((r) => r.id)).toEqual(['articulo:1', 'articulo:3', 'articulo:4'])
    expect(mencionan).toEqual([])
    expect(categorias).toEqual([])
    expect(hayMas).toBe(true)
  })

  it('elegido el alcance, todas, lo que menciona aparte y las categorías al final', () => {
    const { filas, mencionan, categorias, hayMas } = filasDelGrupo('soluciones', guias, false, TOPE_EN_TODO.telefono)
    expect(filas.map((r) => r.id)).toEqual(['articulo:1', 'articulo:3', 'articulo:4', 'articulo:5'])
    expect(mencionan.map((r) => r.id)).toEqual(['articulo:2'])
    expect(categorias.map((r) => r.id)).toEqual(['categoria:c'])
    expect(hayMas).toBe(false)
  })

  it('en «Todo», sin principales, las que la mencionan; y si tampoco, las categorías', () => {
    const soloMencionan = [resultado('articulo:2', 'articulo', ['texto']), resultado('categoria:c', 'categoria')]
    expect(filasDelGrupo('soluciones', soloMencionan, true, 3).filas.map((r) => r.id)).toEqual(['articulo:2'])
    expect(filasDelGrupo('soluciones', [resultado('categoria:c', 'categoria')], true, 3)).toEqual({
      filas: [resultado('categoria:c', 'categoria')],
      mencionan: [],
      categorias: [],
      hayMas: false,
    })
  })

  it('los demás grupos, hasta el tope en «Todo» y enteros fuera de él', () => {
    const equipos = ['a', 'b', 'c', 'd', 'e'].map((id) => resultado(`dispositivo:${id}`, 'dispositivo'))
    expect(filasDelGrupo('dispositivos', equipos, true, TOPE_EN_TODO.ancho).filas).toHaveLength(4)
    expect(filasDelGrupo('dispositivos', equipos, true, TOPE_EN_TODO.ancho).hayMas).toBe(true)
    expect(filasDelGrupo('dispositivos', equipos, false, TOPE_EN_TODO.ancho).filas).toHaveLength(5)
    expect(filasDelGrupo('dispositivos', equipos.slice(0, 3), true, 3).hayMas).toBe(false)
  })
})

describe('«Ver las N»', () => {
  it('el alcance de cada grupo y su texto', () => {
    expect(alcanceDelGrupo('soluciones')).toBe('guias')
    expect(alcanceDelGrupo('dispositivos')).toBe('equipos')
    expect(alcanceDelGrupo('red')).toBe('red')
    expect(alcanceDelGrupo('boveda')).toBe('claves')
    expect(alcanceDelGrupo('ubicaciones')).toBe('lugares')
    expect(alcanceDelGrupo('personas')).toBe('personas')
    expect(alcanceDelGrupo('referencia')).toBeNull()
    expect(textoVerAlcance('guias', 11)).toBe('Ver las 11')
    expect(textoVerAlcance('equipos', 7)).toBe('Ver los 7')
    expect(textoVerAlcance('red', 2)).toBe('Ver los 2')
  })

  it('«1 guía más menciona» y «N guías más mencionan»', () => {
    expect(textoMencionan(1, 'impresora')).toBe('1 guía más menciona «impresora» en su contenido')
    expect(textoMencionan(3, 'impresora')).toBe('3 guías más mencionan «impresora» en su contenido')
  })
})

describe('agruparResultados con los equipos de red', () => {
  it('los de red, en «Equipos de red», justo detrás de Equipos', () => {
    const resultados = [
      resultado('dispositivo:sw', 'dispositivo', undefined, '/dispositivos/sw'),
      resultado('dispositivo:pc', 'dispositivo', undefined, '/dispositivos/pc'),
      resultado('persona:p', 'persona'),
    ]
    const grupos = agruparResultados(resultados, new Set(['sw']))
    expect(grupos.map((g) => [g.id, g.items.map((r) => r.id)])).toEqual([
      ['dispositivos', ['dispositivo:pc']],
      ['red', ['dispositivo:sw']],
      ['personas', ['persona:p']],
    ])
    expect(grupos[1].nombre).toBe('Equipos de red')
    // Sin los ids de red, como antes.
    expect(agruparResultados(resultados).map((g) => g.id)).toEqual(['dispositivos', 'personas'])
  })
})
