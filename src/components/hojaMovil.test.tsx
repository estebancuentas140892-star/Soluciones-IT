// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { Modal } from './Modal'

// LA HOJA DEL TELÉFONO (tarea 341, handoff móvil "1b Pulgar"). Por debajo
// de 768 px el diálogo y la hoja son la hoja del handoff: pegada abajo, con
// asa, el velo del sistema y deslizar para cerrar. El gesto es un atajo: la
// X, el velo y Esc siguen cerrándola (eso lo vigilan las pruebas del foco y
// del chasis). Desde 768 la hoja es el panel lateral y el gesto no existe.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba
const TELEFONO = { width: 390, height: 844 }
const TABLETA = { width: 768, height: 1024 }

let raiz: Root
let contenedor: HTMLDivElement
let cerrar: Mock<() => void>

async function abrir(): Promise<HTMLElement> {
  await act(async () =>
    raiz.render(
      <Modal abierto onCerrar={cerrar} tituloId="hoja-prueba" variante="hoja">
        <h2 id="hoja-prueba">Datos de prueba</h2>
        <p>Contenido de prueba</p>
        <input aria-label="Campo de prueba" />
      </Modal>,
    ),
  )
  const hoja = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (!hoja) throw new Error('Sin la hoja')
  return hoja
}

/** Un toque con un solo dedo en `y`, sobre `objetivo`. */
function toque(tipo: 'touchstart' | 'touchmove' | 'touchend', objetivo: Element, y: number): void {
  const evento = new Event(tipo, { bubbles: true, cancelable: true })
  const dedos = tipo === 'touchend' ? [] : [{ clientX: 50, clientY: y }]
  Object.defineProperty(evento, 'touches', { value: dedos })
  objetivo.dispatchEvent(evento)
}

async function deslizar(objetivo: Element, desde: number, hasta: number): Promise<void> {
  await act(async () => {
    toque('touchstart', objetivo, desde)
    toque('touchmove', objetivo, desde + Math.sign(hasta - desde) * 10)
    toque('touchmove', objetivo, hasta)
    toque('touchend', objetivo, hasta)
  })
}

beforeEach(() => {
  ventana.happyDOM.setViewport(TELEFONO)
  cerrar = vi.fn<() => void>()
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
})

afterEach(async () => {
  await act(async () => raiz.unmount())
  contenedor.remove()
  ventana.happyDOM.setViewport(TELEFONO)
})

describe('la hoja del teléfono', () => {
  it('va pegada abajo, de lado a lado, con radio 22 arriba, asa y el velo del sistema', async () => {
    const hoja = await abrir()
    const clases = hoja.className.split(/\s+/)
    for (const clase of ['max-md:rounded-t-[22px]', 'max-md:rounded-b-none', 'max-md:max-w-none', 'max-md:border-0']) {
      expect(clases).toContain(clase)
    }
    expect(hoja.hasAttribute('data-hoja-movil')).toBe(true)
    // El asa es la pista del gesto: se ve en el teléfono y no existe para el lector.
    const asa = hoja.firstElementChild as HTMLElement
    expect(asa.getAttribute('aria-hidden')).toBe('true')
    expect(asa.className).toContain('md:hidden')
    expect(asa.querySelector('span')?.className).toContain('bg-noct-divider-fuerte')
    const velo = hoja.parentElement as HTMLElement
    expect(velo.className.split(/\s+/)).toContain('max-md:bg-noct-velo')
    expect(velo.className.split(/\s+/)).toContain('max-md:p-0')
  })

  it('deslizarla hacia abajo la cierra', async () => {
    const hoja = await abrir()
    await deslizar(hoja.querySelector('p') as Element, 100, 320)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('hacia arriba, o empezando en un campo, no cierra nada', async () => {
    const hoja = await abrir()
    await deslizar(hoja.querySelector('p') as Element, 320, 100)
    await deslizar(hoja.querySelector('input') as Element, 100, 320)
    expect(cerrar).not.toHaveBeenCalled()
  })

  it('un arrastre corto la devuelve a su sitio', async () => {
    const hoja = await abrir()
    // Sin maquetación la hoja no mide nada: aquí el umbral lo pone el tirón.
    Object.defineProperty(hoja, 'offsetHeight', { value: 600, configurable: true })
    await act(async () => {
      toque('touchstart', hoja, 100)
      toque('touchmove', hoja, 112)
      toque('touchmove', hoja, 130)
    })
    expect(hoja.style.transform).toBe('translateY(30px)')
    await new Promise((listo) => setTimeout(listo, 120))
    await act(async () => toque('touchend', hoja, 130))
    expect(cerrar).not.toHaveBeenCalled()
    expect(hoja.style.transform).toBe('')
  })

  it('desde 768 es el panel lateral y el gesto no existe', async () => {
    ventana.happyDOM.setViewport(TABLETA)
    const hoja = await abrir()
    await deslizar(hoja.querySelector('p') as Element, 100, 320)
    expect(cerrar).not.toHaveBeenCalled()
    expect(hoja.style.transform).toBe('')
  })
})
