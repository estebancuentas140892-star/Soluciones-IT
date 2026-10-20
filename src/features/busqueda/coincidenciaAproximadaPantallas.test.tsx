// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Chasis } from '../../app/Chasis'
import { db } from '../../lib/db'
import {
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  navegarAtras,
  pasoPrueba,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  tocar,
  textoPantalla,
  ubicacionActual,
} from '../../pruebas/montaje'
import { persona } from '../../pruebas/datosBusquedaAproximada'
import { DispositivosPage } from '../dispositivos/DispositivosPage'
import { ResolverPage } from '../inicio/ResolverPage'

// LAS DOS PANTALLAS DICEN LO APROXIMADO COMO LO QUE ES (tarea 346). Montando
// Resolver (en el teléfono, 375 px) y Equipos de verdad: "Quizás buscabas…"
// y "Posible coincidencia" en Resolver, "Posibles coincidencias" en Equipos;
// el campo conserva lo escrito, nada se abre solo y volver de una ficha
// repone la búsqueda y el chip. Todo lo sembrado es inventado.

const AHORA = '2026-10-20T00:00:00.000Z'

function FichaEquipo() {
  return (
    <Chasis modo="documento" titulo="Ficha del equipo">
      <p>FICHA DEL EQUIPO</p>
    </Chasis>
  )
}

const RUTAS = [
  { ruta: '/', elemento: <ResolverPage /> },
  { ruta: '/dispositivos', elemento: <DispositivosPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <FichaEquipo /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>LA GUÍA</p> },
]

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await sembrarGuia({
    id: 'g-no-imprime',
    titulo: 'La impresora no imprime',
    pasos: [pasoPrueba('p1', 'Revisar la cola', ['Abrir la cola de impresión'])],
  })
  await db.categorias.bulkPut([
    { id: 'cat-pc', nombre: 'Computadores', icono: '', orden: 2, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
    { id: 'cat-imp', nombre: 'Impresoras', icono: '', orden: 3, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
  ])
  await db.personas.bulkPut([
    persona('p-daniel-garcia', 'Daniel García'),
    persona('p-daniel-gracia', 'Daniel Gracia'),
    persona('p-daniela-gracia', 'Daniela Gracia'),
  ])
  await sembrarEquipo({ id: 'eq-tesoreria', nombre: 'PC Tesorería', categoriaId: 'cat-pc', responsableId: 'p-daniel-garcia', responsable: 'Daniel García' })
  await sembrarEquipo({ id: 'eq-bodega', nombre: 'Impresora Bodega', categoriaId: 'cat-imp', responsableId: 'p-daniel-gracia', responsable: 'Daniel Gracia' })
  await sembrarEquipo({ id: 'eq-mercadeo', nombre: 'Impresora Mercadeo', categoriaId: 'cat-imp', responsableId: 'p-daniela-gracia', responsable: 'Daniela Gracia' })
})

afterEach(async () => {
  await desmontarTodo()
})

function enlaceDe(texto: string): HTMLAnchorElement | undefined {
  return Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent?.includes(texto))
}

describe('Resolver: "Quizás buscabas…" y "Posible coincidencia"', () => {
  it('"no impirme" encuentra la guía, lo dice y propone "no imprime" sin cambiar el campo ni abrir nada', async () => {
    await montar(RUTAS, '/')
    const campo = await esperar(campoBuscador, 'el buscador')
    await escribir(campo, 'no impirme')
    const propuesta = await esperar(
      () => document.body.querySelector<HTMLButtonElement>('[data-quizas-buscabas] button'),
      'Quizás buscabas',
    )
    expect(propuesta.textContent).toBe('«no imprime»')
    // La guía destacada se dice como posible, no como "la que mejor coincide".
    expect(textoPantalla()).toContain('Posible coincidencia')
    expect(textoPantalla()).not.toContain('La guía que mejor coincide')
    // Es la única guía: no se promete que haya otras parecidas debajo.
    expect(textoPantalla()).not.toContain('Hay otras guías parecidas debajo')
    expect(control('Abrir la guía: La impresora no imprime')).not.toBeNull()
    // Nada cambió solo: el campo dice lo escrito y seguimos en Resolver.
    expect(campo.value).toBe('no impirme')
    expect(ubicacionActual().pathname).toBe('/')

    // Tocar la propuesta es decidir: busca "no imprime", que ya es exacto.
    await tocar(propuesta)
    expect(campo.value).toBe('no imprime')
    await esperar(() => textoPantalla().includes('La guía que mejor coincide'), 'la coincidencia exacta')
    expect(document.body.querySelector('[data-quizas-buscabas]')).toBeNull()
    expect(ubicacionActual().pathname).toBe('/')
  })

  it('"daniel garcia" enseña a la persona exacta y a las parecidas, cada una dicha como lo que es', async () => {
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador'), 'daniel garcia')
    await esperar(() => enlaceDe('Daniel Gracia'), 'Daniel Gracia')
    expect(enlaceDe('Daniela Gracia')).toBeDefined()
    expect(enlaceDe('Daniel García')).toBeDefined()
    // La exacta no lleva la marca; las parecidas sí.
    expect(enlaceDe('Daniel García')?.querySelector('[data-posible-coincidencia]')).toBeNull()
    expect(enlaceDe('Daniel Gracia')?.querySelector('[data-posible-coincidencia]')).not.toBeNull()
    // Nadie se elige solo.
    expect(ubicacionActual().pathname).toBe('/')
  })
})

describe('Equipos: "Posibles coincidencias", con los filtros y el regreso de siempre', () => {
  const campoEquipos = () => document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Equipos"]')

  it('"daniel garcia": el exacto arriba y los parecidos aparte, todos a la vista', async () => {
    await montar(RUTAS, '/dispositivos')
    await escribir(await esperar(campoEquipos, 'el buscador de Equipos'), 'daniel garcia')
    await esperar(() => textoPantalla().includes('Posibles coincidencias'), 'la sección de posibles')
    const texto = textoPantalla()
    expect(texto.indexOf('PC Tesorería')).toBeLessThan(texto.indexOf('Posibles coincidencias'))
    expect(texto.indexOf('Posibles coincidencias')).toBeLessThan(texto.indexOf('Impresora Bodega'))
    expect(texto).toContain('Impresora Mercadeo')
    expect(ubicacionActual().pathname).toBe('/dispositivos')
  })

  it('sin nada exacto lo dice, y volver de una posible coincidencia repone lo escrito y el chip', async () => {
    await montar(RUTAS, '/dispositivos?categoria=cat-imp')
    const campo = await esperar(campoEquipos, 'el buscador de Equipos')
    await escribir(campo, 'impresra')
    await esperar(() => textoPantalla().includes('Nada coincide tal cual con «impresra»'), 'el aviso')
    // El chip de la categoría sigue puesto y los dos son de esa categoría.
    expect(ubicacionActual().search).toBe('?categoria=cat-imp')
    expect(textoPantalla()).not.toContain('PC Tesorería')
    await tocar((await esperar(() => enlaceDe('Impresora Bodega'), 'la posible')) as HTMLElement)
    await esperar(() => textoPantalla().includes('FICHA DEL EQUIPO'), 'la ficha')

    await navegarAtras()
    expect(ubicacionActual().pathname).toBe('/dispositivos')
    expect(ubicacionActual().search).toBe('?categoria=cat-imp')
    expect((await esperar(campoEquipos, 'el buscador repuesto')).value).toBe('impresra')
    await esperar(() => textoPantalla().includes('Posibles coincidencias'), 'las mismas posibles')
  })
})
