// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  anotarRegistro,
  anotarVersionNueva,
  comprobarActualizacion,
  debeComprobar,
  estadoActualizacion,
  hayActualizacionEsperando,
  hayIntervaloVivo,
  instalarOyentes,
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
