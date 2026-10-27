// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Categoria } from '../../lib/db'
import {
  campoBuscador,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
} from '../../pruebas/montaje'
import { ResolverPage } from '../inicio/ResolverPage'

// LAS GUÍAS EN LA BÚSQUEDA DE RESOLVER, EN EL TELÉFONO (tarea 358, D12 y D13).
// Cada guía con la tarjeta del catálogo: la forma de su tipo delante, la
// palabra que comparten atenuada y la categoría en el encabezado cuando es la
// misma para todas («Guías de Impresoras»); si no, en la línea pequeña de cada
// tarjeta. Todo lo sembrado es inventado.

const AHORA = '2026-10-26T12:00:00.000Z'
const RUTAS = [{ ruta: '/', elemento: <ResolverPage /> }]

function categoria(id: string, nombre: string, orden: number): Categoria {
  return { id, nombre, icono: '', orden, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}

async function guia(id: string, titulo: string, categoriaId: string, tipo: 'instalacion' | 'configuracion' | 'conexion') {
  await sembrarGuia({ id, titulo, categoriaId, pasos: [pasoPrueba(`${id}-p1`, 'Paso', ['Hacer algo de prueba'])] })
  await db.articulos.update(id, { tipo })
}

async function sembrarImpresoras() {
  await guia('g1', 'Instalar impresora por IP', 'cat-imp', 'instalacion')
  await guia('g2', 'Configurar impresora de red', 'cat-imp', 'configuracion')
  await guia('g3', 'Conectar impresora por USB', 'cat-imp', 'conexion')
  await guia('g4', 'Compartir impresora en la red', 'cat-imp', 'configuracion')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
})

const tarjetasDeGuia = () => Array.from(document.body.querySelectorAll<HTMLAnchorElement>('[data-tarjeta-resultado="articulo"]'))

async function buscar(texto: string) {
  await montar(RUTAS, '/')
  await escribir(await esperar(campoBuscador, 'el buscador'), texto)
}

describe('la búsqueda de Resolver en el teléfono', () => {
  it('todas de Impresoras: «Guías de Impresoras» arriba y la tarjeta no la repite', async () => {
    await sembrarImpresoras()
    await db.categorias.bulkPut([categoria('cat-imp', 'Impresoras', 1)])
    await buscar('impresora')

    const tarjetas = await esperar(() => (tarjetasDeGuia().length >= 3 ? tarjetasDeGuia() : null), 'las tarjetas de guía')
    const encabezado = tarjetas[0].closest('section')?.querySelector('h2') as HTMLElement
    // «Guías de Impresoras», u «Otras guías de Impresoras» bajo una destacada.
    expect(encabezado.textContent).toMatch(/[Gg]uías de Impresoras$/)
    expect(encabezado.querySelector('[data-icono-categoria]')?.getAttribute('data-icono-categoria')).toBe('impresora')
    for (const tarjeta of tarjetas) {
      // La tarjeta del catálogo: abre con la forma de su tipo, no con la impresora.
      expect(tarjeta.hasAttribute('data-tarjeta-guia')).toBe(true)
      expect(tarjeta.querySelector('[data-glifo-tipo]')).not.toBeNull()
      expect(tarjeta.querySelector('[data-icono-categoria]')).toBeNull()
      expect(tarjeta.querySelector('[data-medida]')?.textContent).not.toContain('Impresoras')
      // Lo repetido, atenuado; nada en acento.
      expect(tarjeta.querySelector('[data-tramo="atenuado"]')?.textContent?.toLowerCase()).toBe('impresora')
      expect(tarjeta.querySelector('[data-tramo="resaltado"]')).toBeNull()
    }
  })

  it('de varias categorías: la categoría va en cada tarjeta, con su icono de 18', async () => {
    await sembrarImpresoras()
    await guia('g5', 'Instalar impresora del POS', 'cat-pos', 'instalacion')
    await db.categorias.bulkPut([categoria('cat-imp', 'Impresoras', 1), categoria('cat-pos', 'POS', 2)])
    await buscar('impresora')

    const tarjetas = await esperar(() => (tarjetasDeGuia().length >= 4 ? tarjetasDeGuia() : null), 'las tarjetas de guía')
    const encabezado = tarjetas[0].closest('section')?.querySelector('h2') as HTMLElement
    expect(encabezado.textContent).not.toContain(' de ')
    const pos = tarjetas.find((t) => t.textContent?.includes('del POS')) as HTMLElement
    expect(pos.querySelector('[data-medida]')?.textContent).toContain('POS · Instalación')
    expect(pos.querySelector('[data-medida] [data-icono-categoria]')?.getAttribute('data-icono-categoria')).toBe('pos')
  })
})
