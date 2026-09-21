// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activarYRecargar,
  adoptarRegistroExistente,
  anotarRegistro,
  anotarVersionNueva,
  comprobarActualizacion,
  debeComprobar,
  estadoActualizacion,
  hayActualizacionEsperando,
  hayIntervaloVivo,
  hayVersionDistinta,
  instalarOyentes,
  MENSAJE_SALTAR_ESPERA,
  observarRegistro,
  simularCambioDeControlador,
  MIN_ENTRE_COMPROBACIONES_MS,
  reiniciarActualizacion,
  suscribirActualizacion,
  type RegistroActualizable,
} from './actualizacionApp'

// COMPROBAR SI HAY VERSIÓN NUEVA (encargo del 2026-09-20).
//
// El defecto que se cierra: la única comprobación programada era un
// `setInterval` de una hora, así que un teléfono que abre la PWA diez
// minutos nunca llegaba a preguntar y se quedaba con los archivos
// viejos aunque Vercel ya hubiera desplegado.
//
// Aquí se prueba el módulo que decide CUÁNDO se pregunta. No hay service
// worker de verdad: se inyecta un registro falso que cuenta llamadas.

let ahora = 1_000_000

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
  ahora = 1_000_000
  reiniciarActualizacion({ ahora: () => ahora })
  // `/version.json` no existe en las pruebas de este modulo: se responde
  // 404 para que `consultarVersionRemota` devuelva null sin salir a la
  // red (happy-dom intentaria conectarse de verdad). El caso "el
  // servidor SI anuncia otra version" se prueba aparte, mas abajo.
  vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
})

afterEach(() => {
  reiniciarActualizacion()
  vi.restoreAllMocks()
})

describe('debeComprobar', () => {
  it('la primera vez siempre se comprueba', () => {
    expect(debeComprobar(0, ahora)).toBe(true)
  })

  it('no se repite antes del minuto', () => {
    expect(debeComprobar(ahora, ahora + 5_000)).toBe(false)
    expect(debeComprobar(ahora, ahora + MIN_ENTRE_COMPROBACIONES_MS)).toBe(true)
  })

  it('a mano se comprueba aunque acabe de hacerse', () => {
    expect(debeComprobar(ahora, ahora + 1, true)).toBe(true)
  })
})

describe('al registrar el service worker', () => {
  it('comprueba YA, sin esperar la hora', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(1))
    expect(hayIntervaloVivo()).toBe(true)
  })

  it('registrar dos veces no deja dos intervalos ni dos juegos de oyentes', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(1))
    expect(hayIntervaloVivo()).toBe(true)

    // Un segundo montaje del componente: la comprobación forzada vuelve
    // a correr (es barata y es al abrir), pero no se duplica nada.
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(2))
    expect(hayIntervaloVivo()).toBe(true)

    // Y un solo oyente por evento: dos eventos seguidos con el freno
    // vencido dan una comprobación cada uno, no dos.
    ahora += MIN_ENTRE_COMPROBACIONES_MS
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(registro.llamadas).toBe(3))
  })
})

describe('volver a la app y recuperar la conexión', () => {
  it('comprueba al volver a estar visible', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(1))

    ahora += MIN_ENTRE_COMPROBACIONES_MS
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(registro.llamadas).toBe(2))
  })

  it('comprueba al recuperar la conexión', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(1))

    ahora += MIN_ENTRE_COMPROBACIONES_MS
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(registro.llamadas).toBe(2))
  })

  it('no dispara una consulta por cada vaivén: el freno manda', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(1))

    // Cinco idas y venidas en el mismo minuto.
    for (let i = 0; i < 5; i++) {
      ahora += 2_000
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('online'))
    }
    await new Promise((r) => setTimeout(r, 20))
    expect(registro.llamadas).toBe(1)

    // Pasado el minuto, la siguiente sí.
    ahora += MIN_ENTRE_COMPROBACIONES_MS
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(registro.llamadas).toBe(2))
  })

  it('instalarOyentes no duplica escuchas aunque se llame varias veces', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(1))
    instalarOyentes()
    instalarOyentes()

    ahora += MIN_ENTRE_COMPROBACIONES_MS
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(registro.llamadas).toBe(2))
    await new Promise((r) => setTimeout(r, 20))
    expect(registro.llamadas).toBe(2)
  })
})

