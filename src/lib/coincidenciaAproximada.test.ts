import { describe, expect, it } from 'vitest'
import {
  coincidenciaDePalabra,
  distanciaDamerau,
  distanciaLevenshtein,
  esAproximable,
  palabrasLiterales,
  terminosDe,
  toleranciaDe,
} from './coincidenciaAproximada'

// LA REGLA COMÚN DE LA COINCIDENCIA APROXIMADA (tarea 346). Lo que comparten
// Resolver y Equipos: cuándo dos palabras son la misma, cuándo se parecen y
// qué no se aproxima nunca.

describe('Damerau-Levenshtein: dos letras cambiadas de sitio son UN error', () => {
  it('"garcia" y "gracia", "impirme" e "imprime": 1 con Damerau, 2 con Levenshtein', () => {
    expect(distanciaDamerau('garcia', 'gracia', 3)).toBe(1)
    expect(distanciaLevenshtein('garcia', 'gracia', 3)).toBe(2)
    expect(distanciaDamerau('impirme', 'imprime', 3)).toBe(1)
    expect(distanciaLevenshtein('impirme', 'imprime', 3)).toBe(2)
  })

  it('una letra de menos, de más o cambiada cuesta 1, como siempre', () => {
    expect(distanciaDamerau('impresra', 'impresora', 3)).toBe(1)
    expect(distanciaDamerau('impresoraa', 'impresora', 3)).toBe(1)
    expect(distanciaDamerau('epsom', 'epson', 3)).toBe(1)
    expect(distanciaDamerau('igual', 'igual', 3)).toBe(0)
  })

  it('corta en cuanto pasa el tope: devuelve tope + 1', () => {
    expect(distanciaDamerau('impresora', 'servidor', 1)).toBe(2)
    expect(distanciaDamerau('a', 'abcdef', 2)).toBe(3)
  })
})

describe('la tolerancia es la del índice, no más', () => {
  it('1 error de 3 a 7 letras y 2 de 8 a 12; ninguno en 1 o 2 letras', () => {
    expect(toleranciaDe('ip')).toBe(0)
    expect(toleranciaDe('red')).toBe(1)
    expect(toleranciaDe('garcia')).toBe(1)
    expect(toleranciaDe('impirme')).toBe(1)
    expect(toleranciaDe('impresra')).toBe(2)
  })

  it('solo se aproxima una palabra de letras', () => {
    expect(esAproximable('impresra')).toBe(true)
    expect(esAproximable('xk7q2291')).toBe(false)
    expect(esAproximable('10')).toBe(false)
    expect(esAproximable('ip')).toBe(false)
  })
})

describe('mayúsculas y tildes no son errores', () => {
  it('"José" y "jose" son la misma palabra: coincidencia EXACTA', () => {
    const [jose] = terminosDe('José')
    expect(jose).toBe('jose')
    expect(coincidenciaDePalabra('jose', jose)).toEqual({ clase: 'exacta', distancia: 0 })
    expect(terminosDe('DANIEL GARCÍA')).toEqual(['daniel', 'garcia'])
  })
})

describe('lo escrito como un valor nunca se aproxima', () => {
  it('IP, serial, placa, modificador de comando, ruta y correo', () => {
    expect([...palabrasLiterales('ping 10.10.6.8 -t')]).toEqual(['10', '6', '8', 't'])
    expect(palabrasLiterales('XK7Q2291').has('xk7q2291')).toBe(true)
    expect(palabrasLiterales('placa MP-00123').has('mp')).toBe(true)
    expect(palabrasLiterales('placa MP-00123').has('placa')).toBe(false)
    expect([...palabrasLiterales('ipconfig /flushdns')]).toEqual(['flushdns'])
    expect(palabrasLiterales('\\\\servidor\\compartida').has('servidor')).toBe(true)
    expect(palabrasLiterales('soporte@ejemplo.local').has('soporte')).toBe(true)
  })

  it('la puntuación de una frase no convierte una palabra en un valor', () => {
    expect(palabrasLiterales('no impirme.').size).toBe(0)
    expect(palabrasLiterales('¿daniel garcia?').size).toBe(0)
    expect(palabrasLiterales('impresora, mercadeo').size).toBe(0)
  })
})

describe('coincidenciaDePalabra: exacta, por prefijo o aproximada', () => {
  it('distingue las tres y dice cuántos errores tolera', () => {
    expect(coincidenciaDePalabra('impresora', 'impresora')?.clase).toBe('exacta')
    expect(coincidenciaDePalabra('impre', 'impresora')?.clase).toBe('prefijo')
    expect(coincidenciaDePalabra('impre', 'impresora', { prefijo: false })).toBeNull()
    expect(coincidenciaDePalabra('gracia', 'garcia')).toEqual({ clase: 'aproximada', distancia: 1 })
  })

  it('no aproxima contra un término con dígitos ni si se pide que no', () => {
    expect(coincidenciaDePalabra('serial', 'seria1')).toBeNull()
    expect(coincidenciaDePalabra('gracia', 'garcia', { aproximada: false })).toBeNull()
    // Dos errores en 6 letras ya no es la misma palabra.
    expect(coincidenciaDePalabra('garces', 'garcia')).toBeNull()
  })
})
