// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Categoria } from '../../lib/db'
import { desmontarTodo, esperar, limpiarBase, montar, pasoPrueba, sembrarGuia, sembrarPerfil } from '../../pruebas/montaje'
import { ResolverPage } from './ResolverPage'

// LAS CATEGORÍAS DE RESOLVER EN EL TELÉFONO (tarea 358, mosaico apilado de
// Claude Design). El nombre tiene todo el ancho de la celda y nunca se parte
// a mitad de palabra sin guion: ni `overflow-wrap:anywhere` (que partía
// «Computadores» a 320, 360 y 390 px) ni celdas desiguales. Con un número
// impar, la última ocupa la fila entera. Todo lo sembrado es inventado.

const AHORA = '2026-10-26T12:00:00.000Z'
const RUTAS = [{ ruta: '/', elemento: <ResolverPage /> }]
const NOMBRES = ['Computadores', 'Impresoras', 'POS', 'Datáfonos']

function categoria(id: string, nombre: string, orden: number): Categoria {
  return { id, nombre, icono: '', orden, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}

async function sembrarCategorias(cuantas: number) {
  for (let i = 0; i < cuantas; i++) {
    await sembrarGuia({ id: `g${i}`, titulo: `Guía ${i}`, categoriaId: `cat-${i}`, pasos: [pasoPrueba(`g${i}-p1`, 'Paso', ['Algo'])] })
  }
  await db.categorias.bulkPut(NOMBRES.slice(0, cuantas).map((nombre, i) => categoria(`cat-${i}`, nombre, i + 1)))
}

const celdas = () => Array.from(document.body.querySelectorAll<HTMLAnchorElement>('[data-categoria-telefono]'))

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('Resolver: el mosaico de categorías en el teléfono', () => {
  it('ningún nombre con `overflow-wrap:anywhere`; el corte, por sílaba con guion', async () => {
    await sembrarCategorias(4)
    await montar(RUTAS, '/')
    const todas = await esperar(() => (celdas().length === 4 ? celdas() : null), 'las cuatro categorías')
    for (const celda of todas) {
      expect(celda.outerHTML).not.toContain('overflow-wrap:anywhere')
      const nombre = Array.from(celda.querySelectorAll('span')).find((s) => NOMBRES.includes(s.textContent ?? '')) as HTMLElement
      expect(nombre.className).toContain('hyphens-auto')
      expect(nombre.className).toContain('text-[15px]')
      // El icono de 36 y el número arriba; el nombre debajo, con todo el ancho.
      expect(celda.className).toContain('flex-col')
      expect(celda.querySelector('[data-icono-categoria]')?.getAttribute('style')).toContain('width: 36px')
      expect(celda.className).not.toContain('col-span-2')
    }
    expect(todas.map((celda) => celda.getAttribute('aria-label'))).toContain('Computadores: 1 guía')
  })

  it('con un número impar, la última ocupa la fila entera y en horizontal', async () => {
    await sembrarCategorias(3)
    await montar(RUTAS, '/')
    const todas = await esperar(() => (celdas().length === 3 ? celdas() : null), 'las tres categorías')
    expect(todas.map((celda) => celda.className.includes('col-span-2'))).toEqual([false, false, true])
    expect(todas[2].className).not.toContain('flex-col')
    expect(todas[2].className).toContain('min-h-[60px]')
  })
})
