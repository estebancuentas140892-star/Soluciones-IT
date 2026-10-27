// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { DispositivosPage } from './DispositivosPage'

// EQUIPOS, BUSCANDO: SOLO LAS CATEGORÍAS CON COINCIDENCIAS (tarea 363, D3 de
// la auditoría del 2026-10-27), montando la pantalla de verdad. Las reglas
// puras están en `chipsDeEquipos.test.ts`. Todo lo sembrado es inventado.

const AHORA = '2026-10-27T12:00:00.000Z'
const RUTAS = [
  { ruta: '/dispositivos', elemento: <DispositivosPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
]

function categoria(id: string, nombre: string, orden: number, esRed = false) {
  return { id, nombre, icono: '', orden, esRed, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}

async function sembrar() {
  await db.categorias.bulkPut([
    categoria('cat-pos', 'POS', 1),
    categoria('cat-imp', 'Impresoras', 2),
    categoria('cat-pc', 'Computadores', 3),
    categoria('cat-sw', 'Switches', 4, true),
  ])
  await sembrarEquipo({ id: 'pc-1', nombre: 'PC-COMPRAS-04', categoriaId: 'cat-pc', ubicacion: 'Parque de prueba' })
  await sembrarEquipo({ id: 'pc-2', nombre: 'PORT-COMPRAS-07', categoriaId: 'cat-pc', ubicacion: 'Parque de prueba' })
  await sembrarEquipo({ id: 'pos-1', nombre: 'POS-TAQ-01', categoriaId: 'cat-pos', ubicacion: 'Parque de prueba' })
  await sembrarEquipo({ id: 'imp-1', nombre: 'Impresora Mercadeo', categoriaId: 'cat-imp', ubicacion: 'Sede de prueba' })
  await sembrarEquipo({ id: 'sw-1', nombre: 'SW-PARQUE-01', categoriaId: 'cat-sw', ubicacion: 'Parque de prueba' })
}

// «Nombre N»: el nombre y su número van en nodos distintos.
const chips = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[data-chip-equipos]')).map((chip) =>
    Array.from(chip.childNodes)
      .map((nodo) => (nodo.textContent ?? '').trim())
      .filter(Boolean)
      .join(' '),
  )

/** El campo de Equipos (no es el buscador global). */
function campoEquipos(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Equipos"]')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await sembrar()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('la fila de categorías de Equipos, buscando', () => {
  it('sin texto, todas; con «compras», solo «Todos» y Computadores', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => (chips().length === 4 ? true : null), 'las cuatro de siempre')
    expect(chips()).toEqual(['Todos 4', 'POS 1', 'Impresoras 1', 'Computadores 2'])

    await escribir(await esperar(campoEquipos, 'el buscador'), 'compras')
    await esperar(() => (chips().length === 2 ? true : null), 'solo las que sirven')
    expect(chips()).toEqual(['Todos 2', 'Computadores 2'])
  })

  it('con equipos de red, su chip «Red» separado; los números suman «Todos»', async () => {
    await montar(RUTAS, '/dispositivos')
    await escribir(await esperar(campoEquipos, 'el buscador'), 'parque')
    await esperar(() => (chips().includes('Red 1') ? true : null), 'el chip Red')
    expect(chips()).toEqual(['Todos 4', 'POS 1', 'Computadores 2', 'Red 1'])
    expect(document.body.querySelector('[data-separador-red]')).not.toBeNull()

    await tocar(document.body.querySelector<HTMLElement>('[data-chip-equipos="red"]') as HTMLElement)
    await esperar(() => (textoPantalla().includes('SW-PARQUE-01') && !textoPantalla().includes('PC-COMPRAS-04') ? true : null), 'solo los de red')
  })

  it('la elegida que queda en 0 sigue, punteada, y «Ver los 2 en Todos» no borra lo escrito', async () => {
    await montar(RUTAS, '/dispositivos?categoria=cat-pos')
    const campo = await esperar(campoEquipos, 'el buscador')
    await escribir(campo, 'compras')
    await esperar(() => textoPantalla().includes('Ningún equipo de POS coincide con «compras»'), 'el vacío de la categoría')
    expect(textoPantalla()).toContain('Hay 2 en otras categorías.')
    const pos = document.body.querySelector<HTMLElement>('[data-chip-equipos="cat-pos"]') as HTMLElement
    expect(pos.getAttribute('aria-pressed')).toBe('true')
    expect(pos.className).toContain('border-dashed')
    expect(control('Quitar filtros')).toBeNull()

    await tocar(await esperarControl('Ver los 2 en Todos'))
    await esperar(() => textoPantalla().includes('PC-COMPRAS-04'), 'los dos en Todos')
    expect(campo.value).toBe('compras')
    expect(ubicacionActual().search).toBe('')
  })

  it('sin coincidencias: solo «Todos 0» y «Borrar búsqueda»', async () => {
    await montar(RUTAS, '/dispositivos')
    const campo = await esperar(campoEquipos, 'el buscador')
    await escribir(campo, 'zzqxw')
    await esperar(() => textoPantalla().includes('Ningún equipo coincide con «zzqxw»'), 'el vacío')
    expect(chips()).toEqual(['Todos 0'])
    await tocar(await esperarControl('Borrar búsqueda'))
    await esperar(() => (campo.value === '' ? true : null), 'lo escrito, borrado')
  })
})
