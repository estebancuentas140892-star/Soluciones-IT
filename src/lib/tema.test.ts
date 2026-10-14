// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aplicarTema,
  CLAVE_TEMA,
  guardarPreferenciaTema,
  iniciarTema,
  leerPreferenciaTema,
  preferenciaTemaActual,
  suscribirPreferenciaTema,
  temaEfectivo,
} from './tema'

// EL TEMA (tarea 333): oscuro por defecto, claro opcional y automático
// según el teléfono, guardado solo en este teléfono.

function simularTelefono(pideClaro: boolean): { cambiar: (claro: boolean) => void } {
  let oyente: (() => void) | null = null
  let claro = pideClaro
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    get matches() {
      return consulta.includes('light') ? claro : !claro
    },
    addEventListener: (_: string, f: () => void) => {
      oyente = f
    },
  }))
  return {
    cambiar: (nuevo) => {
      claro = nuevo
      oyente?.()
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-tema')
  document.head.innerHTML = '<meta name="theme-color" content="#161826" />'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('el tema efectivo', () => {
  it('oscuro y claro mandan; automático sigue al teléfono', () => {
    expect(temaEfectivo('oscuro', true)).toBe('oscuro')
    expect(temaEfectivo('claro', false)).toBe('claro')
    expect(temaEfectivo('automatico', true)).toBe('claro')
    expect(temaEfectivo('automatico', false)).toBe('oscuro')
  })
})

describe('la preferencia de este teléfono', () => {
  it('sin elegir, o con un valor que no vale, es oscuro', () => {
    expect(leerPreferenciaTema()).toBe('oscuro')
    localStorage.setItem(CLAVE_TEMA, 'violeta')
    expect(leerPreferenciaTema()).toBe('oscuro')
  })

  it('elegir claro lo guarda, lo pinta en <html> y en la barra del navegador, y avisa', () => {
    simularTelefono(false)
    const avisos = vi.fn()
    const dejar = suscribirPreferenciaTema(avisos)
    guardarPreferenciaTema('claro')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro')
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f4f5f8')
    expect(preferenciaTemaActual()).toBe('claro')
    expect(avisos).toHaveBeenCalledTimes(1)
    dejar()
  })

  it('volver a oscuro borra la clave: es el de por defecto', () => {
    simularTelefono(true)
    guardarPreferenciaTema('claro')
    guardarPreferenciaTema('oscuro')
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull()
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#161826')
  })

  it('en automático cambia solo cuando cambia el teléfono, sin recargar', () => {
    const telefono = simularTelefono(false)
    localStorage.setItem(CLAVE_TEMA, 'automatico')
    iniciarTema()
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro')
    telefono.cambiar(true)
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro')
  })

  it('con una preferencia fija, el teléfono no la mueve', () => {
    const telefono = simularTelefono(false)
    localStorage.setItem(CLAVE_TEMA, 'oscuro')
    iniciarTema()
    telefono.cambiar(true)
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro')
    expect(aplicarTema('claro')).toBe('claro')
  })
})