describe('el resultado de comprobar', () => {
  it('sin versión nueva dice que está al día', async () => {
    anotarRegistro(registroFalso())
    expect(await comprobarActualizacion(true)).toBe('al-dia')
    expect(estadoActualizacion().fase).toBe('al-dia')
  })

  it('con un worker en espera dice que hay versión disponible', async () => {
    anotarRegistro(registroFalso(true))
    expect(await comprobarActualizacion(true)).toBe('disponible')
  })

  it('lo que anuncia la librería también cuenta como disponible', async () => {
    anotarRegistro(registroFalso())
    anotarVersionNueva(true)
    expect(hayActualizacionEsperando()).toBe(true)
    expect(await comprobarActualizacion(true)).toBe('disponible')
  })

  it('sin service worker lo dice, en vez de fallar', async () => {
    expect(await comprobarActualizacion(true)).toBe('sin-servicio')
  })

  it('un fallo de red no rompe nada: se responde igual', async () => {
    const roto: RegistroActualizable = {
      update: () => Promise.reject(new Error('sin conexión')),
    }
    anotarRegistro(roto)
    expect(await comprobarActualizacion(true)).toBe('al-dia')
  })

  it('avisa a quien esté suscrito, pasando por "buscando"', async () => {
    const fases: string[] = []
    anotarRegistro(registroFalso())
    suscribirActualizacion(() => fases.push(estadoActualizacion().fase))
    await comprobarActualizacion(true)
    expect(fases).toContain('buscando')
    expect(fases.at(-1)).toBe('al-dia')
  })
})

describe('lo que la actualización NUNCA hace', () => {
  it('no recarga la página por su cuenta', async () => {
    const recargar = vi.fn()
    const original = window.location.reload
    Object.defineProperty(window.location, 'reload', { configurable: true, value: recargar })

    anotarRegistro(registroFalso(true))
    await comprobarActualizacion(true)
    ahora += MIN_ENTRE_COMPROBACIONES_MS
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 30))

    // Ni en mitad de una guía ni en ningún otro momento: recargar es
    // cosa del botón "Actualizar", y solo si el técnico lo toca.
    expect(recargar).not.toHaveBeenCalled()
    Object.defineProperty(window.location, 'reload', { configurable: true, value: original })
  })

  it('no toca el almacenamiento local: solo llama a update()', async () => {
    const registro = registroFalso()
    localStorage.setItem('dato_del_tecnico', 'sigue aquí')
    anotarRegistro(registro)
    await comprobarActualizacion(true)
    expect(localStorage.getItem('dato_del_tecnico')).toBe('sigue aquí')
    // La única operación que el módulo hace sobre el service worker.
    expect(Object.keys(registro).filter((k) => k === 'update')).toEqual(['update'])
  })
})

// ----------------------------------------------------------------
// TODOS LOS ESTADOS DEL SERVICE WORKER (encargo del 2026-09-21, punto 2)
// ----------------------------------------------------------------
//
// `needRefresh` de la librería solo se enciende si el evento llega a
// ESTA ventana. Una PWA instalada puede abrirse con un worker ya en
// espera, o con uno instalándose: en los dos casos el aviso tiene que
// salir igual.

interface TrabajadorFalso {
  state: string
  addEventListener: (tipo: string, fn: () => void) => void
  pasarA: (estado: string) => void
}

/** Un worker de mentira con su `statechange`, como el del navegador. */
function trabajadorFalso(estadoInicial = 'installing'): TrabajadorFalso {
  const oyentes: Array<() => void> = []
  return {
    state: estadoInicial,
    addEventListener: (_tipo: string, fn: () => void) => {
      oyentes.push(fn)
    },
    pasarA(estado: string) {
      this.state = estado
      for (const fn of oyentes) fn()
    },
  }
}

interface RegistroConEventos extends RegistroActualizable {
  emitir: (tipo: string) => void
  addEventListener: (tipo: string, fn: () => void) => void
  installing?: unknown
}

function registroConEventos(inicial: Partial<RegistroActualizable> = {}): RegistroConEventos {
  const oyentes = new Map<string, Array<() => void>>()
  return {
    ...inicial,
    update: async () => {},
    addEventListener(tipo: string, fn: () => void) {
      const lista = oyentes.get(tipo) ?? []
      lista.push(fn)
      oyentes.set(tipo, lista)
    },
    emitir(tipo: string) {
      for (const fn of oyentes.get(tipo) ?? []) fn()
    },
  }
}

/** Finge que esta ventana ya la controla un worker (app instalada). */
function conControlador(hay: boolean): void {
  // happy-dom no trae `navigator.serviceWorker`: se finge entero.
  const servicio = (navigator as unknown as { serviceWorker?: Record<string, unknown> }).serviceWorker ?? {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  servicio.controller = hay ? {} : null
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: servicio })
}

