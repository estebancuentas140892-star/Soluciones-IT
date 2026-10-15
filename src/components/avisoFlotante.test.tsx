// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvisoFlotante } from './AvisoFlotante'
import { avisar, DURACION_AVISO_MS, retirarAviso } from './avisosFlotantes'
import { huecoAvisoActualizacion, huecoAvisoActualizacionChasis } from './ranuraAvisoActualizacion'

// EL AVISO FLOTANTE (tarea 341, handoff móvil "1b Pulgar": "sobre el pie
// fijo, invertido, 200 ms, 2.4 s"). Una confirmación breve de algo que ya
// pasó: se anuncia sin robar el foco, dura 2,4 s y un aviso nuevo sustituye
// al anterior. La animación (y "reducir movimiento") la vigila
// sistemaVisual.test.ts.

let raiz: Root
let contenedor: HTMLDivElement

function region(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('[role="status"]')
  if (!el) throw new Error('Sin la región del aviso')
  return el
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
  await act(async () => raiz.render(<AvisoFlotante />))
})

afterEach(async () => {
  retirarAviso()
  await act(async () => raiz.unmount())
  contenedor.remove()
  vi.useRealTimers()
})

describe('AvisoFlotante', () => {
  it('la región existe siempre, se anuncia con cortesía y no recibe toques', () => {
    expect(region().getAttribute('aria-live')).toBe('polite')
    expect(region().getAttribute('aria-atomic')).toBe('true')
    expect(region().className).toContain('pointer-events-none')
    expect(region().textContent).toBe('')
  })

  it('muestra el aviso 2,4 s y después lo retira', async () => {
    expect(DURACION_AVISO_MS).toBe(2400)
    await act(async () => avisar('IP copiada: 10.0.0.5', 'copiado'))
    expect(region().textContent).toBe('IP copiada: 10.0.0.5')
    expect(document.activeElement).not.toBe(region())

    await act(async () => vi.advanceTimersByTime(DURACION_AVISO_MS - 1))
    expect(region().textContent).toBe('IP copiada: 10.0.0.5')
    await act(async () => vi.advanceTimersByTime(1))
    expect(region().textContent).toBe('')
  })

  it('un aviso nuevo sustituye al anterior y vuelve a contar desde cero', async () => {
    await act(async () => avisar('Avance guardado: paso 2 de 4'))
    await act(async () => vi.advanceTimersByTime(2000))
    await act(async () => avisar('Bóveda desbloqueada', 'candado'))
    expect(region().textContent).toBe('Bóveda desbloqueada')

    // El temporizador del primero ya no lo retira.
    await act(async () => vi.advanceTimersByTime(1000))
    expect(region().textContent).toBe('Bóveda desbloqueada')
    await act(async () => vi.advanceTimersByTime(DURACION_AVISO_MS - 1000))
    expect(region().textContent).toBe('')
  })

  it('el mismo texto dos veces se vuelve a anunciar (otro elemento)', async () => {
    await act(async () => avisar('Bóveda desbloqueada', 'candado'))
    const primero = region().firstElementChild
    await act(async () => avisar('Bóveda desbloqueada', 'candado'))
    expect(region().firstElementChild).not.toBe(primero)
  })
})

// SOBRE EL PIE FIJO. El hueco del aviso de versión nueva está vacío casi
// siempre (`empty:hidden`) y no mide nada: el aviso se coloca sobre su sitio,
// nunca encima de las pestañas ni de la acción de la pantalla.
describe('dónde se coloca', () => {
  const quitar: (() => void)[] = []
  afterEach(() => {
    for (const q of quitar.splice(0)) q()
    document.body.querySelectorAll('[data-prueba-pie]').forEach((el) => el.remove())
  })

  it('sobre la franja pegajosa del chasis vacía: su `bottom`, más 10 px', async () => {
    const franja = document.createElement('div')
    franja.setAttribute('data-prueba-pie', '')
    franja.style.position = 'sticky'
    franja.style.bottom = '65px'
    franja.style.display = 'none'
    document.body.appendChild(franja)
    await act(async () => {
      const q = huecoAvisoActualizacionChasis(franja)
      if (q) quitar.push(q)
    })
    await act(async () => avisar('Avance guardado: paso 2 de 4'))
    expect(region().style.bottom).toBe('75px')
  })

  it('sobre la barra de acciones que contiene el hueco vacío', async () => {
    const barra = document.createElement('div')
    barra.setAttribute('data-prueba-pie', '')
    barra.getBoundingClientRect = () => ({ top: 700, bottom: 780, left: 0, right: 375, width: 375, height: 80, x: 0, y: 700, toJSON: () => ({}) })
    const hueco = document.createElement('div')
    barra.appendChild(hueco)
    document.body.appendChild(barra)
    await act(async () => {
      const q = huecoAvisoActualizacion(hueco)
      if (q) quitar.push(q)
    })
    await act(async () => avisar('IP copiada: 10.0.0.5', 'copiado'))
    expect(region().style.bottom).toBe(`${window.innerHeight - 700 + 10}px`)
  })
})
