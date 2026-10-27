// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Categoria } from '../../lib/db'
import {
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  tocar,
} from '../../pruebas/montaje'
import { ResolverPage } from '../inicio/ResolverPage'

// LAS GUÍAS EN LA BÚSQUEDA DE RESOLVER, EN EL TELÉFONO (tarea 362, auditoría
// de Resolver, Equipos y Agenda del 2026-10-27; antes, la tarjeta del
// catálogo de la tarea 358). Cada grupo es una tarjeta y cada guía una fila de
// dos líneas con el icono de su categoría, su título entero y «Impresoras · 1
// paso · ~10 min». En «Todo», tres por grupo y «Ver las N»; elegido «Guías»,
// la fila de categorías y lo que solo menciona lo buscado, plegado. Todo lo
// sembrado es inventado.

const AHORA = '2026-10-27T12:00:00.000Z'
const RUTAS = [{ ruta: '/', elemento: <ResolverPage /> }]

function categoria(id: string, nombre: string, orden: number): Categoria {
  return { id, nombre, icono: '', orden, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}

async function guia(id: string, titulo: string, categoriaId: string, instruccion = 'Hacer algo de prueba') {
  await sembrarGuia({ id, titulo, categoriaId, pasos: [pasoPrueba(`${id}-p1`, 'Paso', [instruccion])] })
}

async function sembrar() {
  await guia('g1', 'Instalar impresora por IP', 'cat-imp')
  await guia('g2', 'Configurar impresora de red', 'cat-imp')
  await guia('g3', 'Conectar impresora por USB', 'cat-imp')
  await guia('g4', 'Compartir impresora en la red', 'cat-imp')
  await guia('g5', 'Instalar impresora del POS', 'cat-pos')
  // Solo la menciona en lo que se hace, nunca en su título.
  await guia('g6', 'Exportar el correo a un archivo PST', 'cat-sw', 'Elegir la impresora PDF de prueba')
  await db.categorias.bulkPut([
    categoria('cat-imp', 'Impresoras', 1),
    categoria('cat-pos', 'POS', 2),
    categoria('cat-sw', 'Software', 3),
  ])
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
})

const filasDeGuia = () => Array.from(document.body.querySelectorAll<HTMLElement>('[data-fila-resultado="articulo"]'))
const titulos = () => filasDeGuia().map((fila) => fila.querySelector('[data-nombre-principal]')?.textContent ?? '')

async function buscar(texto: string) {
  await montar(RUTAS, '/')
  await escribir(await esperar(campoBuscador, 'el buscador'), texto)
}

describe('la búsqueda de Resolver en el teléfono (tarea 362)', () => {
  it('en «Todo», tres guías en una tarjeta y «Ver las 7», el número del chip «Guías»', async () => {
    await sembrar()
    await buscar('impresora')

    const filas = await esperar(() => (filasDeGuia().length >= 3 ? filasDeGuia() : null), 'las filas de guía')
    expect(filas).toHaveLength(3)
    // Una sola tarjeta para el grupo, con un divisor entre fila y fila.
    const tarjeta = filas[0].parentElement as HTMLElement
    expect(filas.every((fila) => fila.parentElement === tarjeta)).toBe(true)
    expect(tarjeta.className).toContain('border-[1.5px]')
    expect(filas[1].className).toContain('border-t-[1.5px]')
    // Lo que solo la menciona no ocupa sitio en «Todo».
    expect(titulos()).not.toContain('Exportar el correo a un archivo PST')
    // «Ver las 7»: lo que encuentra el chip «Guías», las seis guías y la
    // categoría Impresoras.
    expect(control('Ver las 7')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Hay otras guías parecidas debajo')
  })

  it('cada fila dice su categoría con su icono y cuánto toma, y el título va entero', async () => {
    await sembrar()
    await buscar('impresora')

    await esperar(() => (filasDeGuia().length >= 3 ? true : null), 'las filas de guía')
    for (const fila of filasDeGuia()) {
      expect(fila.querySelector('[data-icono-categoria]')).not.toBeNull()
      expect(fila.querySelector('[data-meta-resultado]')?.textContent).toMatch(/^(Impresoras|POS) · 1 paso · ~10 min$/)
      const titulo = fila.querySelector('[data-nombre-principal]') as HTMLElement
      expect(titulo.className).not.toMatch(/truncate|line-clamp/)
      expect(titulo.className).toContain('[overflow-wrap:anywhere]')
    }
  })

  it('«Ver las 7» elige «Guías»: todas, la fila de categorías y lo mencionado plegado', async () => {
    await sembrar()
    await buscar('impresora')

    await tocar(await esperarControl('Ver las 7'))
    await esperar(() => (filasDeGuia().length >= 5 ? true : null), 'todas las guías')
    expect(titulos()).toHaveLength(5)
    // La categoría que coincide, al final, como su catálogo.
    expect(control(/^Todas las guías de Impresoras/)).not.toBeNull()
    expect(control(/^Ver las/)).toBeNull()

    // LA FILA DE CATEGORÍAS (D2): «Todas» y cada categoría con cuántas tiene.
    const chips = Array.from(document.body.querySelectorAll<HTMLElement>('[data-chip-categoria]'))
    expect(chips.map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Todas 6',
      'Impresoras 4',
      'POS 1',
      'Software 1',
    ])
    expect(chips[0].getAttribute('aria-pressed')).toBe('true')

    // LO QUE SOLO LA MENCIONA, PLEGADO al final y dicho como lo que es.
    const pliegue = document.body.querySelector<HTMLElement>('[data-pliegue-mencionan]') as HTMLElement
    expect(pliegue.textContent).toBe('1 guía más menciona «impresora» en su contenido')
    expect(pliegue.getAttribute('aria-expanded')).toBe('false')
    await tocar(pliegue)
    const mencionada = await esperar(
      () => filasDeGuia().find((fila) => fila.textContent?.includes('archivo PST')),
      'la guía que la menciona',
    )
    expect(mencionada.querySelector('[data-meta-resultado]')?.textContent).toBe('Software · la menciona en su contenido')
  })

  it('tipo y categoría se combinan: con «POS», solo lo del POS', async () => {
    await sembrar()
    await buscar('impresora')

    await tocar(await esperarControl('Ver las 7'))
    const pos = await esperar(() => document.body.querySelector<HTMLElement>('[data-chip-categoria="POS"]'), 'el chip POS')
    await tocar(pos)
    await esperar(
      () => document.body.querySelector('[data-chip-categoria="POS"]')?.getAttribute('aria-pressed') === 'true',
      'el chip POS elegido',
    )
    expect(document.body.textContent).toContain('Instalar impresora del POS')
    expect(document.body.textContent).not.toContain('Instalar impresora por IP')
    expect(document.body.textContent).not.toContain('Compartir impresora en la red')
  })
})
