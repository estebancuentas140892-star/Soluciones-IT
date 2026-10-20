import { describe, expect, it } from 'vitest'
import type { Dispositivo } from '../../lib/db'
import { CATEGORIAS_RED, EQUIPOS, PERSONAS, equipo } from '../../pruebas/datosBusquedaAproximada'
import { buscarEquipos, conteosDeChips } from './busquedaEquipos'
import { personaQueLoTiene, type PersonasPorId } from './responsableEnLista'

// EQUIPOS ENCUENTRA AUNQUE SE ESCRIBA CON ERRORES (tarea 346). La misma regla
// que Resolver (`lib/coincidenciaAproximada.ts`) sobre `buscarEquipos`, con
// los datos inventados de `datosBusquedaAproximada`.

const PERSONAS_POR_ID: PersonasPorId = new Map(PERSONAS.map((p) => [p.id, p]))

function buscar(texto: string, categoriaId = '', equipos: Dispositivo[] = EQUIPOS) {
  return buscarEquipos(equipos, CATEGORIAS_RED, { texto, categoriaId }, PERSONAS_POR_ID)
}

const nombres = (lista: Dispositivo[]) => lista.map((d) => d.nombre)

describe('el responsable vinculado, por su nombre y con errores', () => {
  it('"daniel garcia": el equipo de Daniel García, exacto; los de Daniel y Daniela Gracia, posibles', () => {
    const { generales, posibles } = buscar('daniel garcia')
    expect(nombres(generales)).toEqual(['PC Tesorería'])
    // Las dos personas parecidas, las dos: nada se elige solo.
    expect(nombres(posibles)).toEqual(expect.arrayContaining(['Impresora Bodega', 'Impresora Mercadeo']))
    expect(nombres(posibles)).not.toContain('PC Tesorería')
  })

  it('sin tilde y en mayúsculas es exacto: "DANIEL GARCÍA" y "jose"', () => {
    expect(nombres(buscar('DANIEL GARCÍA').generales)).toEqual(['PC Tesorería'])
    expect(nombres(buscar('jose').generales)).toEqual(['Portátil Sistemas'])
  })

  it('se busca por el nombre VIGENTE de la persona, no por la copia que guardó el equipo', () => {
    // "PC Contabilidad 02" guarda "Dani P.", pero lo tiene Daniel Pérez.
    expect(nombres(buscar('daniel perez').generales)).toEqual(['PC Contabilidad 02'])
    const renombrado = equipo('eq-renombrado', 'PC Prueba', {
      categoriaId: 'cat-pc',
      responsableId: 'p-daniel-perez',
      responsable: 'Jorge Viejo',
    })
    const conRenombrado = [...EQUIPOS, renombrado]
    expect(nombres(buscar('jorge viejo', '', conRenombrado).generales)).toEqual([])
    expect(nombres(buscar('jorge viejo', '', conRenombrado).posibles)).toEqual([])
    expect(nombres(buscar('daniel perez', '', conRenombrado).generales)).toContain('PC Prueba')
  })

  it('lo escrito sin ficha de persona se encuentra, sin confundirlo con una persona vinculada', () => {
    const [portatil] = buscar('jose ramirez').generales
    expect(portatil.nombre).toBe('Portátil Sistemas')
    // Es un texto por validar: ninguna persona lo tiene.
    expect(personaQueLoTiene(portatil, PERSONAS_POR_ID)).toBeNull()
    // Y la persona José Ramírez no "tiene" ese equipo por llamarse igual.
    expect(portatil.responsableId).toBeNull()
  })
})

describe('erratas en el nombre del equipo', () => {
  it('"impresra" encuentra las dos impresoras como posibles coincidencias', () => {
    const { generales, posibles } = buscar('impresra')
    expect(generales).toEqual([])
    expect(nombres(posibles)).toEqual(['Impresora Bodega', 'Impresora Mercadeo'])
  })

  it('"impresora mercadoe": las dos palabras cuentan y la del lugar se parece', () => {
    const { generales, posibles } = buscar('impresora mercadoe')
    expect(generales).toEqual([])
    expect(nombres(posibles)).toEqual(['Impresora Mercadeo'])
  })

  it('lo exacto va delante y aparte de lo aproximado', () => {
    const { generales, posibles } = buscar('impresora')
    expect(nombres(generales)).toEqual(['Impresora Bodega', 'Impresora Mercadeo'])
    expect(posibles).toEqual([])
  })
})

describe('IP, serial y placa, tal cual', () => {
  it('"10.10.6.8": primero el equipo con esa IP, antes que el de "10.10.6.80"', () => {
    expect(nombres(buscar('10.10.6.8').generales)).toEqual(['Impresora Mercadeo', 'Impresora Bodega'])
  })

  it('"XK7Q2291" encuentra solo su equipo; con un número cambiado, nada por parecido', () => {
    expect(nombres(buscar('XK7Q2291').generales)).toEqual(['Impresora Mercadeo'])
    expect(buscar('XK7Q2291').posibles).toEqual([])
    const otro = buscar('XK7Q2219')
    expect([...otro.generales, ...otro.deRed, ...otro.posibles]).toEqual([])
  })

  it('la placa "MP-00124" encuentra la suya y no la vecina', () => {
    expect(nombres(buscar('MP-00124').generales)).toEqual(['Impresora Bodega'])
    expect(buscar('MP-00125').posibles).toEqual([])
  })
})

describe('los filtros de categoría y los equipos de red se conservan', () => {
  it('con un chip de categoría, lo exacto y lo posible son solo de esa categoría', () => {
    const { generales, posibles, deRed } = buscar('daniel garcia', 'cat-pc')
    expect(nombres(generales)).toEqual(['PC Tesorería'])
    expect(posibles).toEqual([])
    expect(deRed).toEqual([])
    expect(nombres(buscar('impresra', 'cat-impresoras').posibles)).toEqual(['Impresora Bodega', 'Impresora Mercadeo'])
    expect(buscar('impresra', 'cat-pc').posibles).toEqual([])
  })

  it('un equipo de red se encuentra con una errata solo al escribir y sin chip', () => {
    expect(nombres(buscar('sw-centrl').posibles)).toEqual(['SW-CENTRAL-02'])
    expect(buscar('sw-centrl', 'cat-pc').posibles).toEqual([])
    // Sin texto, el inventario general no lleva los de red.
    expect(nombres(buscar('').deRed)).toEqual([])
  })

  it('los chips cuentan también las posibles coincidencias que van a enseñar', () => {
    const conteos = conteosDeChips(EQUIPOS, CATEGORIAS_RED, 'daniel garcia', PERSONAS_POR_ID)
    expect(conteos.todos).toBe(3)
    expect(conteos.porCategoria.get('cat-pc')).toBe(1)
    expect(conteos.porCategoria.get('cat-impresoras')).toBe(2)
  })
})
