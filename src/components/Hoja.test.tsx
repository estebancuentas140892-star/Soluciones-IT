// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dialogo } from './Dialogo'
import { Hoja } from './Hoja'

// LA HOJA Y EL DIÁLOGO ÚNICOS (tarea 291, auditoría UX, F1, F2 y F9): una
// hoja estándar con un solo velo, que se cierra con Escape, tocando fuera
// o con su ×, solo la de arriba si hay dos, y que devuelve el foco al
// control que la abrió.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let contenedor: HTMLDivElement
let raiz: Root

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
})

afterEach(() => {
  act(() => raiz.unmount())
  contenedor.remove()
  document.body.style.overflow = ''
})

function pulsarEscape() {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

describe('Hoja', () => {
  it('va a <body>, es un diálogo con nombre y bloquea el fondo', () => {
    act(() =>
      raiz.render(
        <Hoja abierta onCerrar={() => {}} titulo="¿A quién se asigna Impresora Mercadeo?">
          <p>Contenido</p>
        </Hoja>,
      ),
    )
    const dialogo = document.body.querySelector('[role="dialog"]')!
    expect(contenedor.contains(dialogo)).toBe(false)
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
    const titulo = document.getElementById(dialogo.getAttribute('aria-labelledby')!)!
    expect(titulo.textContent).toBe('¿A quién se asigna Impresora Mercadeo?')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('se cierra con Escape, con la × y tocando el velo', () => {
    const onCerrar = vi.fn()
    act(() =>
      raiz.render(
        <Hoja abierta onCerrar={onCerrar} titulo="Acciones">
          <p>Contenido</p>
        </Hoja>,
      ),
    )
    pulsarEscape()
    expect(onCerrar).toHaveBeenCalledTimes(1)

    act(() => document.body.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click())
    expect(onCerrar).toHaveBeenCalledTimes(2)

    const velo = document.body.querySelector<HTMLDivElement>('.bg-noct-bg\\/70')!
    act(() => velo.click())
    expect(onCerrar).toHaveBeenCalledTimes(3)
  })

  it('sin `cerrable` no hay ×, ni Escape ni velo que cierren', () => {
    const onCerrar = vi.fn()
    act(() =>
      raiz.render(
        <Hoja abierta onCerrar={onCerrar} titulo="Guardando" cerrable={false}>
          <p>Contenido</p>
        </Hoja>,
      ),
    )
    expect(document.body.querySelector('button[aria-label="Cerrar"]')).toBeNull()
    pulsarEscape()
    act(() => document.body.querySelector<HTMLDivElement>('.bg-noct-bg\\/70')!.click())
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('con dos hojas abiertas, Escape cierra solo la de arriba', () => {
    const cerrarAbajo = vi.fn()
    const cerrarArriba = vi.fn()
    act(() =>
      raiz.render(
        <>
          <Hoja abierta onCerrar={cerrarAbajo} titulo="Acciones del equipo">
            <p>Acciones</p>
          </Hoja>
          <Hoja abierta onCerrar={cerrarArriba} titulo="¿Eliminar Impresora Mercadeo?">
            <p>Confirmar</p>
          </Hoja>
        </>,
      ),
    )
    pulsarEscape()
    expect(cerrarArriba).toHaveBeenCalledTimes(1)
    expect(cerrarAbajo).not.toHaveBeenCalled()
  })

  it('el foco entra en la hoja y vuelve al control que la abrió', () => {
    function Pantalla() {
      const [abierta, setAbierta] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setAbierta(true)}>
            Abrir
          </button>
          <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Filtrar">
            <p>Opciones</p>
          </Hoja>
        </>
      )
    }
    act(() => raiz.render(<Pantalla />))
    const abrir = contenedor.querySelector('button')!
    abrir.focus()
    act(() => abrir.click())
    const dialogo = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialogo.contains(document.activeElement)).toBe(true)

    pulsarEscape()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(abrir)
  })
})

describe('Dialogo', () => {
  it('nombra la acción entera, la ejecuta y "Cancelar" cierra', () => {
    const onConfirmar = vi.fn()
    const onCerrar = vi.fn()
    act(() =>
      raiz.render(
        <Dialogo
          abierto
          onCerrar={onCerrar}
          titulo="¿Eliminar Impresora Mercadeo?"
          descripcion="Se quita del inventario de todo el equipo."
          accion={{ texto: 'Eliminar el equipo', onConfirmar }}
        />,
      ),
    )
    const botones = [...document.body.querySelectorAll('[role="dialog"] button')]
    const accion = botones.find((boton) => boton.textContent === 'Eliminar el equipo')!
    const cancelar = botones.find((boton) => boton.textContent === 'Cancelar')!
    expect(accion.className).toContain('border-noct-error')
    expect(accion.className).toContain('min-h-[52px]')
    // En el DOM la acción va antes que "Cancelar": arriba en el teléfono,
    // a la derecha en el escritorio.
    expect(botones.indexOf(accion)).toBeLessThan(botones.indexOf(cancelar))

    act(() => (accion as HTMLButtonElement).click())
    expect(onConfirmar).toHaveBeenCalledTimes(1)
    act(() => (cancelar as HTMLButtonElement).click())
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('sin acción, su única salida dice "Cerrar"', () => {
    act(() => raiz.render(<Dialogo abierto onCerrar={() => {}} titulo="No se puede eliminar todavía" />))
    const textos = [...document.body.querySelectorAll('[role="dialog"] button')].map((boton) => boton.textContent)
    expect(textos).toContain('Cerrar')
    expect(textos).not.toContain('Cancelar')
  })
})
