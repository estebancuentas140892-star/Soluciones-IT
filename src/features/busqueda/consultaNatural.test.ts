import { describe, expect, it } from 'vitest'
import { derivaDe, palabrasDeConsulta, palabrasDeContenido, usaPrefijo } from './consultaNatural'

// El vocabulario con que el buscador lee una consulta escrita como una
// frase (tarea 288). Lógica pura.

describe('palabrasDeConsulta', () => {
  it('normaliza como el índice: minúsculas, sin tildes y partida por la misma puntuación', () => {
    expect(palabrasDeConsulta('Qué es DHCP')).toEqual(['que', 'es', 'dhcp'])
    expect(palabrasDeConsulta('Contraseña del PC-CONT-01')).toEqual(['contrasena', 'del', 'pc', 'cont', '01'])
    // Una IP son sus números, como en MiniSearch.
    expect(palabrasDeConsulta('10.10.6.8')).toEqual(['10', '6', '8'])
  })

  it('no repite una palabra', () => {
    expect(palabrasDeConsulta('impresora impresora mercadeo')).toEqual(['impresora', 'mercadeo'])
  })
})

describe('palabrasDeContenido', () => {
  it('quita lo que no dice nada: artículos, preposiciones, pronombres y verbos de relleno', () => {
    expect(palabrasDeContenido('la impresora de mercadeo no imprime')).toEqual(['impresora', 'mercadeo', 'imprime'])
    expect(palabrasDeContenido('no me deja enviar archivo pesado')).toEqual(['enviar', 'archivo', 'pesado'])
    expect(palabrasDeContenido('llegó una persona nueva')).toEqual(['llego', 'persona', 'nueva'])
    expect(palabrasDeContenido('qué es DHCP')).toEqual(['dhcp'])
  })

  it('una consulta hecha solo de palabras vacías se busca tal cual', () => {
    expect(palabrasDeContenido('no')).toEqual(['no'])
    expect(palabrasDeContenido('de la')).toEqual(['de', 'la'])
  })

  it('las letras y los números sueltos que dicen algo se quedan', () => {
    expect(palabrasDeContenido('windows r')).toEqual(['windows', 'r'])
    expect(palabrasDeContenido('impresora caja 2')).toEqual(['impresora', 'caja', '2'])
  })
})

describe('usaPrefijo', () => {
  it('se busca por prefijo mientras se escribe, salvo una letra suelta acompañada', () => {
    expect(usaPrefijo('impre', ['impre'])).toBe(true)
    expect(usaPrefijo('r', ['windows', 'r'])).toBe(false)
    expect(usaPrefijo('r', ['r'])).toBe(true)
  })
})

describe('derivaDe: la misma regla con que MiniSearch encuentra un término', () => {
  it('idéntico, por prefijo si se busca por prefijo, o con una errata dentro de la tolerancia', () => {
    expect(derivaDe('impresora', 'impresora', false)).toBe(true)
    expect(derivaDe('impresoras', 'impresora', true)).toBe(true)
    expect(derivaDe('router', 'r', false)).toBe(false)
    // 8 letras toleran 2 cambios; 5, uno.
    expect(derivaDe('mercadeo', 'mercadep', false)).toBe(true)
    expect(derivaDe('respaldar', 'respaldo', false)).toBe(true)
    expect(derivaDe('epson', 'epsom', false)).toBe(true)
  })

  it('las palabras cortas no toleran erratas: "ip" no es "ap"', () => {
    expect(derivaDe('ap', 'ip', false)).toBe(false)
    expect(derivaDe('caja', 'cajas', false)).toBe(true)
    expect(derivaDe('carpeta', 'correo', false)).toBe(false)
  })
})
