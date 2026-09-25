// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

// UN TROZO QUE NO CARGA, CON Y SIN RED (tarea 259).
//
// Desde la 259, Importar y Etiquetas no vienen en el precache. Abrirlas
// sin conexion antes de su primer uso hace fallar el import dinamico con
// el mismo mensaje que una version vieja, pero el remedio no puede ser el
// mismo: reinstalar tiraria el service worker y las caches sin poder
// volver a bajarlos. Aqui se monta el limite de verdad y se simula lo que
// hace React.lazy cuando el import falla.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function TrozoQueNoCarga(): never {
  throw new TypeError('Failed to fetch dynamically imported module: https://app/assets/ImportarDispositivosPage-abc.js')
}

function OtroError(): never {
  throw new Error('La bóveda está bloqueada.')
}

let contenedor: HTMLDivElement
let raiz: Root
let reload: ReturnType<typeof vi.spyOn>
let assign: ReturnType<typeof vi.spyOn>
let unregister: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

function red(conectado: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(conectado)
}

async function montar(hijo: React.ReactNode) {
  await act(async () => {
    raiz.render(<ErrorBoundary>{hijo}</ErrorBoundary>)
  })
  // Deja correr la cadena de promesas de componentDidCatch.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0))
    })
  }
}

beforeEach(() => {
  sessionStorage.clear()
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
  reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
  assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  unregister = vi.fn().mockResolvedValue(true)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistrations: () => Promise.resolve([{ unregister }]) },
  })
  fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => raiz.unmount())
  contenedor.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ErrorBoundary ante un trozo que no carga', () => {
  it('sin red dice «Sin conexión» de entrada, y no recarga ni reinstala', async () => {
    red(false)
    await montar(<TrozoQueNoCarga />)
    expect(contenedor.textContent).toContain('Sin conexión')
    expect(contenedor.textContent).toContain('se descarga la primera vez que se abre con conexión')
    expect(reload).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(unregister).not.toHaveBeenCalled()
  })

  it('con red pero sin servidor, ya hecha la recarga, tampoco borra nada', async () => {
    red(true)
    sessionStorage.setItem('recarga-por-chunk', String(Date.now()))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await montar(<TrozoQueNoCarga />)
    expect(contenedor.textContent).toContain('Sin conexión')
    expect(reload).not.toHaveBeenCalled()
    expect(unregister).not.toHaveBeenCalled()
  })

  it('con servidor, ya hecha la recarga, reinstala como antes (instalación rota)', async () => {
    red(true)
    sessionStorage.setItem('recarga-por-chunk', String(Date.now()))
    await montar(<TrozoQueNoCarga />)
    expect(unregister).toHaveBeenCalled()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(contenedor.textContent).toContain('Actualizando la aplicación')
  })

  it('con red, el primer fallo recarga una vez (versión vieja en memoria)', async () => {
    red(true)
    await montar(<TrozoQueNoCarga />)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(unregister).not.toHaveBeenCalled()
  })

  it('al volver la red, la pantalla «Sin conexión» se recarga sola', async () => {
    red(false)
    await montar(<TrozoQueNoCarga />)
    expect(reload).not.toHaveBeenCalled()
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('«Ir a Resolver» abre la raíz, que el service worker sirve sin red', async () => {
    red(false)
    await montar(<TrozoQueNoCarga />)
    const boton = [...contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Ir a Resolver')
    expect(boton).toBeDefined()
    await act(async () => {
      boton!.click()
    })
    expect(assign).toHaveBeenCalledWith('/')
  })

  it('un error que no es de trozo sigue en «No se pudo cargar la aplicación», sin recargar', async () => {
    red(true)
    await montar(<OtroError />)
    expect(contenedor.textContent).toContain('No se pudo cargar la aplicación')
    expect(reload).not.toHaveBeenCalled()
  })
})