describe('estados del service worker', () => {
  it('un worker YA en espera al abrir enseña el aviso de inmediato', () => {
    observarRegistro({ update: async () => {}, waiting: {}, active: {} })
    expect(hayActualizacionEsperando()).toBe(true)
    expect(estadoActualizacion().estadoWorker).toBe('esperando')
  })

  it('uno instalándose espera a "installed" y entonces avisa', () => {
    const sw = trabajadorFalso('installing')
    conControlador(true)
    observarRegistro({ update: async () => {}, installing: sw, active: {} })
    expect(estadoActualizacion().estadoWorker).toBe('instalando')
    expect(hayActualizacionEsperando()).toBe(false)

    sw.pasarA('installed')
    expect(hayActualizacionEsperando()).toBe(true)
    expect(estadoActualizacion().estadoWorker).toBe('esperando')
    conControlador(false)
  })

  it('la PRIMERA instalación (sin controlador) no avisa de nada', () => {
    const sw = trabajadorFalso('installing')
    conControlador(false)
    observarRegistro({ update: async () => {}, installing: sw })
    sw.pasarA('installed')
    expect(hayActualizacionEsperando()).toBe(false)
  })

  it('sigue un "updatefound" posterior', () => {
    conControlador(true)
    const sw = trabajadorFalso('installing')
    const reg = registroConEventos({ active: {} })
    observarRegistro(reg)
    expect(estadoActualizacion().estadoWorker).toBe('activo')

    reg.installing = sw
    reg.emitir('updatefound')
    expect(estadoActualizacion().estadoWorker).toBe('instalando')
    sw.pasarA('installed')
    expect(hayActualizacionEsperando()).toBe(true)
    conControlador(false)
  })

  it('observar dos veces el mismo registro no duplica oyentes', () => {
    conControlador(true)
    const reg = registroConEventos({ active: {} })
    observarRegistro(reg)
    observarRegistro(reg)
    const sw = trabajadorFalso('installing')
    reg.installing = sw
    reg.emitir('updatefound')
    // Con oyentes duplicados, `pasarA` avisaría dos veces y el estado
    // seguiría siendo el mismo; lo que se comprueba es que el registro
    // solo tiene UN oyente de 'updatefound' (si hubiera dos, el segundo
    // volvería a enganchar el mismo worker y `statechange` se contaría
    // dos veces).
    let avisos = 0
    reg.addEventListener('updatefound', () => {
      avisos += 1
    })
    reg.emitir('updatefound')
    expect(avisos).toBe(1)
    conControlador(false)
  })

  it('adopta el registro que ya existía en el navegador', async () => {
    const reg = { update: async () => {}, waiting: {}, active: {} }
    await adoptarRegistroExistente({
      getRegistration: async () => reg as unknown as ServiceWorkerRegistration,
    })
    expect(hayActualizacionEsperando()).toBe(true)
    expect(hayIntervaloVivo()).toBe(true)
  })

  it('sin service worker en el navegador no falla', async () => {
    await adoptarRegistroExistente(null)
    expect(estadoActualizacion().estadoWorker).toBe('sin-worker')
  })
})

describe('controllerchange', () => {
  it('sin que nadie lo pida NO recarga: enseña el aviso', () => {
    const recargar = vi.fn()
    reiniciarActualizacion({ ahora: () => ahora, recargar })
    simularCambioDeControlador()
    expect(recargar).not.toHaveBeenCalled()
    expect(hayActualizacionEsperando()).toBe(true)
  })

  it('no entra en bucle: tras activar, la recarga es una sola', async () => {
    const recargar = vi.fn()
    reiniciarActualizacion({ ahora: () => ahora, recargar })
    await activarYRecargar(async () => {}, {
      recargar,
      servicio: null,
      programar: () => 0,
      enEspera: null,
    })
    // Dos cambios de controlador seguidos: una sola recarga.
    simularCambioDeControlador()
    simularCambioDeControlador()
    expect(recargar).toHaveBeenCalledTimes(1)
  })
})

describe('SKIP_WAITING', () => {
  it('se le manda al worker en espera, sin depender de la librería', async () => {
    const enEspera = { postMessage: vi.fn() }
    await activarYRecargar(async () => {}, {
      recargar: () => {},
      servicio: null,
      programar: () => 0,
      enEspera,
    })
    expect(enEspera.postMessage).toHaveBeenCalledWith({ type: MENSAJE_SALTAR_ESPERA })
  })

  it('un worker que ya no responde no rompe la activación', async () => {
    const recargar = vi.fn()
    await activarYRecargar(async () => {}, {
      recargar,
      servicio: null,
      programar: (fn) => {
        fn()
        return 0
      },
      enEspera: {
        postMessage: () => {
          throw new Error('worker muerto')
        },
      },
    })
    expect(recargar).toHaveBeenCalledTimes(1)
  })
})

describe('hayVersionDistinta', () => {
  it('compara dos commits', () => {
    expect(hayVersionDistinta('abc1234', 'def5678')).toBe(true)
    expect(hayVersionDistinta('abc1234', 'abc1234')).toBe(false)
  })

  it('sin dato remoto no afirma nada, y en desarrollo no compara', () => {
    expect(hayVersionDistinta('abc1234', null)).toBe(false)
    expect(hayVersionDistinta('desarrollo', 'abc1234')).toBe(false)
    expect(hayVersionDistinta('abc1234', 'desarrollo')).toBe(false)
  })
})

describe('la ventana recupera el foco', () => {
  it('también comprueba', async () => {
    const registro = registroFalso()
    anotarRegistro(registro)
    await vi.waitFor(() => expect(registro.llamadas).toBe(1))

    ahora += MIN_ENTRE_COMPROBACIONES_MS
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(registro.llamadas).toBe(2))
  })
})
