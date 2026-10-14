// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { ResolverPage } from '../inicio/ResolverPage'
import { alcanceDe, alcanceEfectivo, conteoPorAlcance, filtrarPorAlcance } from './alcanceBusqueda'
import type { ResultadoBusqueda } from './useIndiceBusqueda'

// LOS CHIPS DE ALCANCE DE LA BÚSQUEDA (rediseño móvil "1b Pulgar", tarea
// 330, AD-080): solo filtran la vista de lo encontrado. Todo es inventado.

function resultado(tipo: ResultadoBusqueda['tipo'], id: string, ruta = `/x/${id}`): ResultadoBusqueda {
  return { id, tipo, titulo: id, subtitulo: '', ruta, portadaRef: '' }
}

describe('a qué alcance va cada resultado', () => {
  const idsDeRed = new Set(['sw-1'])
  const lista = [
    resultado('dispositivo', 'pc-1', '/dispositivos/pc-1'),
    resultado('dispositivo', 'sw-1', '/dispositivos/sw-1'),
    resultado('articulo', 'g-1'),
    resultado('diagnostico', 'd-1'),
    resultado('persona', 'p-1'),
    resultado('ubicacion', 'u-1'),
    resultado('credencial', 'c-1'),
    resultado('adjunto', 'a-1'),
    resultado('comando', 'k-1'),
  ]

  it('un equipo de red va a "Red"; los demás, a "Equipos"; los adjuntos, con las guías; el Centro de consulta, solo a "Todo"', () => {
    expect(lista.map((r) => alcanceDe(r, idsDeRed))).toEqual([
      'equipos',
      'red',
      'guias',
      'guias',
      'personas',
      'lugares',
      'claves',
      'guias',
      null,
    ])
  })

  it('cuenta cada alcance y "Todo" es la lista entera, en su orden', () => {
    const conteo = conteoPorAlcance(lista, idsDeRed)
    expect(conteo).toEqual({ todo: 9, equipos: 1, red: 1, guias: 3, personas: 1, lugares: 1, claves: 1 })
    expect(filtrarPorAlcance(lista, 'todo', idsDeRed)).toBe(lista)
    expect(filtrarPorAlcance(lista, 'guias', idsDeRed).map((r) => r.id)).toEqual(['g-1', 'd-1', 'a-1'])
  })

  it('un alcance que se queda sin resultados vuelve a "Todo"', () => {
    const conteo = conteoPorAlcance([resultado('articulo', 'g-1')], idsDeRed)
    expect(alcanceEfectivo('equipos', conteo)).toBe('todo')
    expect(alcanceEfectivo('guias', conteo)).toBe('guias')
  })
})

describe('en Resolver', () => {
  const RUTAS = [{ ruta: '/', elemento: <ResolverPage /> }]

  beforeEach(async () => {
    await limpiarBase()
    await sembrarPerfil(false)
  })

  afterEach(async () => {
    await desmontarTodo()
  })

  it('con resultados de varias clases, los chips filtran la vista sin buscar otra vez', async () => {
    await sembrarEquipo({ id: 'imp-1', nombre: 'Impresora de prueba Mercadeo' })
    await sembrarGuia({ id: 'g-imp', titulo: 'La impresora de prueba no imprime', pasos: [pasoPrueba('p1', 'Revisar', ['Mira la bandeja'])] })
    await db.categorias.update('cat-pruebas', { nombre: 'Pruebas' })
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador'), 'impresora de prueba')

    const todo = await esperar(() => control(/^Todo\s*\d+$/), 'el chip Todo')
    expect(todo.getAttribute('aria-pressed')).toBe('true')
    await esperar(() => textoPantalla().includes('Impresora de prueba Mercadeo'), 'el equipo')
    expect(textoPantalla()).toContain('La impresora de prueba no imprime')

    await tocar(await esperar(() => control(/^Equipos\s*1$/), 'el chip Equipos'))
    await esperar(() => !textoPantalla().includes('La impresora de prueba no imprime'), 'solo los equipos')
    expect(textoPantalla()).toContain('Impresora de prueba Mercadeo')

    await tocar(control(/^Guías\s*\d+$/) as HTMLElement)
    await esperar(() => !textoPantalla().includes('Impresora de prueba Mercadeo'), 'solo las guías')
    expect(textoPantalla()).toContain('La impresora de prueba no imprime')
  })

  it('con una sola clase de resultado no hay chips', async () => {
    await sembrarEquipo({ id: 'imp-1', nombre: 'Impresora de prueba Mercadeo' })
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador'), 'Mercadeo')
    await esperar(() => textoPantalla().includes('Impresora de prueba Mercadeo'), 'el equipo')
    expect(control(/^Todo\s*\d+$/)).toBeNull()
  })
})
