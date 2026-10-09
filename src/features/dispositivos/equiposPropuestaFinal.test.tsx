// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
} from '../../pruebas/montaje'
import { DispositivosPage } from './DispositivosPage'

// LA LISTA DE EQUIPOS SEGÚN LA PROPUESTA FINAL DE CLAUDE DESIGN
// (2026-10-01), con la pantalla de verdad:
//
//   - el estado solo se ve cuando es una excepción (En mantenimiento,
//     Fuera de servicio, De baja), y esa fila se atenúa; "Operativo" no
//     ocupa la fila y un estado vacío no se rellena con "Sin estado";
//   - el marcador del buscador dice qué se puede buscar, y lo buscado se
//     resalta dentro del nombre;
//   - los chips son un grupo con nombre que se desliza en horizontal.
//
// Todo lo sembrado es inventado.

const AHORA = '2026-10-01T12:00:00.000Z'
const RUTAS = [{ ruta: '/dispositivos', elemento: <DispositivosPage /> }]

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  sessionStorage.clear()
  await db.categorias.put({
    id: 'cat-pos',
    nombre: 'POS',
    icono: '',
    orden: 1,
    esRed: false,
    color: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
  await sembrarEquipo({ id: 'caja-1', nombre: 'Caja de prueba 1', categoriaId: 'cat-pos', estado: 'Operativo', ip: '10.9.9.1' })
  await sembrarEquipo({ id: 'caja-2', nombre: 'Caja de prueba 2', categoriaId: 'cat-pos', estado: '' })
  await sembrarEquipo({ id: 'caja-3', nombre: 'Caja de prueba 3', categoriaId: 'cat-pos', estado: 'De baja' })
  await sembrarEquipo({ id: 'caja-4', nombre: 'Caja de prueba 4', categoriaId: 'cat-pos', estado: 'En mantenimiento' })
})

afterEach(async () => {
  await desmontarTodo()
})

function filaDe(id: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`a[href="/dispositivos/${id}"]`)
}

describe('la lista de Equipos', () => {
  it('el estado solo se ve cuando es una excepción, y esa fila se atenúa', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => filaDe('caja-4'), 'la lista')

    expect(textoPantalla()).not.toContain('Operativo')
    expect(textoPantalla()).not.toContain('Sin estado')
    expect(filaDe('caja-3')?.textContent).toContain('De baja')
    expect(filaDe('caja-4')?.textContent).toContain('En mantenimiento')
    // La IP sigue a la vista aunque el estado normal no se diga.
    expect(filaDe('caja-1')?.textContent).toContain('10.9.9.1')

    const atenuada = (id: string) => Boolean(filaDe(id)?.querySelector('.opacity-60'))
    expect(atenuada('caja-3')).toBe(true)
    expect(atenuada('caja-4')).toBe(true)
    expect(atenuada('caja-1')).toBe(false)
    expect(atenuada('caja-2')).toBe(false)
  })

  it('el buscador dice qué busca y lo buscado se resalta dentro del nombre', async () => {
    await montar(RUTAS, '/dispositivos')
    const campo = await esperar(
      () => document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Equipos"]'),
      'el buscador de Equipos',
    )
    expect(campo.placeholder).toBe('Nombre, persona, IP, lugar o serial')

    await escribir(campo, 'prueba 3')
    await esperar(() => !filaDe('caja-1'), 'la lista filtrada')
    const resaltado = filaDe('caja-3')?.querySelector('span.rounded-\\[3px\\]')
    expect(resaltado?.textContent).toBe('prueba 3')
    // El nombre real se lee entero.
    expect(filaDe('caja-3')?.textContent).toContain('Caja de prueba 3')
  })

  it('un nombre largo y su línea de contexto parten línea, hasta dos, y no se recortan a una', async () => {
    await sembrarEquipo({
      id: 'imp-larga',
      nombre: 'Impresora de prueba Administración del segundo piso',
      categoriaId: 'cat-pos',
      ubicacion: 'Oficina de prueba del parque norte',
      ip: '10.9.9.40',
    })
    await montar(RUTAS, '/dispositivos')
    const lineas = await esperar(() => {
      const ps = filaDe('imp-larga')?.querySelectorAll('p')
      return ps && ps.length === 2 ? Array.from(ps) : null
    }, 'la fila del nombre largo con su contexto')
    expect(lineas[0].textContent).toBe('Impresora de prueba Administración del segundo piso')
    expect(lineas[1].textContent).toBe('POS · Oficina de prueba del parque norte')
    for (const linea of lineas) {
      expect(linea.className).toContain('line-clamp-2')
      expect(linea.className).not.toContain('truncate')
    }
  })

  it('los chips son un grupo con nombre', async () => {
    await montar(RUTAS, '/dispositivos')
    const grupo = await esperar(
      () => document.body.querySelector('[role="group"][aria-label="Filtrar por categoría"]'),
      'la fila de chips',
    )
    expect(grupo.textContent).toContain('Todos')
    expect(grupo.textContent).toContain('POS')
  })
})
