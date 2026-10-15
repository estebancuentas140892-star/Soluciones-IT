// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// LA EJECUCIÓN DE UNA GUÍA POR ANCHO (tarea 339, T5; handoff de tableta y
// escritorio):
//
//   - en el teléfono y la tableta el índice se abre desde el contador, en su
//     hoja, que desde 768 px es el panel lateral derecho;
//   - desde 1280 el índice ESTÁ: una columna de 280 a la izquierda con los
//     mismos pasos y el mismo `onIrAPaso`; el contador no abre ninguna hoja
//     y la tarea sigue sin navegación principal;
//   - el paso entero, los detalles y empezar de nuevo siguen al alcance.
//
// Todo lo sembrado es inventado.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]
const RUTA = '/soluciones/cat-pruebas/guia-ancho'

async function sembrarTresPasos() {
  await sembrarGuia({
    id: 'guia-ancho',
    titulo: 'Guía de prueba por ancho',
    pasos: [
      pasoPrueba('pa-p1', 'Abrir el programa de prueba', ['Pulsar el icono de prueba']),
      pasoPrueba('pa-p2', 'Configurar la prueba', ['Escribir el valor de prueba']),
      pasoPrueba('pa-p3', 'Comprobar la prueba', ['Imprimir la hoja de prueba']),
    ],
  })
  // Con un paso hecho, la guía abre directamente en el paso 2.
  await db.progresoPasos.put({
    articuloId: 'guia-ancho',
    pasosHechos: ['pa-p1'],
    instruccionesHechas: ['pa-p1-t1'],
    verificacionHecha: [],
    actualizadoEn: new Date().toISOString(),
  })
}

const indicePersistente = () => document.body.querySelector<HTMLElement>('nav[aria-label="Pasos de la guía"]')
const dialogo = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
})

describe('el índice de la guía por ancho', () => {
  it('a 768 px el contador abre el índice en el panel lateral', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await sembrarTresPasos()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Escribir el valor de prueba'), 'el paso 2')
    expect(indicePersistente()).toBeNull()

    await tocar(await esperarControl(/^Paso 2 de 3\. Abrir el índice de pasos$/))
    const panel = await esperar(() => dialogo(), 'el panel del índice')
    expect(panel.textContent).toContain('Ruta de la guía')
    for (const clase of ['md:w-[420px]', 'md:h-full']) expect(panel.className).toContain(clase)
  })

  it('a 1280 px el índice está a la izquierda, sin hoja, y abrir un paso lo muestra', async () => {
    ventana.happyDOM.setViewport({ width: 1280, height: 832 })
    await sembrarTresPasos()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Escribir el valor de prueba'), 'el paso 2')

    const indice = await esperar(() => indicePersistente(), 'la columna del índice')
    const filas = Array.from(indice.querySelectorAll<HTMLElement>('ol button'))
    expect(filas.map((f) => f.textContent?.trim())).toEqual([
      expect.stringContaining('Abrir el programa de prueba'),
      expect.stringContaining('Configurar la prueba'),
      expect.stringContaining('Comprobar la prueba'),
    ])
    expect(filas[1].getAttribute('aria-current')).toBe('step')
    // Lo que el índice ofrecía en su hoja sigue a mano.
    expect(indice.textContent).toContain('Ver el paso entero')
    expect(indice.textContent).toContain('Detalles de la guía')

    // El contador no abre ninguna hoja: lleva el foco al paso de trabajo.
    await tocar(await esperarControl(/^Paso 2 de 3\. Abrir el índice de pasos$/))
    expect(dialogo()).toBeNull()
    expect(document.activeElement).toBe(filas[1])

    // Abrir el paso 1 (hecho) desde la columna lo muestra.
    await tocar(filas[0])
    await esperar(() => textoPantalla().includes('Pulsar el icono de prueba'), 'el paso 1 a la vista')
    expect(indicePersistente()).not.toBeNull()

    // La tarea no monta navegación principal.
    expect(document.body.querySelector('nav[aria-label="Navegación principal"]')).toBeNull()
  })
})
