// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONSULTA_TELEFONO } from './anchoTelefono'
import {
  aplicarTema,
  CLAVE_TEMA,
  colorBarra,
  guardarPreferenciaTema,
  iniciarTema,
  leerPreferenciaTema,
  preferenciaTemaActual,
  suscribirPreferenciaTema,
  temaEfectivo,
} from './tema'

// EL TEMA (tarea 333): oscuro por defecto, claro opcional y automático
// según el teléfono, guardado solo en este teléfono.

// El teléfono simulado: si pide claro (`prefers-color-scheme`) y su ancho
// (desde la tarea 338 el claro solo pinta por debajo de 768 px). Cada
// consulta tiene su oyente.
function simularTelefono(
  pideClaro: boolean,
  ancho = 375,
): { cambiar: (claro: boolean) => void; cambiarAncho: (ancho: number) => void } {
  const oyentes = new Map<string, () => void>()
  let claro = pideClaro
  let anchoActual = ancho
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    get matches() {
      if (consulta.includes('light')) return claro
      if (consulta === CONSULTA_TELEFONO) return anchoActual < 768
      return false
    },
    addEventListener: (_: string, f: () => void) => {
      oyentes.set(consulta, f)
    },
    removeEventListener: () => {},
  }))
  return {
    cambiar: (nuevo) => {
      claro = nuevo
      oyentes.get('(prefers-color-scheme: light)')?.()
    },
    cambiarAncho: (nuevo) => {
      anchoActual = nuevo
      oyentes.get(CONSULTA_TELEFONO)?.()
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

describe('el claro solo pinta en el teléfono (tarea 338)', () => {
  const barra = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

  it('la barra del navegador es clara solo con tema claro y ancho de teléfono', () => {
    expect(colorBarra('claro', true)).toBe('#f4f5f8')
    expect(colorBarra('claro', false)).toBe('#161826')
    expect(colorBarra('oscuro', true)).toBe('#161826')
    expect(colorBarra('oscuro', false)).toBe('#161826')
  })

  it('desde 768 px la preferencia se guarda y se marca en <html>, pero la barra sigue oscura', () => {
    simularTelefono(false, 1280)
    guardarPreferenciaTema('claro')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro')
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro')
    expect(barra()).toBe('#161826')
  })

  it('al cruzar los 768 px la barra acompaña a la página, sin tocar la preferencia', () => {
    const pantalla = simularTelefono(false, 375)
    localStorage.setItem(CLAVE_TEMA, 'claro')
    iniciarTema()
    expect(barra()).toBe('#f4f5f8')
    pantalla.cambiarAncho(768)
    expect(barra()).toBe('#161826')
    pantalla.cambiarAncho(767)
    expect(barra()).toBe('#f4f5f8')
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro')
  })
})
