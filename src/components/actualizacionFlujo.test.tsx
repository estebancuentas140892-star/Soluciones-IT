// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../lib/db'
import {
  activarYRecargar,
  anotarRegistro,
  anotarVersionNueva,
  comprobarActualizacion,
  reiniciarActualizacion,
  type RegistroActualizable,
} from '../lib/actualizacionApp'
import {
  control,
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  sembrarGuia,
  sembrarPerfil,
  pasoPrueba,
  textoPantalla,
  tocar,
} from '../pruebas/montaje'
import { AvisoActualizacion } from './AvisoActualizacion'
import { BuscarActualizacion } from './BuscarActualizacion'

// BUSCAR ACTUALIZACIÓN A MANO Y ACTUALIZAR (encargo del 2026-09-20,
// puntos 3, 5 y 7).
//
// Se montan los componentes de verdad. `ActualizacionDisponible` no se
// monta aquí a propósito: importa `virtual:pwa-register/react`, que solo
// existe con el plugin PWA corriendo; por eso el aviso y la recarga
// viven en piezas propias (`AvisoActualizacion`, `activarYRecargar`) que
// sí se pueden probar.

function registroFalso(conEspera = false): RegistroActualizable & { llamadas: number } {
  return {
    llamadas: 0,
    waiting: conEspera ? {} : undefined,
    async update() {
      this.llamadas += 1
    },
  }
}

beforeEach(() => {
  reiniciarActualizacion()
  // Sin `/version.json` en las pruebas: 404 en vez de salir a la red.
  vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
})

afterEach(async () => {
  await desmontarTodo()
  reiniciarActualizacion()
  vi.restoreAllMocks()
})

describe('la acción manual de Más', () => {
  it('dice que busca y luego que ya está al día', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')

    expect(textoPantalla()).toContain('Buscar actualización')
    // Antes de pedirlo no se enseña el resultado de nada.
    expect(textoPantalla()).not.toContain('Ya tienes la versión más reciente')

    await tocar(await esperar(() => control(/^Buscar actualización/), 'la fila de buscar'))
    await esperar(
      () => textoPantalla().includes('Ya tienes la versión más reciente'),
      'la respuesta de que está al día',
    )
    expect(registro.llamadas).toBeGreaterThanOrEqual(1)
  })

  it('no espera al freno: pedirla dos veces consulta dos veces', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await esperar(() => registro.llamadas === 1, 'la comprobación del registro')
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')

    const fila = await esperar(() => control(/^Buscar actualización/), 'la fila de buscar')
    await tocar(fila)
    await tocar(fila)
    expect(registro.llamadas).toBe(3)
  })

  it('con versión nueva remite al aviso, sin quedarse en silencio', async () => {
    anotarRegistro(registroFalso(true))
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')

    await tocar(await esperar(() => control(/^Buscar actualización/), 'la fila de buscar'))
    await esperar(() => textoPantalla().includes('Versión nueva disponible'), 'el aviso de versión nueva')
    expect(textoPantalla()).toContain('Actualizar')
  })

  it('pide /version.json de verdad, sin caché y con parámetro variable', async () => {
    const pedidos: Array<[string, RequestInit | undefined]> = []
    vi.stubGlobal('fetch', async (url: string, opciones?: RequestInit) => {
      pedidos.push([url, opciones])
      return new Response(JSON.stringify({ version: 'abc1234' }), { status: 200 })
    })
    const registro = registroFalso()
    anotarRegistro(registro)
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')
    await tocar(await esperar(() => control(/^Buscar actualización/), 'la fila de buscar'))

    const consulta = pedidos.find(([url]) => url.startsWith('/version.json'))
    expect(consulta).toBeDefined()
    expect(consulta?.[0]).toMatch(/\/version\.json\?t=\d+/)
    expect(consulta?.[1]?.cache).toBe('no-store')
    // Y ademas llamo a update() del registro: no se queda en el texto.
    expect(registro.llamadas).toBeGreaterThanOrEqual(1)
  })

  it('con el servidor anunciando otra versión, avisa aunque el worker calle', async () => {
    // Este aparato lleva la abc1234 y el servidor anuncia la otra1234:
    // aunque el service worker no diga nada (su script puede venir de la
    // caché del navegador), la app se entera igual.
    reiniciarActualizacion({ versionInstalada: 'abc1234' })
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ version: 'otra1234' }), { status: 200 }),
    )
    anotarRegistro(registroFalso())
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')
    await tocar(await esperar(() => control(/^Buscar actualización/), 'la fila de buscar'))
    await esperar(() => textoPantalla().includes('Versión nueva disponible'), 'el aviso')
    expect(textoPantalla()).toContain('otra123')
  })

  it('sin Internet lo dice, y la app sigue funcionando', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('sin conexión')
    })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    anotarRegistro(registroFalso())
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')
    await tocar(await esperar(() => control(/^Buscar actualización/), 'la fila de buscar'))
    await esperar(
      () => textoPantalla().includes('Sin conexión. Inténtalo cuando recuperes Internet'),
      'el aviso de sin conexión',
    )
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('enseña el diagnóstico: versión, estado del worker y última comprobación', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ version: 'desarrollo' }), { status: 200 }),
    )
    anotarRegistro(registroFalso())
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')
    await tocar(await esperar(() => control(/^Buscar actualización/), 'la fila de buscar'))
    await esperar(() => textoPantalla().includes('Última comprobación'), 'el diagnóstico')
    const texto = textoPantalla()
    expect(texto).toContain('Instalada')
    expect(texto).toContain('En el servidor')
    expect(texto).toContain('Service worker')
  })

  it('muestra la versión instalada ("desarrollo" fuera de Vercel)', async () => {
    anotarRegistro(registroFalso())
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')
    expect(textoPantalla()).toContain('desarrollo')
  })

  it('sin service worker lo dice en vez de dejar el botón mudo', async () => {
    await montar([{ ruta: '/', elemento: <BuscarActualizacion /> }], '/')
    await tocar(await esperar(() => control(/^Buscar actualización/), 'la fila de buscar'))
    await esperar(
      () => textoPantalla().includes('no guarda la app para trabajar sin señal'),
      'la respuesta sin service worker',
    )
  })
})

