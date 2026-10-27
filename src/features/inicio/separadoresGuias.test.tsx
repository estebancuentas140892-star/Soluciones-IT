// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registrarVisita } from '../../lib/recientes'
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
import { ResolverPage } from './ResolverPage'

// CADA GUÍA, CON SU DIVISOR (tarea 347). En el teléfono, las guías de
// Recientes y de los resultados de la búsqueda de Resolver se separan con un
// divisor horizontal de trazo fuerte, la última de cada lista sin él, y con
// algo más de aire arriba y abajo. Todo con variantes `max-md:`: desde 768 la
// fila es la de siempre. Aquí se fija el reparto de clases; cómo se ve, en
// las capturas del encargo. Las guías son inventadas.
//
// Desde la tarea 350 (prototipo de Claude Design) cada guía es su propia
// tarjeta, con su borde y aire entre una y otra, en «Abiertas hace poco» y en
// los resultados: la misma separación, más clara que el divisor.

const RUTAS = [
  { ruta: '/', elemento: <ResolverPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>Guía abierta</p> },
]

const TITULOS = [
  'Conectar la impresora compartida de prueba a un computador nuevo',
  'Cambiar el tóner de la impresora de prueba de la oficina principal',
  'Instalar la impresora de prueba en red',
]

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  for (const [indice, titulo] of TITULOS.entries()) {
    await sembrarGuia({ id: `g-${indice}`, titulo, pasos: [pasoPrueba(`p-${indice}`, 'Paso', ['Hacer algo'])] })
    await registrarVisita('articulo', `g-${indice}`)
  }
})

afterEach(async () => {
  await desmontarTodo()
})

describe('las guías se distinguen una de otra en el teléfono (tarea 347)', () => {
  it('Abiertas hace poco: cada guía en su propia tarjeta (tareas 347 y 350)', async () => {
    await montar(RUTAS, '/')
    // En el teléfono lo reciente se ve al tocar el campo (tarea 350).
    const campo = await esperar(campoBuscador, 'el buscador')
    await act(async () => {
      campo.focus()
    })
    const seccion = await esperar(
      () => document.body.querySelector('section[aria-labelledby="busqueda-abiertas"]'),
      'Abiertas hace poco',
    )
    const filas = await esperar(() => {
      const enlaces = Array.from(seccion.querySelectorAll('a'))
      return enlaces.length === TITULOS.length ? enlaces : null
    }, 'las tres recientes')
    // Cada una con su borde y su fondo, separadas por aire: dos títulos largos
    // ya no se leen como uno.
    for (const fila of filas) {
      expect(fila.className).toContain('border-[1.5px]')
      expect(fila.className).toContain('bg-noct-surface')
      expect(fila.hasAttribute('data-abierta-hace-poco')).toBe(true)
    }
    expect(seccion.className).toContain('gap-2.5')
    // Con algo reciente, «Puedes escribir» no se dibuja (tarea 358, D2): solo
    // ayuda en el primer uso o con el registro vacío.
    expect(document.body.querySelector('#busqueda-puedes-escribir')).toBeNull()
    // El título manda.
    const titulo = filas[0].querySelector('[data-nombre-principal]')
    expect(titulo?.className).toContain('font-bold')
  })

  it('los resultados de la búsqueda: cada guía en su propia tarjeta (tareas 347 y 350)', async () => {
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador'), 'impresora de prueba')
    const tarjetas = await esperar(() => {
      const encontradas = Array.from(document.body.querySelectorAll('[data-tarjeta-resultado="articulo"]'))
      return encontradas.length >= 2 ? encontradas : null
    }, 'las tarjetas de resultados')
    for (const tarjeta of tarjetas) {
      expect(tarjeta.className).toContain('border-[1.5px]')
      expect(tarjeta.className).toContain('bg-noct-surface')
    }
    // Hermanas en su grupo, separadas por aire.
    expect(tarjetas[0].parentElement?.className).toContain('gap-2')
  })
})
