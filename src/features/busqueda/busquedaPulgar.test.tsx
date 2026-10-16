// @vitest-environment happy-dom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Monitor, Storefront, type IconoProps } from '../../components/iconos'
import { db } from '../../lib/db'
import {
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
} from '../../pruebas/montaje'
import { BuscadorGlobal } from './BuscadorGlobal'

// LA BÚSQUEDA GLOBAL EN EL TELÉFONO, FIEL AL HANDOFF "1b Pulgar" (tarea
// 342). Solo presentación: el índice, lo que se busca y lo que filtra cada
// chip no cambian. Rótulos de grupo a 13/650, el chip activo relleno, filas
// de 62 con la IP en mono, "Nada coincide" compacto con sus dos salidas y el
// estado vacío con menos niveles; desde 768, el estado vacío y "Sin
// coincidencias" de siempre. Un POS sigue siendo un equipo: las
// autorizaciones de Facturación no se indexan. Todo lo sembrado es inventado.

const AHORA = '2026-10-16T12:00:00.000Z'

function trazoDe(Icono: (props: IconoProps) => React.JSX.Element): string | undefined {
  return /\sd="([^"]+)"/.exec(renderToStaticMarkup(createElement(Icono)))?.[1]
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await db.categorias.bulkPut([
    { id: 'cat-pos', nombre: 'POS', icono: '', orden: 1, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
    { id: 'cat-pc', nombre: 'Computadores', icono: '', orden: 2, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
  ])
  await sembrarEquipo({ id: 'pos-1', nombre: 'Caja de prueba norte', categoriaId: 'cat-pos', ip: '10.9.9.40' })
  await sembrarEquipo({ id: 'pc-1', nombre: 'Caja de prueba sur', categoriaId: 'cat-pc', ip: '' })
  await sembrarGuia({ id: 'g-caja', titulo: 'Caja de prueba: cambiar el rollo', pasos: [pasoPrueba('g-caja-p1', 'Paso', ['Haz algo de prueba'])] })
})

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

afterEach(async () => {
  await desmontarTodo()
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
})

async function abrir(): Promise<HTMLInputElement> {
  await montar([{ ruta: '/', elemento: <BuscadorGlobal abierto onCerrar={() => undefined} /> }], '/')
  return esperar(campoBuscador, 'el campo')
}

describe('el estado vacío', () => {
  it('un rótulo a 13/650, qué se puede buscar y ejemplos, sin recientes', async () => {
    await abrir()
    const rotulo = await esperar(
      () => Array.from(document.body.querySelectorAll('p')).find((p) => p.textContent === '¿Qué necesitas resolver?'),
      'el rótulo',
    )
    expect(rotulo.className).toContain('text-[13px]')
    expect(rotulo.className).toContain('font-[650]')
    expect(textoPantalla()).toContain('Nombre de equipo, IP, persona, ubicación, problema o guía.')
    expect(textoPantalla()).not.toContain('Recientes')
    expect(textoPantalla()).not.toContain('Prueba con')
  })
})

