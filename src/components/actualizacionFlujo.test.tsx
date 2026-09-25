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
import { guardarModoEjecucion } from '../lib/preferenciasEjecucion'
import { Chasis } from '../app/Chasis'
import { GuiaPage } from '../features/soluciones/GuiaPage'
import { AvisoActualizacion } from './AvisoActualizacion'
import { BuscarActualizacion } from './BuscarActualizacion'
import { huecoAvisoActualizacion } from './ranuraAvisoActualizacion'

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

// UNA VERSIÓN NUEVA NUNCA IMPIDE TRABAJAR EN UNA GUÍA (tarea 273). La
// pastilla flotaba a 80 px del borde, justo encima de la barra de acciones
// de la guía (Anterior, Siguiente, Falla, el índice...). Con una guía en
// curso, el aviso va dentro de esa barra y en su flujo, antes de los
// botones; fuera de una guía sigue siendo la pastilla de siempre.
describe('con una guía en curso, el aviso no tapa sus controles', () => {
  const RUTA_GUIA = '/soluciones/cat-pruebas/guia-aviso'
  const RUTAS_GUIA = [{ ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> }]
  const ANTERIOR_FOCO = /^Anterior\. Solo mueve la vista/
  const ANTERIOR_PASO_ENTERO = /^Ver el paso anterior\./

  beforeEach(async () => {
    await limpiarBase()
    await sembrarPerfil(false)
    await sembrarGuia({
      id: 'guia-aviso',
      titulo: 'Guía de prueba con aviso',
      pasos: [
        pasoPrueba('ga-p1', 'Primer paso de prueba', ['Abrir el programa de prueba', 'Entrar en la sección de prueba']),
        pasoPrueba('ga-p2', 'Segundo paso de prueba', ['Guardar la prueba']),
      ],
    })
  })

  // Como lo monta la app: en la raíz, fuera de la guía.
  function montarAviso(onActualizar: () => Promise<void> = async () => {}) {
    return montar([{ ruta: '*', elemento: <AvisoActualizacion visible onActualizar={onActualizar} /> }], '/')
  }

  function textoAviso(): HTMLElement | null {
    return Array.from(document.body.querySelectorAll('p')).find((p) => p.textContent === 'Versión nueva disponible') ?? null
  }

  /** La barra pegajosa del pie de la guía: la que lleva "Anterior". */
  function barraDeLaGuia(anterior: RegExp): HTMLElement | null {
    return control(anterior)?.closest<HTMLElement>('.sticky') ?? null
  }

  /** El aviso va antes que el control en el documento, no encima. */
  function vaAntesQue(aviso: HTMLElement, otro: HTMLElement): boolean {
    return Boolean(aviso.compareDocumentPosition(otro) & Node.DOCUMENT_POSITION_FOLLOWING)
  }

  /** El botón de la barra con ese nombre (la cabecera repite alguno). */
  function botonDeLaBarra(barra: HTMLElement, nombre: RegExp): HTMLElement | null {
    return (
      Array.from(barra.querySelectorAll<HTMLElement>('button')).find((boton) =>
        nombre.test((boton.getAttribute('aria-label') ?? boton.textContent ?? '').replace(/\s+/g, ' ').trim()),
      ) ?? null
    )
  }

  it('una tarea a la vez: va dentro de la barra, antes de sus botones, y no flota', async () => {
    await montar(RUTAS_GUIA, RUTA_GUIA)
    await montarAviso()

    const barra = await esperar(() => barraDeLaGuia(ANTERIOR_FOCO), 'la barra de la guía')
    const aviso = await esperar(textoAviso, 'el aviso')
    expect(barra.contains(aviso)).toBe(true)
    expect(aviso.closest('.fixed')).toBeNull()
    for (const nombre of [ANTERIOR_FOCO, /^Siguiente$/, /^Tengo un problema con esta acción/]) {
      const boton = botonDeLaBarra(barra, nombre)
      expect(boton, String(nombre)).not.toBeNull()
      expect(vaAntesQue(aviso, boton!)).toBe(true)
    }
  })

  it('vista del paso entero: igual, antes de Anterior, el índice, Falla y Siguiente', async () => {
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS_GUIA, RUTA_GUIA)
    await montarAviso()

    const barra = await esperar(() => barraDeLaGuia(ANTERIOR_PASO_ENTERO), 'la barra del paso entero')
    const aviso = await esperar(textoAviso, 'el aviso')
    expect(barra.contains(aviso)).toBe(true)
    expect(aviso.closest('.fixed')).toBeNull()
    for (const nombre of [ANTERIOR_PASO_ENTERO, /Abrir el índice de pasos$/, /^Algo va mal en el paso/, /^Ver el paso siguiente\./]) {
      const boton = botonDeLaBarra(barra, nombre)
      expect(boton, String(nombre)).not.toBeNull()
      expect(vaAntesQue(aviso, boton!)).toBe(true)
    }
  })

  it('se sigue trabajando con el aviso puesto, y se actualiza solo cuando uno quiere', async () => {
    const activar = vi.fn(async () => {})
    await montar(RUTAS_GUIA, RUTA_GUIA)
    await montarAviso(activar)
    await esperar(textoAviso, 'el aviso')

    await tocar(await esperar(() => control(/^Siguiente$/), 'Siguiente'))
    await esperar(() => textoPantalla().includes('Entrar en la sección de prueba'), 'la acción 2')
    expect(activar).not.toHaveBeenCalled()
    expect(textoAviso()).not.toBeNull()

    await tocar(await esperar(() => control('Actualizar'), 'el botón de actualizar'))
    expect(activar).toHaveBeenCalledTimes(1)
    expect(textoPantalla()).toContain('Actualizando...')
  })

  it('sin aviso, el hueco no pinta nada y la barra queda como siempre', async () => {
    await montar(RUTAS_GUIA, RUTA_GUIA)

    const barra = await esperar(() => barraDeLaGuia(ANTERIOR_FOCO), 'la barra de la guía')
    const hueco = barra.firstElementChild
    expect(hueco?.className).toContain('empty:hidden')
    expect(hueco?.childNodes.length).toBe(0)
    expect(textoAviso()).toBeNull()
  })

  it('al salir de la guía, y fuera de ella, es la pastilla flotante de siempre', async () => {
    const guia = await montar(RUTAS_GUIA, RUTA_GUIA)
    await montarAviso()
    await esperar(() => textoAviso()?.closest('.sticky'), 'el aviso dentro de la barra')

    await guia.desmontar()
    const flotante = await esperar(() => textoAviso()?.closest<HTMLElement>('.fixed'), 'el aviso flotante')
    expect(flotante.className).toContain('bottom-20')
  })
})