describe('el aviso y el botón "Actualizar"', () => {
  it('aparece cuando hay versión nueva y desaparece cuando no', async () => {
    const montaje = await montar(
      [{ ruta: '/', elemento: <AvisoActualizacion visible={false} onActualizar={async () => {}} /> }],
      '/',
    )
    expect(textoPantalla()).not.toContain('Versión nueva disponible')
    await montaje.desmontar()

    await montar(
      [{ ruta: '/', elemento: <AvisoActualizacion visible onActualizar={async () => {}} /> }],
      '/',
    )
    expect(textoPantalla()).toContain('Versión nueva disponible')
    expect(control('Actualizar')).not.toBeNull()
  })

  it('al tocarlo responde: se pone en "Actualizando..." y llama a la activación', async () => {
    const activar = vi.fn(async () => {})
    await montar([{ ruta: '/', elemento: <AvisoActualizacion visible onActualizar={activar} /> }], '/')

    await tocar(await esperar(() => control('Actualizar'), 'el botón de actualizar'))
    expect(activar).toHaveBeenCalledTimes(1)
    expect(textoPantalla()).toContain('Actualizando...')
  })
})

describe('activarYRecargar', () => {
  function servicioFalso() {
    const oyentes: Array<() => void> = []
    return {
      oyentes,
      addEventListener: (_tipo: string, fn: EventListenerOrEventListenerObject) =>
        oyentes.push(fn as () => void),
    }
  }

  it('recarga en cuanto el worker nuevo toma el control', async () => {
    const recargar = vi.fn()
    const servicio = servicioFalso()
    await activarYRecargar(async () => {}, { recargar, servicio, programar: () => 0 })
    expect(recargar).not.toHaveBeenCalled()
    servicio.oyentes[0]()
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('recarga igual si no había ningún worker esperando (el botón nunca queda mudo)', async () => {
    const recargar = vi.fn()
    const pendientes: Array<() => void> = []
    await activarYRecargar(async () => {}, {
      recargar,
      servicio: servicioFalso(),
      programar: (fn) => {
        pendientes.push(fn)
        return 0
      },
    })
    expect(recargar).not.toHaveBeenCalled()
    pendientes.forEach((fn) => fn())
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('recarga aunque la activación falle', async () => {
    const recargar = vi.fn()
    await activarYRecargar(() => Promise.reject(new Error('sin worker')), {
      recargar,
      servicio: servicioFalso(),
      programar: () => 0,
    })
    expect(recargar).toHaveBeenCalledTimes(1)
  })

  it('recarga UNA sola vez aunque lleguen los dos caminos', async () => {
    const recargar = vi.fn()
    const servicio = servicioFalso()
    const pendientes: Array<() => void> = []
    await activarYRecargar(async () => {}, {
      recargar,
      servicio,
      programar: (fn) => {
        pendientes.push(fn)
        return 0
      },
    })
    servicio.oyentes[0]()
    pendientes.forEach((fn) => fn())
    expect(recargar).toHaveBeenCalledTimes(1)
  })
})

describe('actualizar no toca los datos del técnico', () => {
  it('ni la base local, ni la sesión, ni el avance de una guía', async () => {
    await limpiarBase()
    await sembrarPerfil(true)
    await sembrarGuia({
      id: 'guia-1',
      titulo: 'Guía de ejemplo',
      pasos: [pasoPrueba('g1-p1', 'Un paso', ['Hacer algo'])],
    })
    await db.progresoPasos.put({
      articuloId: 'guia-1',
      pasosHechos: ['g1-p1'],
      instruccionesHechas: [],
      verificacionHecha: [],
      actualizadoEn: '2026-09-20T12:00:00.000Z',
    })
    localStorage.setItem('sesion_de_prueba', 'intacta')

    anotarRegistro(registroFalso(true))
    anotarVersionNueva(true)
    await comprobarActualizacion(true)
    await activarYRecargar(async () => {}, {
      recargar: () => {},
      servicio: null,
      programar: () => 0,
    })

    // Una actualización cambia los archivos de la app y nada más.
    expect(await db.perfiles.count()).toBe(1)
    expect(await db.articulos.count()).toBe(1)
    expect((await db.progresoPasos.get('guia-1'))?.pasosHechos).toEqual(['g1-p1'])
    expect(localStorage.getItem('sesion_de_prueba')).toBe('intacta')
  })
})
