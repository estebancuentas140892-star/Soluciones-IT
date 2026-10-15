// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  campoBuscador,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  tocar,
} from '../../pruebas/montaje'
import { BuscadorGlobal } from './BuscadorGlobal'

// EL BUSCADOR GLOBAL POR ANCHO (tarea 339, T6; handoff de tableta y
// escritorio). Lo que se decide en JavaScript:
//
//   - el campo es UNO y está en un solo sitio: abajo, al pulgar, en el
//     teléfono; arriba desde 768; en la cabecera de la paleta desde 1280;
//   - desde 1280 la capa es una paleta sobre un velo, que se cierra con un
//     clic fuera, y la vista rápida de un resultado se pinta en su columna,
//     al lado de la lista, no debajo de la fila;
//   - por debajo de 1280 la vista rápida sigue debajo de su fila.
//
// Todo lo sembrado es inventado.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

const dialogo = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const columnaVista = () => document.body.querySelector<HTMLElement>('aside[aria-label="Vista rápida"]')
const campos = () => document.body.querySelectorAll('input[aria-label="Buscar en Soluciones IT"]')

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await sembrarEquipo({ id: 'imp-1', nombre: 'Impresora de prueba del piso dos', marca: 'Marca de prueba' })
})

afterEach(async () => {
  await desmontarTodo()
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
})

async function abrirConsulta(): Promise<void> {
  await montar([{ ruta: '/', elemento: <BuscadorGlobal abierto modo="consulta" onCerrar={() => undefined} /> }], '/')
  await escribir(await esperar(campoBuscador, 'el campo'), 'impresora')
}

describe('el campo del buscador global, en un solo sitio', () => {
  it('a 390 px abajo, al pulgar, con el título arriba', async () => {
    await abrirConsulta()
    expect(campos()).toHaveLength(1)
    const capa = dialogo() as HTMLElement
    expect(capa.querySelector('h2')?.textContent).toBe('Consultar sin salir de la tarea')
    // El campo es lo último de la capa.
    expect(capa.lastElementChild?.contains(campoBuscador())).toBe(true)
  })

  it('a 768 px arriba, en el sitio del título', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await abrirConsulta()
    expect(campos()).toHaveLength(1)
    const capa = dialogo() as HTMLElement
    // La cabecera ya no lleva título: el campo ocupa su sitio.
    expect(capa.firstElementChild?.querySelector('h2')).toBeNull()
    expect(capa.firstElementChild?.contains(campoBuscador())).toBe(true)
    expect(columnaVista()).toBeNull()
  })

  it('a 1280 px en la cabecera de la paleta, que se cierra con un clic en el velo', async () => {
    ventana.happyDOM.setViewport({ width: 1280, height: 832 })
    let cerrada = false
    await montar(
      [{ ruta: '/', elemento: <BuscadorGlobal abierto modo="consulta" onCerrar={() => (cerrada = true)} /> }],
      '/',
    )
    const paleta = await esperar(() => dialogo(), 'la paleta')
    expect(campos()).toHaveLength(1)
    expect(paleta.className).toContain('w-[880px]')
    expect(paleta.className).toContain('3xl:w-[960px]')
    expect(paleta.firstElementChild?.contains(campoBuscador())).toBe(true)
    // Un clic dentro no cierra; en el velo, sí.
    await tocar(paleta)
    expect(cerrada).toBe(false)
    await tocar(paleta.parentElement as HTMLElement)
    expect(cerrada).toBe(true)
  })
})

describe('la vista rápida', () => {
  it('a 1280 px se abre en su columna, al lado de la lista', async () => {
    ventana.happyDOM.setViewport({ width: 1280, height: 832 })
    await abrirConsulta()
    const fila = await esperar(
      () => document.body.querySelector<HTMLElement>('[role="dialog"] button[aria-expanded="false"]'),
      'la fila del equipo',
    )
    await tocar(fila)
    const columna = await esperar(() => columnaVista(), 'la columna de la vista')
    await esperar(() => columna.querySelector('[role="region"]'), 'la vista en la columna')
    expect(fila.getAttribute('aria-expanded')).toBe('true')
    // No se repite debajo de la fila.
    expect(fila.parentElement?.querySelector('[role="region"]')).toBeNull()

    // Esc la recoge sin cerrar la paleta.
    await act(async () => {
      columna.querySelector<HTMLElement>('[role="region"]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(columna.querySelector('[role="region"]')).toBeNull()
    expect(dialogo()).not.toBeNull()
  })

  it('a 768 px sigue debajo de su fila', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await abrirConsulta()
    const fila = await esperar(
      () => document.body.querySelector<HTMLElement>('[role="dialog"] button[aria-expanded="false"]'),
      'la fila del equipo',
    )
    await tocar(fila)
    await esperar(() => fila.parentElement?.querySelector('[role="region"]'), 'la vista debajo de la fila')
    expect(columnaVista()).toBeNull()
  })
})
