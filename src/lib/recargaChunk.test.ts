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
// precacheado cuyos trozos ya no existian.
describe('reinstalarYRecargar', () => {
  const reload = vi.fn()
  let registros: { unregister: ReturnType<typeof vi.fn> }[]
  let cachesBorradas: string[]

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
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: () => Promise.resolve(registros) } })
    vi.stubGlobal('caches', (window as unknown as { caches: unknown }).caches)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('da de baja los service workers, borra las caches y recarga', async () => {
    const { reinstalarYRecargar } = await import('./recargaChunk')
    expect(await reinstalarYRecargar()).toBe(true)
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
    expect(await reinstalarYRecargar()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('recarga igual aunque no haya service worker ni Cache Storage que limpiar', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('caches', undefined)
    vi.stubGlobal('window', { location: { reload } })
    // sessionStorage sigue en pie desde beforeEach: lo que se prueba es
    // que la ausencia de service worker y de caches no frene la recarga.
    const { reinstalarYRecargar } = await import('./recargaChunk')
    expect(await reinstalarYRecargar()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
