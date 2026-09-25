import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esErrorDeChunk } from './recargaChunk'

describe('esErrorDeChunk', () => {
  it('reconoce los mensajes de import dinámico fallido de cada navegador', () => {
    const mensajes = [
      'Failed to fetch dynamically imported module: https://app/assets/RedPage-abc.js',
      'error loading dynamically imported module: https://app/assets/x.js',
      'Importing a module script failed.',
      'ChunkLoadError: Loading chunk 5 failed.',
    ]
    for (const mensaje of mensajes) {
      expect(esErrorDeChunk(new Error(mensaje))).toBe(true)
    }
  })

  it('no confunde otros errores de la app con un fallo de chunk', () => {
    expect(esErrorDeChunk(new Error('La bóveda está bloqueada.'))).toBe(false)
    expect(esErrorDeChunk(new Error('Sin conexión con el servidor'))).toBe(false)
    expect(esErrorDeChunk(new Error('Failed to fetch'))).toBe(false)
    expect(esErrorDeChunk(null)).toBe(false)
    expect(esErrorDeChunk(undefined)).toBe(false)
  })
})

// Recuperacion de la instalacion rota (2026-09-04). El equipo reporto un
// bucle: "No se pudo cargar la aplicacion" y el boton "Recargar" volvia a
// mostrar lo mismo, porque el service worker servia un index.html
// precacheado cuyos trozos ya no existian. Desde la tarea 259, ademas, no
// se reinstala si el servidor no responde: sin el, la app no se podria
// volver a bajar.
describe('reinstalarYRecargar', () => {
  const reload = vi.fn()
  let registros: { unregister: ReturnType<typeof vi.fn> }[]
  let cachesBorradas: string[]
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    reload.mockClear()
    registros = [{ unregister: vi.fn().mockResolvedValue(true) }, { unregister: vi.fn().mockResolvedValue(true) }]
    cachesBorradas = []
    const guardado = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
    })
    vi.stubGlobal('window', {
      location: { reload },
      caches: {
        keys: () => Promise.resolve(['workbox-precache-v2', 'imagenes']),
        delete: (n: string) => {
          cachesBorradas.push(n)
          return Promise.resolve(true)
        },
      },
    })
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { getRegistrations: () => Promise.resolve(registros) } })
    vi.stubGlobal('caches', (window as unknown as { caches: unknown }).caches)
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('con el servidor respondiendo, da de baja los service workers, borra las caches y recarga', async () => {
    const { reinstalarYRecargar } = await import('./recargaChunk')
    expect(await reinstalarYRecargar()).toBe('reinstalando')
    expect(fetchMock).toHaveBeenCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' }))
    expect(registros[0].unregister).toHaveBeenCalled()
    expect(registros[1].unregister).toHaveBeenCalled()
    expect(cachesBorradas).toEqual(['workbox-precache-v2', 'imagenes'])
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('no reinstala dos veces seguidas: si tras reinstalar sigue fallando, el problema no es la cache', async () => {
    const { reinstalarYRecargar, yaSeIntentoReinstalar } = await import('./recargaChunk')
    await reinstalarYRecargar()
    expect(yaSeIntentoReinstalar()).toBe(true)
    reload.mockClear()
    expect(await reinstalarYRecargar()).toBe('ya_intentado')
    expect(reload).not.toHaveBeenCalled()
  })

  it('recarga igual aunque no haya service worker ni Cache Storage que limpiar', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('caches', undefined)
    vi.stubGlobal('window', { location: { reload } })
    // sessionStorage y el servidor siguen en pie desde beforeEach: lo que
    // se prueba es que la ausencia de service worker y de caches no frene
    // la recarga.
    const { reinstalarYRecargar } = await import('./recargaChunk')
    expect(await reinstalarYRecargar()).toBe('reinstalando')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('sin red no toca nada: ni service workers, ni caches, ni recarga (tarea 259)', async () => {
    vi.stubGlobal('navigator', { onLine: false, serviceWorker: { getRegistrations: () => Promise.resolve(registros) } })
    const { reinstalarYRecargar, yaSeIntentoReinstalar } = await import('./recargaChunk')
    expect(await reinstalarYRecargar()).toBe('sin_servidor')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(registros[0].unregister).not.toHaveBeenCalled()
    expect(cachesBorradas).toEqual([])
    expect(reload).not.toHaveBeenCalled()
    // Tampoco gasta el intento: con red, se podra reinstalar.
    expect(yaSeIntentoReinstalar()).toBe(false)
  })

  it('con red pero sin servidor (portal cautivo, red sin salida) tampoco toca nada', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { reinstalarYRecargar } = await import('./recargaChunk')
    expect(await reinstalarYRecargar()).toBe('sin_servidor')
    expect(registros[0].unregister).not.toHaveBeenCalled()
    expect(cachesBorradas).toEqual([])
    expect(reload).not.toHaveBeenCalled()
  })

  it('una respuesta de error de /version.json cuenta como servidor que no responde', async () => {
    fetchMock.mockResolvedValue({ ok: false })
    const { reinstalarYRecargar } = await import('./recargaChunk')
    expect(await reinstalarYRecargar()).toBe('sin_servidor')
    expect(cachesBorradas).toEqual([])
  })
})

describe('servidorResponde', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('deja de esperar a los 4 segundos: una red colgada cuenta como sin servidor', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_: string, opciones: { signal: AbortSignal }) =>
          new Promise((_, rechazar) => opciones.signal.addEventListener('abort', () => rechazar(new Error('abortado')))),
      ),
    )
    const { servidorResponde } = await import('./recargaChunk')
    const respuesta = servidorResponde()
    await vi.advanceTimersByTimeAsync(4000)
    expect(await respuesta).toBe(false)
  })
})

describe('recargarUnaVezPorChunk', () => {
  const reload = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    reload.mockClear()
    const guardado = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
    })
    vi.stubGlobal('window', { location: { reload } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recarga una sola vez: la segunda, en menos de 10 s, la decide el llamador', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const { recargarUnaVezPorChunk } = await import('./recargaChunk')
    expect(recargarUnaVezPorChunk()).toBe(true)
    expect(recargarUnaVezPorChunk()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('sin red no recarga: no hay version nueva que traer (tarea 259)', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { recargarUnaVezPorChunk } = await import('./recargaChunk')
    expect(recargarUnaVezPorChunk()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
