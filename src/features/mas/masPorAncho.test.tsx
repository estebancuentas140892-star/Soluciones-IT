// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { alternarFavorito } from '../../lib/favoritos'
import {
  control,
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
} from '../../pruebas/montaje'
import { PantallaMas } from './PantallaMas'

// MÁS POR ANCHO (tarea 339, T9; handoff de tableta y escritorio): desde 1280
// es un directorio (el nombre de cada grupo y sus puertas) con Mis favoritos
// abierto en su columna, sin botón; por debajo, la fila plegable de siempre.
// Mismos grupos y destinos, ni uno más ni uno menos.
//
// Todo lo sembrado es inventado.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

const RUTAS = [{ ruta: '/mas', elemento: <PantallaMas /> }]

async function sembrarFavorito(): Promise<void> {
  await sembrarGuia({
    id: 'guia-fav',
    titulo: 'Guía favorita de prueba',
    pasos: [pasoPrueba('gf-p1', 'Un paso', ['Hacer algo'])],
  })
  await alternarFavorito('articulo', 'guia-fav')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
})

describe('Más por ancho', () => {
  it('a 1280 px Mis favoritos va abierto en su columna, sin botón', async () => {
    ventana.happyDOM.setViewport({ width: 1280, height: 832 })
    await sembrarFavorito()
    await montar(RUTAS, '/mas')

    await esperar(() => textoPantalla().includes('Guía favorita de prueba'), 'el favorito a la vista')
    expect(control(/^Mis favoritos/)).toBeNull()
    const columna = Array.from(document.body.querySelectorAll<HTMLElement>('main aside')).find(
      (a) => a.querySelector('h2')?.textContent === 'Mis favoritos',
    )
    expect(columna?.textContent).toContain('Guía favorita de prueba')
    // Los cinco grupos siguen, con sus puertas.
    for (const grupo of ['Consultar', 'Personas y lugares', 'Infraestructura', 'Inventario', 'Cuenta y aplicación']) {
      expect(textoPantalla()).toContain(grupo)
    }
  })

  it('a 768 px Mis favoritos es la fila plegable de siempre', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await sembrarFavorito()
    await montar(RUTAS, '/mas')

    const fila = await esperar(() => control(/^Mis favoritos/), 'la fila de favoritos')
    expect(fila.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).not.toContain('Guía favorita de prueba')
  })
})
