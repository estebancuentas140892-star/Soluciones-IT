import { describe, expect, it } from 'vitest'
import { decidirContraida, type EstadoContraible } from './contraerAlBajar'

const INICIO: EstadoContraible = { contraida: false, ultimo: 0 }

describe('decidirContraida', () => {
  it('se encoge al bajar', () => {
    expect(decidirContraida({ contraida: false, ultimo: 100 }, 200).contraida).toBe(true)
  })

  it('vuelve entera al subir', () => {
    expect(decidirContraida({ contraida: true, ultimo: 400 }, 300).contraida).toBe(false)
  })

  it('va entera cerca del principio, aunque se venga bajando', () => {
    expect(decidirContraida({ contraida: true, ultimo: 200 }, 40)).toEqual({ contraida: false, ultimo: 40 })
    expect(decidirContraida({ contraida: true, ultimo: 200 }, 0)).toEqual({ contraida: false, ultimo: 0 })
  })

  it('ignora el micromovimiento: por debajo del umbral no cambia nada', () => {
    const estado = { contraida: false, ultimo: 300 }
    expect(decidirContraida(estado, 305)).toBe(estado)
    expect(decidirContraida(estado, 296)).toBe(estado)
  })

  it('acumula el arrastre lento contra el punto de la última decisión', () => {
    // El umbral se mide contra el punto de la decisión anterior, no
    // contra la posición anterior: un arrastre de 5 px en 5 px no se
    // pierde, suma hasta cruzar los 8 y decide ahí (300 → 310).
    let estado: EstadoContraible = { contraida: false, ultimo: 300 }
    estado = decidirContraida(estado, 305)
    expect(estado).toEqual({ contraida: false, ultimo: 300 })
    estado = decidirContraida(estado, 310)
    expect(estado).toEqual({ contraida: true, ultimo: 310 })
  })

  it('desde el principio de la pantalla, un salto largo hacia abajo la encoge', () => {
    expect(decidirContraida(INICIO, 500)).toEqual({ contraida: true, ultimo: 500 })
  })
})