// FUERA DE UNA GUÍA, LA FRANJA DEL CHASIS (tarea 274). La pastilla flotaba
// sobre el contenido y, al final de Resolver, tapaba los accesos rápidos.
// En una pantalla con pestañas el aviso va en una franja pegajosa del
// chasis, en el flujo y detrás de lo último de la pantalla; una barra de
// acciones de la pantalla que publique su hueco (la de una guía, la de la
// ficha de un equipo) manda sobre ella.
describe('fuera de una guía, el aviso va en la franja del chasis', () => {
  function PantallaNormal() {
    return (
      <Chasis titulo="Pantalla de prueba">
        <p>Contenido de prueba</p>
        <button type="button">Acceso rápido de prueba</button>
      </Chasis>
    )
  }

  // Como la ficha de un equipo: una barra propia que publica su hueco.
  function PantallaConBarra() {
    return (
      <Chasis modo="documento" titulo="Ficha de prueba">
        <p>Ficha de prueba</p>
        <div data-barra-de-prueba>
          <div ref={huecoAvisoActualizacion} className="mb-2 empty:hidden" />
          <button type="button">Acción de la ficha de prueba</button>
        </div>
      </Chasis>
    )
  }

  beforeEach(async () => {
    await limpiarBase()
    await sembrarPerfil(false)
  })

  function montarAviso() {
    return montar([{ ruta: '*', elemento: <AvisoActualizacion visible onActualizar={async () => {}} /> }], '/')
  }

  function textoAviso(): HTMLElement | null {
    return Array.from(document.body.querySelectorAll('p')).find((p) => p.textContent === 'Versión nueva disponible') ?? null
  }

  /** La franja: lo último de la columna de contenido del chasis. */
  function franja(): HTMLElement | null {
    return (
      Array.from(document.body.querySelectorAll<HTMLElement>('[data-transicion] > .sticky')).find((el) =>
        el.className.includes('empty:hidden'),
      ) ?? null
    )
  }

  it('en una pantalla con pestañas va en la franja, detrás de lo último, y no flota', async () => {
    await montar([{ ruta: '/prueba', elemento: <PantallaNormal /> }], '/prueba')
    await montarAviso()

    const aviso = await esperar(textoAviso, 'el aviso')
    const laFranja = franja()
    expect(laFranja?.contains(aviso)).toBe(true)
    expect(aviso.closest('.fixed')).toBeNull()
    expect(laFranja?.parentElement?.lastElementChild).toBe(laFranja)
    // En el flujo y detrás del contenido: el acceso rápido va antes y fuera.
    const acceso = control('Acceso rápido de prueba')!
    expect(acceso.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(laFranja?.contains(acceso)).toBe(false)
  })

  it('sin aviso, la franja no pinta nada', async () => {
    await montar([{ ruta: '/prueba', elemento: <PantallaNormal /> }], '/prueba')

    const laFranja = await esperar(franja, 'la franja del chasis')
    expect(laFranja.childNodes.length).toBe(0)
    expect(textoAviso()).toBeNull()
  })

  it('una barra de acciones de la pantalla manda: el aviso va en ella y la franja queda vacía', async () => {
    await montar([{ ruta: '/prueba', elemento: <PantallaConBarra /> }], '/prueba')
    await montarAviso()

    const aviso = await esperar(textoAviso, 'el aviso')
    expect(aviso.closest('[data-barra-de-prueba]')).not.toBeNull()
    expect(franja()?.childNodes.length).toBe(0)
  })

  it('con una guía en curso manda la barra de la guía, no la franja (tarea 273)', async () => {
    await sembrarGuia({
      id: 'guia-franja',
      titulo: 'Guía de prueba con franja',
      pasos: [pasoPrueba('gf-p1', 'Paso de prueba', ['Hacer la prueba'])],
    })
    // La guía se monta ANTES que la franja: gana por rango, no por llegar
    // la última.
    await montar([{ ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> }], '/soluciones/cat-pruebas/guia-franja')
    const barraGuia = await esperar(
      () => control(/^Anterior\. Solo mueve la vista/)?.closest<HTMLElement>('.sticky'),
      'la barra de la guía',
    )
    await montar([{ ruta: '/prueba', elemento: <PantallaNormal /> }], '/prueba')
    await esperar(franja, 'la franja del chasis')
    await montarAviso()

    const aviso = await esperar(textoAviso, 'el aviso')
    expect(barraGuia.contains(aviso)).toBe(true)
    expect(franja()?.childNodes.length).toBe(0)
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