describe('los resultados en el teléfono', () => {
  it('rótulos de grupo a 13/650 sin mayúsculas, chip activo relleno y la IP en mono a la derecha', async () => {
    await escribir(await abrir(), 'caja de prueba')
    await esperar(() => textoPantalla().includes('Caja de prueba norte'), 'los resultados')

    // EL CHIP ACTIVO, relleno de alto contraste en los dos temas.
    const todo = await esperar(() => control(/^Todo\d/), 'el chip "Todo"')
    expect(todo.getAttribute('aria-pressed')).toBe('true')
    for (const clase of ['max-md:bg-noct-text', 'max-md:text-noct-bg', 'max-md:border-noct-text']) expect(todo.className).toContain(clase)
    const equipos = control(/^Equipos\d/) as HTMLElement
    expect(equipos.className).not.toContain('max-md:bg-noct-text')

    // LOS RÓTULOS DE GRUPO: 13/650, en minúsculas, con su número en mono.
    const rotulos = Array.from(document.body.querySelectorAll<HTMLElement>('section > div > h2'))
    expect(rotulos.length).toBeGreaterThan(0)
    for (const rotulo of rotulos) {
      for (const clase of ['max-md:text-[13px]', 'max-md:font-[650]', 'max-md:normal-case']) expect(rotulo.className).toContain(clase)
    }

    // LA FILA: 62 de alto, su divisor y la IP técnica en mono a la derecha.
    const norte = control(/^Caja de prueba norte/) as HTMLElement
    expect(norte.className).toContain('max-md:min-h-[62px]')
    expect(norte.parentElement?.className).toContain('max-md:border-b')
    const ip = norte.querySelector<HTMLElement>('[data-ip-resultado]')
    expect(ip?.textContent).toBe('10.9.9.40')
    expect(ip?.className).toContain('font-mono')
    expect(ip?.className).toContain('md:hidden')
    // El nombre no se recorta.
    expect(norte.querySelector('[data-nombre-principal]')?.className).not.toContain('truncate')
    // Sin IP, no hay hueco.
    expect((control(/^Caja de prueba sur/) as HTMLElement).querySelector('[data-ip-resultado]')).toBeNull()
  })

  // Un POS no es Facturación: sin autorizaciones indexadas no se finge un
  // resultado de Facturación con su icono.
  it('un POS sigue siendo un equipo, con el icono de equipo', async () => {
    await escribir(await abrir(), 'caja de prueba')
    const norte = await esperar(() => control(/^Caja de prueba norte/), 'el POS')
    expect(norte.querySelector('svg path')?.getAttribute('d')).toBe(trazoDe(Monitor))
    expect(norte.querySelector('svg path')?.getAttribute('d')).not.toBe(trazoDe(Storefront))
    const sur = control(/^Caja de prueba sur/) as HTMLElement
    expect(sur.querySelector('svg path')?.getAttribute('d')).toBe(trazoDe(Monitor))
  })
})

describe('nada coincide', () => {
  it('compacto, dice qué se buscó y conserva Crear equipo y Limpiar búsqueda', async () => {
    const campo = await abrir()
    await escribir(campo, 'zzqxw')
    await esperar(() => textoPantalla().includes('Nada coincide con «zzqxw»'), 'el estado sin resultados')
    expect(textoPantalla()).toContain('Prueba con el código del equipo, parte de la IP o una palabra del problema.')
    expect(textoPantalla()).not.toContain('Sin coincidencias')
    expect(document.body.querySelector('.border-dashed')).toBeNull()
    expect(control('Crear equipo')?.getAttribute('href')).toBe('/dispositivos/nuevo?nombre=zzqxw')
    expect(control('Limpiar búsqueda')).not.toBeNull()
  })
})

describe('desde 768, la presentación de siempre', () => {
  it('el estado vacío y "Sin coincidencias" son los de antes de la 342, con las mismas salidas', async () => {
    ventana.happyDOM.setViewport({ width: 1024, height: 768 })
    const campo = await abrir()
    const rotulo = await esperar(
      () => Array.from(document.body.querySelectorAll('p')).find((p) => p.textContent === '¿Qué necesitas resolver?'),
      'el rótulo',
    )
    expect(rotulo.className).toContain('text-[14.5px]')
    expect(rotulo.className).not.toContain('font-[650]')
    expect(textoPantalla()).toContain('"backup" encuentra "copia de seguridad"')
    expect(textoPantalla()).not.toContain('No hace falta elegir antes qué buscas.')

    await escribir(campo, 'zzqxw')
    await esperar(() => textoPantalla().includes('Sin coincidencias'), 'el estado sin resultados')
    expect(textoPantalla()).toContain('Nada coincide con "zzqxw". Prueba otra palabra o revisa la ortografía.')
    expect(textoPantalla()).not.toContain('Nada coincide con «zzqxw»')
    const caja = document.body.querySelector<HTMLElement>('.border-dashed')
    expect(caja).not.toBeNull()
    expect(caja?.contains(control('Crear equipo'))).toBe(true)
    expect(caja?.contains(control('Limpiar búsqueda'))).toBe(true)
  })
})
