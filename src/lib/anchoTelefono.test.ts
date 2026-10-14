// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONSULTA_TELEFONO, esAnchoTelefono, suscribirAnchoTelefono } from './anchoTelefono'

// EL CORTE DEL TELÉFONO (tarea 338): 767 px todavía es teléfono, 768 ya no,
// el mismo `md` de Tailwind que usa el Chasis.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

afterEach(() => {
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
  vi.unstubAllGlobals()
})

describe('el ancho de teléfono', () => {
  it('es el mismo corte que `md` (48rem = 768 px)', () => {
    expect(CONSULTA_TELEFONO).toBe('(width < 48rem)')
  })

  it('las pruebas de interfaz miran un teléfono por defecto (src/pruebas/setup.ts)', () => {
    expect(window.innerWidth).toBe(375)
    expect(esAnchoTelefono()).toBe(true)
  })

  it('767 px es teléfono y 768 px ya no', () => {
    ventana.happyDOM.setViewport({ width: 767, height: 900 })
    expect(esAnchoTelefono()).toBe(true)
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    expect(esAnchoTelefono()).toBe(false)
    ventana.happyDOM.setViewport({ width: 1280, height: 800 })
    expect(esAnchoTelefono()).toBe(false)
  })

  it('sin matchMedia se considera teléfono (la app se diseña primero para él)', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(esAnchoTelefono()).toBe(true)
    expect(() => suscribirAnchoTelefono(() => {})()).not.toThrow()
  })

  it('avisa al cruzar el corte y deja de avisar al soltarlo', () => {
    // happy-dom no emite `change` al cambiar de tamaño: se simula la consulta.
    const oyentes = new Set<() => void>()
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: false,
      media: consulta,
      addEventListener: (_: string, f: () => void) => oyentes.add(f),
      removeEventListener: (_: string, f: () => void) => oyentes.delete(f),
    }))
    const avisar = vi.fn()
    const dejar = suscribirAnchoTelefono(avisar)
    oyentes.forEach((f) => f())
    expect(avisar).toHaveBeenCalledTimes(1)
    dejar()
    expect(oyentes.size).toBe(0)
  })
})
