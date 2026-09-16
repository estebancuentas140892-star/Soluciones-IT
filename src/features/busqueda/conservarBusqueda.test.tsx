// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Chasis } from '../../app/Chasis'
import { leerBusquedaRestaurada } from '../../lib/origenNavegacion'
import {
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  navegarAtras,
  sembrarEquipo,
  sembrarPerfil,
  sembrarReferencia,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { InicioPage } from '../inicio/InicioPage'

// VOLVER DE UNA FICHA CON LA BÚSQUEDA ESCRITA (encargo del 2026-09-16,
// caso I de la sección 16).
//
// Las fichas de destino son pantallas mínimas montadas en el chasis REAL
// (nivel documento), porque lo que se prueba es su regreso: el botón de
// volver de la app y el botón atrás del teléfono. La sección de origen
// para la capa global es también el chasis real, con su lupa.

// Cada pantalla es su propio componente, como en la app: dos rutas que
// montaran el mismo componente se reutilizarían en vez de montarse de
// nuevo (ese caso tiene su propia prueba, más abajo).
function PaginaRed() {
  return (
    <Chasis titulo="Red">
      <p>LISTA DE RED</p>
    </Chasis>
  )
}

function FichaEquipo() {
  return (
    <Chasis modo="documento" titulo="Ficha del equipo">
      <p>FICHA DEL EQUIPO</p>
    </Chasis>
  )
}

function FichaHerramienta() {
  return (
    <Chasis modo="documento" titulo="Ficha de la herramienta">
      <p>FICHA DE LA HERRAMIENTA</p>
    </Chasis>
  )
}

const RUTAS = [
  { ruta: '/', elemento: <InicioPage /> },
  { ruta: '/red', elemento: <PaginaRed /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <FichaEquipo /> },
  { ruta: '/referencia/:referenciaId', elemento: <FichaHerramienta /> },
]

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await sembrarEquipo({ id: 'eq-servidor', nombre: 'Servidor de archivos de prueba' })
  await sembrarReferencia({ id: 'ref-zabbix', tipo: 'herramienta', titulo: 'Zabbix', definicion: 'Monitoreo de prueba.' })
})

afterEach(async () => {
  await desmontarTodo()
})

/** El enlace de un resultado, por su título. */
function enlaceDe(titulo: string): HTMLAnchorElement | undefined {
  return Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent?.includes(titulo))
}

describe('caso I: desde Inicio', () => {
  async function abrirFichaDesdeInicio(): Promise<void> {
    await montar(RUTAS, '/')
    await escribir(await esperar(campoBuscador, 'el buscador de Inicio'), 'servidor')
    await tocar(await esperar(() => enlaceDe('Servidor de archivos de prueba'), 'el resultado'))
    await esperar(() => textoPantalla().includes('FICHA DEL EQUIPO'), 'la ficha del equipo')
    // La consulta viaja en el estado de navegación, nunca en la URL.
    expect(ubicacionActual().search).toBe('')
    expect(window.localStorage.length).toBe(0)
  }

  it('volver con el regreso de la app repone "servidor" en Inicio', async () => {
    await abrirFichaDesdeInicio()

    await tocar(await esperarControl('Volver a la búsqueda'))

    expect(ubicacionActual().pathname).toBe('/')
    const campo = await esperar(campoBuscador, 'el buscador de Inicio')
    expect(campo.value).toBe('servidor')
    await esperar(() => enlaceDe('Servidor de archivos de prueba'), 'los mismos resultados')
  })

  it('volver con el botón atrás del teléfono también la repone', async () => {
    await abrirFichaDesdeInicio()

    await navegarAtras()

    expect(ubicacionActual().pathname).toBe('/')
    expect((await esperar(campoBuscador, 'el buscador de Inicio')).value).toBe('servidor')
  })

  it('vaciar el campo da la búsqueda por terminada: se olvida del historial', async () => {
    await abrirFichaDesdeInicio()
    await tocar(await esperarControl('Volver a la búsqueda'))
    const campo = await esperar(campoBuscador, 'el buscador de Inicio')

    await escribir(campo, '')

    await esperar(() => leerBusquedaRestaurada(ubicacionActual().state) === null, 'la búsqueda sale del historial')
  })
})

describe('caso I: desde la capa global de una sección', () => {
  async function abrirFichaDesdeLaCapa(): Promise<void> {
    await montar(RUTAS, '/red')
    await tocar(await esperarControl('Buscar en Soluciones IT'))
    await escribir(await esperar(campoBuscador, 'el buscador de la capa'), 'zabbix')
    await tocar(await esperar(() => enlaceDe('Zabbix'), 'el resultado'))
    await esperar(() => textoPantalla().includes('FICHA DE LA HERRAMIENTA'), 'la ficha')
    expect(campoBuscador()).toBeNull()
  }

  it('volver a Red reabre la capa con "zabbix" escrito y sus resultados', async () => {
    await abrirFichaDesdeLaCapa()

    await tocar(await esperarControl('Volver a la búsqueda'))

    expect(ubicacionActual().pathname).toBe('/red')
    const campo = await esperar(campoBuscador, 'la capa reabierta')
    expect(campo.value).toBe('zabbix')
    await esperar(() => enlaceDe('Zabbix'), 'los mismos resultados')
    expect(textoPantalla()).toContain('LISTA DE RED')
  })

  it('el botón atrás del teléfono también vuelve a la capa con la consulta', async () => {
    await abrirFichaDesdeLaCapa()

    await navegarAtras()

    expect(ubicacionActual().pathname).toBe('/red')
    expect((await esperar(campoBuscador, 'la capa reabierta')).value).toBe('zabbix')
  })

  it('cerrar la capa repuesta la da por terminada: no se reabre ni queda en el historial', async () => {
    await abrirFichaDesdeLaCapa()
    await tocar(await esperarControl('Volver a la búsqueda'))
    await esperar(campoBuscador, 'la capa reabierta')

    await tocar(await esperarControl('Cerrar el buscador'))

    expect(campoBuscador()).toBeNull()
    await esperar(() => leerBusquedaRestaurada(ubicacionActual().state) === null, 'la búsqueda sale del historial')
    // Abrirla otra vez con la lupa empieza limpia, como siempre.
    await tocar(await esperarControl('Buscar en Soluciones IT'))
    expect((await esperar(campoBuscador, 'la capa')).value).toBe('')
    expect(control('Volver a la búsqueda')).toBeNull()
  })
})

describe('caso I: de una ficha a otra del mismo tipo', () => {
  it('equipo A, capa con "/", equipo B y volver: A repone la capa aunque React no la vuelva a montar', async () => {
    await sembrarEquipo({ id: 'eq-caja', nombre: 'Caja 4 de prueba' })
    await montar(RUTAS, '/dispositivos/eq-servidor')
    await esperar(() => textoPantalla().includes('FICHA DEL EQUIPO'), 'la ficha del equipo A')

    // La capa global con el atajo de teclado, como en escritorio.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }))
    await escribir(await esperar(campoBuscador, 'la capa'), 'caja')
    await tocar(await esperar(() => enlaceDe('Caja 4 de prueba'), 'el resultado'))
    await esperar(() => ubicacionActual().pathname === '/dispositivos/eq-caja', 'la ficha del equipo B')
    expect(campoBuscador()).toBeNull()

    await tocar(await esperarControl('Volver a la búsqueda'))

    expect(ubicacionActual().pathname).toBe('/dispositivos/eq-servidor')
    expect((await esperar(campoBuscador, 'la capa repuesta')).value).toBe('caja')
  })
})
