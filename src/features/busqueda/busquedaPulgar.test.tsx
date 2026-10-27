// @vitest-environment happy-dom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Storefront, type IconoProps } from '../../components/iconos'
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
  tocar,
} from '../../pruebas/montaje'
import { BuscadorGlobal } from './BuscadorGlobal'

// LA BÚSQUEDA GLOBAL EN EL TELÉFONO (tarea 342, handoff "1b Pulgar";
// revisada en la tarea 344, DESPUÉS de Claude Design). Solo presentación: el
// índice, lo que se busca y lo que filtra cada chip no cambian. Rótulos de
// grupo a 15/650 (tarea 344), el chip activo relleno, filas de 62 con la IP
// en mono, "Nada coincide" compacto con sus dos salidas y el estado vacío
// "Puedes escribir" con ejemplos que se tocan; desde 768, el estado vacío y
// "Sin coincidencias" de siempre. Un POS sigue siendo un equipo: las
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
  it('"Puedes escribir", qué se puede buscar y ejemplos que escriben la consulta, sin recientes', async () => {
    const campo = await abrir()
    await esperar(() => textoPantalla().includes('Puedes escribir'), 'el rótulo')
    expect(textoPantalla()).toContain('el nombre o la IP de un equipo, una persona o un lugar')
    expect(textoPantalla()).not.toContain('Recientes')
    await tocar(await esperar(() => control('no imprime'), 'el ejemplo'))
    expect(campo.value).toBe('no imprime')
  })
})

describe('los resultados en el teléfono', () => {
  it('rótulos de grupo a 15/800, chip activo relleno, cada grupo en su tarjeta y la IP que se copia (tareas 350 y 362)', async () => {
    await escribir(await abrir(), 'caja de prueba')
    await esperar(() => textoPantalla().includes('Caja de prueba norte'), 'los resultados')

    // EL CHIP ACTIVO, relleno de tinta en los dos temas, con su número en la
    // misma palabra («Todo 4»).
    const todo = await esperar(() => control(/^Todo \d/), 'el chip "Todo"')
    expect(todo.getAttribute('aria-pressed')).toBe('true')
    for (const clase of ['bg-noct-text', 'text-noct-bg', 'border-noct-text', 'h-9', 'toque-amplio']) expect(todo.className).toContain(clase)
    const equipos = control(/^Equipos \d/) as HTMLElement
    expect(equipos.className).not.toContain('bg-noct-text')

    // LOS RÓTULOS DE GRUPO: 15/800 en tinta 2, sin mayúsculas, uno por tipo.
    const rotulos = Array.from(document.body.querySelectorAll<HTMLElement>('section[data-grupo-resultados] h2'))
    expect(rotulos.map((rotulo) => rotulo.textContent)).toContain('Equipos')
    for (const rotulo of rotulos) {
      for (const clase of ['text-[15px]', 'font-extrabold', 'text-noct-neutral-300']) expect(rotulo.className).toContain(clase)
      expect(rotulo.className).not.toContain('uppercase')
    }

    // LA TARJETA DEL GRUPO (tarea 362): una para todo el grupo, una fila por
    // equipo, la IP en mono bajo el nombre y copiar en la fila.
    const norte = control(/^Caja de prueba norte/) as HTMLElement
    expect(norte.closest('[data-fila-resultado="dispositivo"]')?.parentElement?.className).toContain('border-[1.5px]')
    const ip = norte.querySelector<HTMLElement>('[data-ip-resultado]')
    expect(ip?.textContent).toBe('10.9.9.40')
    expect(ip?.className).toContain('font-mono')
    expect(control('Copiar IP de Caja de prueba norte')?.className).toContain('h-11 w-11')
    // El nombre no se recorta.
    expect(norte.querySelector('[data-nombre-principal]')?.className).not.toContain('truncate')
    // Sin IP, no hay hueco ni copiar.
    expect((control(/^Caja de prueba sur/) as HTMLElement).querySelector('[data-ip-resultado]')).toBeNull()
    expect(control('Copiar IP de Caja de prueba sur')).toBeNull()

    // EL ICONO DE SU CLASE (tareas 349 y 350): cada equipo con el «Icono de
    // categoría» de su clase, el de la lista de Equipos.
    const claseDe = (fila: HTMLElement) => fila.querySelector<HTMLElement>('[data-icono-categoria]')?.dataset.iconoCategoria
    expect(claseDe(norte)).toBe('pos')
    expect(claseDe(control(/^Caja de prueba sur/) as HTMLElement)).toBe('computador')
  })

  // Un POS no es Facturación: sin autorizaciones indexadas no se finge un
  // resultado de Facturación. Es un equipo, en el grupo de los equipos.
  it('un POS sigue siendo un equipo, en el grupo Equipos', async () => {
    await escribir(await abrir(), 'caja de prueba')
    const norte = await esperar(() => control(/^Caja de prueba norte/), 'el POS')
    expect(norte.closest('[data-fila-resultado]')?.getAttribute('data-fila-resultado')).toBe('dispositivo')
    expect(norte.closest('[data-grupo-resultados]')?.querySelector('h2')?.textContent).toBe('Equipos')
    expect(norte.querySelector('svg path')?.getAttribute('d')).not.toBe(trazoDe(Storefront))
    const sur = control(/^Caja de prueba sur/) as HTMLElement
    expect(sur.closest('[data-fila-resultado]')?.getAttribute('data-fila-resultado')).toBe('dispositivo')
  })
})

describe('nada coincide', () => {
  it('compacto, dice qué se buscó y conserva Crear equipo y Limpiar búsqueda', async () => {
    const campo = await abrir()
    await escribir(campo, 'zzqxw')
    await esperar(() => textoPantalla().includes('Nada coincide con «zzqxw»'), 'el estado sin resultados')
    expect(textoPantalla()).toContain('Prueba con otra palabra, el nombre del equipo o su IP.')
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
