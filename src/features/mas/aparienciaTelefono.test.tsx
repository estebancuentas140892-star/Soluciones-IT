// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLAVE_TEMA, guardarPreferenciaTema, preferenciaTemaActual } from '../../lib/tema'
import { AparienciaTelefono } from './AparienciaTelefono'

// «APARIENCIA» EN MÁS (tarea 350, prototipo de Claude Design): la misma
// preferencia de Ajustes, en un control segmentado; no cambia el valor por
// defecto (oscuro, regla 12).

let raiz: Root
let contenedor: HTMLDivElement

beforeEach(() => {
  localStorage.clear()
  guardarPreferenciaTema('oscuro')
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
})

afterEach(() => {
  act(() => raiz.unmount())
  contenedor.remove()
  localStorage.clear()
})

function opcion(nombre: string): HTMLElement {
  const encontrada = Array.from(contenedor.querySelectorAll<HTMLElement>('[role="radio"]')).find((b) => b.textContent?.trim() === nombre)
  if (!encontrada) throw new Error(`No está «${nombre}»`)
  return encontrada
}

describe('AparienciaTelefono', () => {
  it('ofrece Automático, Claro y Oscuro, con el elegido marcado', () => {
    act(() => raiz.render(<AparienciaTelefono />))
    expect(Array.from(contenedor.querySelectorAll('[role="radio"]')).map((b) => b.textContent?.trim())).toEqual([
      'Automático',
      'Claro',
      'Oscuro',
    ])
    expect(opcion('Oscuro').getAttribute('aria-checked')).toBe('true')
    expect(contenedor.textContent).toContain('Elegiste el tema oscuro. Se recuerda en este teléfono.')
  })

  it('elegir guarda la misma preferencia que Ajustes, en este teléfono', () => {
    act(() => raiz.render(<AparienciaTelefono />))
    act(() => opcion('Claro').click())
    expect(preferenciaTemaActual()).toBe('claro')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro')
    expect(opcion('Claro').getAttribute('aria-checked')).toBe('true')
    act(() => opcion('Automático').click())
    expect(preferenciaTemaActual()).toBe('automatico')
    expect(contenedor.textContent).toContain('Automático sigue al teléfono.')
  })
})
