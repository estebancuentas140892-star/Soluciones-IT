import { describe, expect, it } from 'vitest'
import type { Articulo, Categoria } from '../../lib/db'
import { pasoPrueba } from '../../pruebas/montaje'
import { accesosRapidos } from '../inicio/resolver'
import {
  agruparPorCategoria,
  cuentaDeCategoria,
  lineaQueDistingue,
  ordenarEnCategoria,
  SIN_CATEGORIA,
  situacionParaLista,
  textoCuenta,
} from './catalogoTelefono'

// El catálogo de Guías en el teléfono (tarea 358, alternativa A2 de Claude
// Design): cómo se ordena y se agrupa, qué número lleva cada categoría y qué
// línea distingue a una guía. Todo lo sembrado es inventado.

const AHORA = '2026-10-26T12:00:00.000Z'

function categoria(id: string, nombre: string, orden: number): Categoria {
  return { id, nombre, icono: '', orden, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}

function guia(id: string, categoriaId: string, extra: Partial<Articulo> = {}, conPasos = true, descripcion = ''): Articulo {
  return {
    id,
    categoriaId,
    titulo: `Guía ${id}`,
    tipo: 'configuracion',
    contenido: '',
    etiquetas: [],
    procedimiento: {
      descripcion,
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      verificacionFinal: [],
      tiempoEstimadoMin: null,
      dificultad: null,
      pasos: conPasos ? [pasoPrueba(`${id}-p1`, 'Un paso', ['Hacer algo'])] : [],
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
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...extra,
  }
}

describe('ordenarEnCategoria (D5)', () => {
  it('por tipo en el orden de TIPOS_ARTICULO, luego por título, y las obsoletas al final', () => {
    const lista = [
      guia('a', 'c', { titulo: 'Manual de la impresora', tipo: 'manual' }),
      guia('b', 'c', { titulo: 'Atasco de papel', tipo: 'problema_frecuente' }),
      guia('c', 'c', { titulo: 'Configurar escaneo', tipo: 'configuracion' }),
      guia('d', 'c', { titulo: 'Agregar por IP', tipo: 'configuracion', estado: 'obsoleto' }),
      guia('e', 'c', { titulo: 'Instalar el controlador', tipo: 'instalacion' }),
      guia('f', 'c', { titulo: 'Configurar bandeja', tipo: 'configuracion' }),
    ]
    expect([...lista].sort(ordenarEnCategoria).map((a) => a.id)).toEqual(['e', 'f', 'c', 'b', 'a', 'd'])
  })
})

describe('agruparPorCategoria', () => {
  it('un grupo por categoría con guías, en el orden de las categorías, cada uno ordenado', () => {
    const categorias = [categoria('imp', 'Impresoras', 1), categoria('pos', 'POS', 2), categoria('red', 'Redes', 3)]
    const grupos = agruparPorCategoria(
      [
        guia('p1', 'pos', { titulo: 'Cerrar caja' }),
        guia('i2', 'imp', { titulo: 'Bandeja', tipo: 'configuracion' }),
        guia('i1', 'imp', { titulo: 'Controlador', tipo: 'instalacion' }),
      ],
      categorias,
    )
    expect(grupos.map((g) => g.categoria.id)).toEqual(['imp', 'pos'])
    expect(grupos[0].articulos.map((a) => a.id)).toEqual(['i1', 'i2'])
  })

  it('una guía cuya categoría no llegó no se pierde: va al final, en «Sin categoría»', () => {
    const grupos = agruparPorCategoria([guia('i1', 'imp'), guia('h1', 'borrada')], [categoria('imp', 'Impresoras', 1)])
    expect(grupos.map((g) => g.categoria.nombre)).toEqual(['Impresoras', 'Sin categoría'])
    expect(grupos[1].articulos.map((a) => a.id)).toEqual(['h1'])
    // Sin categorías todavía (la consulta aún no respondió), tampoco.
    expect(agruparPorCategoria([guia('i1', 'imp')], []).map((g) => g.categoria.id)).toEqual([SIN_CATEGORIA.id])
  })
})

describe('cuentaDeCategoria y textoCuenta (D9)', () => {
  const lista = [
    guia('g1', 'imp'),
    guia('g2', 'imp'),
    guia('leer', 'imp', { tipo: 'manual' }, false),
    guia('borrador', 'imp', { estado: 'borrador' }),
    guia('obsoleta', 'imp', { estado: 'obsoleto' }),
    guia('borrada', 'imp', { eliminadoEn: AHORA }),
  ]

  it('cuenta las publicadas con pasos y, aparte, las de leer; sin borradores ni obsoletas', () => {
    expect(cuentaDeCategoria(lista)).toEqual({ guias: 2, paraLeer: 1 })
    expect(textoCuenta(cuentaDeCategoria(lista))).toBe('2 guías · 1 para leer')
    expect(textoCuenta({ guias: 1, paraLeer: 0 })).toBe('1 guía')
    expect(textoCuenta({ guias: 0, paraLeer: 3 })).toBe('3 para leer')
    expect(textoCuenta({ guias: 0, paraLeer: 0 })).toBe('')
  })

  it('el número de una categoría es el mismo que en Resolver (`accesosRapidos`)', () => {
    const acceso = accesosRapidos(
      [categoria('imp', 'Impresoras', 1), categoria('pos', 'POS', 2)],
      [...lista, guia('p', 'pos')],
      [],
      new Date(AHORA),
      { minimo: 1 },
    )
    expect(acceso.find((a) => a.categoriaId === 'imp')?.guias).toBe(cuentaDeCategoria(lista).guias)
  })
})

describe('situacionParaLista y lineaQueDistingue (D11)', () => {
  it('sin el «Cuando» inicial que repetirían todas, con mayúscula', () => {
    expect(situacionParaLista('Usa esta guía cuando la impresora no aparece en la red')).toBe('La impresora no aparece en la red')
    expect(situacionParaLista('Cuando el equipo es nuevo')).toBe('El equipo es nuevo')
  })

  it('lo que no empieza por «Cuando» queda como está', () => {
    expect(situacionParaLista('Antes de cambiar el tóner')).toBe('Antes de cambiar el tóner')
    expect(situacionParaLista('Usa esta guía solo cuando falle la red')).toBe('Solo cuando falle la red')
    expect(situacionParaLista('')).toBe('')
  })

  it('la situación; si no hay, el primer síntoma; si tampoco, nada', () => {
    expect(lineaQueDistingue(guia('a', 'c', {}, true, 'Cuando la caja no abre'))).toBe('La caja no abre')
    expect(lineaQueDistingue(guia('b', 'c', { sintomas: ['  ', 'Sale en blanco', 'Hace ruido'] }))).toBe('Sale en blanco')
    expect(lineaQueDistingue(guia('c', 'c', { procedimiento: null }))).toBe('')
  })
})
