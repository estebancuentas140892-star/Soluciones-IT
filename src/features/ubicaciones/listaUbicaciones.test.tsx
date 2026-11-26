// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Ubicacion } from '../../lib/db'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  navegarAtras,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { mapaPorId } from './arbol'
import { buscarUbicaciones } from './busquedaUbicaciones'
import { UbicacionPage } from './UbicacionPage'
import { UbicacionesPage } from './UbicacionesPage'

// LA LISTA DE UBICACIONES (encargo del 2026-11-26, sección 8): buscando,
// cada lugar lleva la ruta de sus padres para distinguir dos con el mismo
// nombre, y lo escrito vuelve al volver de la ficha. Todo es INVENTADO.

function ubicacion(id: string, nombre: string, padreId: string | null = null): Ubicacion {
  return { id, nombre, padreId, notas: '', updatedAt: '2026-11-26T12:00:00.000Z', updatedBy: null, eliminadoEn: null }
}

const LUGARES = [
  ubicacion('sede', 'Sede de prueba'),
  ubicacion('norte', 'Taquilla Norte de prueba', 'sede'),
  ubicacion('sur', 'Taquilla Sur de prueba', 'sede'),
  ubicacion('caja-n', 'Caja 3', 'norte'),
  ubicacion('caja-s', 'Caja 3', 'sur'),
]

describe('buscarUbicaciones', () => {
  const porId = mapaPorId(LUGARES)

  it('lleva la ruta de los padres para distinguir dos lugares iguales', () => {
    const encontradas = buscarUbicaciones(LUGARES, porId, 'caja')
    expect(encontradas.map((e) => e.padres)).toEqual([
      'Sede de prueba > Taquilla Norte de prueba',
      'Sede de prueba > Taquilla Sur de prueba',
    ])
  })

  it('una palabra del padre acota, pero no trae a todos sus hijos', () => {
    expect(buscarUbicaciones(LUGARES, porId, 'norte caja').map((e) => e.u.id)).toEqual(['caja-n'])
    expect(buscarUbicaciones(LUGARES, porId, 'norte').map((e) => e.u.id)).toEqual(['norte'])
  })

  it('una raíz no lleva ruta', () => {
    expect(buscarUbicaciones(LUGARES, porId, 'sede')).toEqual([{ u: LUGARES[0], padres: '' }])
  })

  it('sin tildes ni mayúsculas', () => {
    expect(buscarUbicaciones([ubicacion('a', 'Área de cómputo')], mapaPorId([]), 'AREA computo')).toHaveLength(1)
  })
})

const RUTAS = [
  { ruta: '/ubicaciones', elemento: <UbicacionesPage /> },
  { ruta: '/ubicaciones/:ubicacionId', elemento: <UbicacionPage /> },
]

function campoUbicaciones(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Ubicaciones"]')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await db.ubicaciones.bulkPut(LUGARES)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('la lista de ubicaciones', () => {
  it('buscando, cada «Caja 3» dice en qué taquilla está', async () => {
    await montar(RUTAS, '/ubicaciones')
    await escribir(await esperar(campoUbicaciones, 'el buscador'), 'caja')
    await esperar(() => textoPantalla().includes('Sede de prueba > Taquilla Sur de prueba'), 'la ruta del segundo')
    expect(textoPantalla()).toContain('Sede de prueba > Taquilla Norte de prueba')
  })

  it('volver de la ficha con el regreso de la app repone lo escrito', async () => {
    await montar(RUTAS, '/ubicaciones')
    await escribir(await esperar(campoUbicaciones, 'el buscador'), 'norte caja')
    await tocar(await esperar(() => control(/^Caja 3/), 'el resultado'))
    await esperar(() => ubicacionActual().pathname === '/ubicaciones/caja-n', 'la ficha')

    await tocar(await esperarControl('Volver a Ubicaciones'))

    await esperar(() => ubicacionActual().pathname === '/ubicaciones', 'la lista')
    expect((await esperar(campoUbicaciones, 'el buscador')).value).toBe('norte caja')
  })

  it('volver con el botón atrás del teléfono también la repone', async () => {
    await montar(RUTAS, '/ubicaciones')
    await escribir(await esperar(campoUbicaciones, 'el buscador'), 'sur')
    await tocar(await esperar(() => control(/^Taquilla Sur de prueba/), 'el resultado'))
    await esperar(() => ubicacionActual().pathname === '/ubicaciones/sur', 'la ficha')

    await navegarAtras()

    expect((await esperar(campoUbicaciones, 'el buscador')).value).toBe('sur')
  })
})
