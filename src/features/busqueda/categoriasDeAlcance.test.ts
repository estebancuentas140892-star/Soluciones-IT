import { describe, expect, it } from 'vitest'
import { categoriaEfectiva, categoriasDelAlcance, filtrarPorCategoria, idDeGuiaDe } from './categoriasDeAlcance'
import type { ResultadoBusqueda, TipoResultado } from './useIndiceBusqueda'

// LA FILA DE CATEGORÍAS DENTRO DE UN ALCANCE (tarea 362, D2). Datos inventados.

function resultado(id: string, tipo: TipoResultado, titulo = id): ResultadoBusqueda {
  return { id, tipo, titulo, subtitulo: '', ruta: '/', portadaRef: '' }
}

const CATEGORIA: Record<string, string> = {
  g1: 'Impresoras',
  g2: 'Impresoras',
  g3: 'POS',
  g4: 'Software',
  d1: 'Impresoras',
  e1: 'Computadores',
  e2: 'Computadores',
  e3: 'POS',
}
const categoriaDe = (r: ResultadoBusqueda) => CATEGORIA[idDeGuiaDe(r)] ?? ''

const GUIAS = [
  resultado('articulo:g1', 'articulo'),
  resultado('articulo:g3', 'articulo'),
  resultado('articulo:g2', 'articulo'),
  resultado('diagnostico:d1', 'diagnostico'),
  resultado('articulo:g4', 'articulo'),
  resultado('categoria:c-imp', 'categoria', 'Impresoras'),
  resultado('adjunto:g3:0:manual.pdf', 'adjunto', 'manual.pdf'),
]

describe('categoriasDelAlcance', () => {
  it('en «Guías», cada categoría con cuántas guías tiene, de la que más a la que menos', () => {
    expect(categoriasDelAlcance('guias', GUIAS, categoriaDe)).toEqual({
      categorias: [
        { nombre: 'Impresoras', cantidad: 3 },
        { nombre: 'POS', cantidad: 1 },
        { nombre: 'Software', cantidad: 1 },
      ],
      // «Todas»: las guías con pasos o con preguntas, sin la categoría ni el adjunto.
      total: 5,
    })
  })

  it('en «Equipos», por la categoría del equipo', () => {
    const equipos = ['e1', 'e3', 'e2'].map((id) => resultado(`dispositivo:${id}`, 'dispositivo'))
    expect(categoriasDelAlcance('equipos', equipos, categoriaDe).categorias.map((c) => c.nombre)).toEqual([
      'Computadores',
      'POS',
    ])
  })

  it('con una sola categoría, o fuera de «Guías» y «Equipos», no hay fila', () => {
    const impresoras = [resultado('articulo:g1', 'articulo'), resultado('articulo:g2', 'articulo')]
    expect(categoriasDelAlcance('guias', impresoras, categoriaDe).categorias).toEqual([])
    expect(categoriasDelAlcance('todo', GUIAS, categoriaDe).categorias).toEqual([])
    expect(categoriasDelAlcance('personas', GUIAS, categoriaDe).categorias).toEqual([])
  })
})

describe('filtrarPorCategoria', () => {
  it('acota a la categoría, con la categoría que coincide y el adjunto de su guía', () => {
    expect(filtrarPorCategoria(GUIAS, 'Impresoras', categoriaDe).map((r) => r.id)).toEqual([
      'articulo:g1',
      'articulo:g2',
      'diagnostico:d1',
      'categoria:c-imp',
    ])
    expect(filtrarPorCategoria(GUIAS, 'POS', categoriaDe).map((r) => r.id)).toEqual([
      'articulo:g3',
      'adjunto:g3:0:manual.pdf',
    ])
  })

  it('sin categoría elegida, todo en su orden', () => {
    expect(filtrarPorCategoria(GUIAS, null, categoriaDe)).toBe(GUIAS)
  })
})

describe('categoriaEfectiva', () => {
  it('la elegida mientras esté en la fila; si no, «Todas»', () => {
    const fila = [{ nombre: 'POS', cantidad: 2 }]
    expect(categoriaEfectiva('POS', fila)).toBe('POS')
    expect(categoriaEfectiva('Software', fila)).toBeNull()
    expect(categoriaEfectiva(null, fila)).toBeNull()
  })
})
