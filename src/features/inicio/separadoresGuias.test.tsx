// @vitest-environment happy-dom
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

/** Las clases del divisor del teléfono, y que la última fila no lo lleve. */
function conDivisorDelTelefono(fila: Element, conRelleno: Element = fila): void {
  expect(fila.className).toContain('max-md:border-b')
  expect(fila.className).toContain('max-md:border-noct-divider-fuerte')
  expect(fila.className).toContain('max-md:last:border-b-0')
  // El aire, en el elemento que lleva el relleno (en los resultados, el enlace).
  expect(conRelleno.className).toContain('max-md:py-3')
  // Desde 768 no cambia nada: ni divisor ni relleno nuevos sin variante.
  expect(fila.className.split(/\s+/)).not.toContain('border-b')
}

describe('las guías se distinguen una de otra en el teléfono (tarea 347)', () => {
  it('Recientes: cada guía con su divisor y la última sin él', async () => {
    await montar(RUTAS, '/')
    const seccion = await esperar(
      () => document.body.querySelector('section[aria-labelledby="resolver-recientes"]'),
      'Recientes',
    )
    const filas = await esperar(() => {
      const enlaces = Array.from(seccion.querySelectorAll('a'))
      return enlaces.length === TITULOS.length ? enlaces : null
    }, 'las tres recientes')
    for (const fila of filas) conDivisorDelTelefono(fila)
    // Son hermanas en la misma lista: `last:` deja sin divisor solo la última.
    expect(new Set(filas.map((fila) => fila.parentElement)).size).toBe(1)
    expect(filas.at(-1)?.nextElementSibling).toBeNull()
    // El título manda; el detalle va detrás.
    const titulo = filas[0].querySelector('[data-nombre-principal]')
    expect(titulo?.className).toContain('max-md:font-semibold')
  })

  it('los resultados de la búsqueda: cada guía con su divisor y la última del grupo sin él', async () => {
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador'), 'impresora de prueba')
    const filas = await esperar(() => {
      const enlaces = Array.from(document.body.querySelectorAll('[data-nombre-principal]'))
        .map((titulo) => titulo.closest('a')?.parentElement)
        .filter((fila): fila is HTMLElement => Boolean(fila?.className.includes('max-md:mx-2')))
      return enlaces.length >= 2 ? enlaces : null
    }, 'las filas de resultados')
    for (const fila of filas) conDivisorDelTelefono(fila, fila.querySelector('a') as HTMLElement)
    expect(filas.at(-1)?.nextElementSibling).toBeNull()
  })
})
