// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePantallaEncendida, type ServicioBloqueo } from './usePantallaEncendida'

// LA PANTALLA ENCENDIDA MIENTRAS LA GUÍA ESTÁ ABIERTA (tarea 354): se pide
// al abrir, se vuelve a pedir al volver a la app después de que el navegador
// la soltara, se suelta al salir y, si el navegador la niega, no pasa nada.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let contenedor: HTMLDivElement
let raiz: Root

function servicioFalso() {
  const soltados: number[] = []
  const oyentes: (() => void)[] = []
  let pedidos = 0
  const servicio: ServicioBloqueo = {
    request: vi.fn(async () => {
      const n = ++pedidos
      return {
        release: vi.fn(async () => {
          soltados.push(n)
        }),
        addEventListener: (_tipo: 'release', fn: () => void) => oyentes.push(fn),
      }
    }),
  }
  return { servicio, soltados, oyentes, pedidos: () => pedidos }
}

function Prueba({ activa, servicio }: { activa: boolean; servicio: ServicioBloqueo | null }) {
  usePantallaEncendida(activa, servicio)
  return null
}

async function pintar(activa: boolean, servicio: ServicioBloqueo | null) {
  await act(async () => {
    raiz.render(<Prueba activa={activa} servicio={servicio} />)
  })
}

function ponerVisibilidad(estado: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado })
}

beforeEach(() => {
  ponerVisibilidad('visible')
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
})

afterEach(async () => {
  await act(async () => raiz.unmount())
  contenedor.remove()
})

describe('usePantallaEncendida', () => {
  it('la pide al abrir y la suelta al salir', async () => {
    const falso = servicioFalso()
    await pintar(true, falso.servicio)
    expect(falso.servicio.request).toHaveBeenCalledWith('screen')
    await pintar(false, falso.servicio)
    expect(falso.soltados).toEqual([1])
  })

  it('al volver a la app, después de que el navegador la soltara, la pide otra vez', async () => {
    const falso = servicioFalso()
    await pintar(true, falso.servicio)
    // El navegador la suelta al pasar a segundo plano.
    ponerVisibilidad('hidden')
    await act(async () => {
      for (const fn of falso.oyentes) fn()
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(falso.pedidos()).toBe(1)
    ponerVisibilidad('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(falso.pedidos()).toBe(2)
  })

  it('sin activar, o sin la API, no pide nada', async () => {
    const falso = servicioFalso()
    await pintar(false, falso.servicio)
    expect(falso.servicio.request).not.toHaveBeenCalled()
    await pintar(true, null)
  })

  it('si el navegador la niega, no rompe nada', async () => {
    const servicio: ServicioBloqueo = { request: vi.fn(async () => Promise.reject(new Error('NotAllowedError'))) }
    await pintar(true, servicio)
    expect(servicio.request).toHaveBeenCalledTimes(1)
  })
})
