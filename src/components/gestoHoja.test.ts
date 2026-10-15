import { describe, expect, it } from 'vitest'
import { cierraAlSoltar, empiezaArrastre } from './gestoHoja'

// EL GESTO DE DESLIZAR LA HOJA DEL TELÉFONO (tarea 341). Lo que decide si
// un dedo que baja arrastra la hoja y si, al soltarlo, la cierra. El gesto
// es un atajo: la X, el velo y Esc siguen cerrándola (eso lo vigilan las
// pruebas de `Modal`).

describe('empiezaArrastre', () => {
  it('arrastra hacia abajo, en vertical, pasados 8 px y con el contenido arriba del todo', () => {
    expect(empiezaArrastre(0, 8, 0)).toBe(true)
    expect(empiezaArrastre(3, 20, 0)).toBe(true)
  })

  it('un temblor de menos de 8 px no es un arrastre', () => {
    expect(empiezaArrastre(0, 7, 0)).toBe(false)
  })

  it('hacia arriba o de lado es desplazar, no cerrar', () => {
    expect(empiezaArrastre(0, -30, 0)).toBe(false)
    expect(empiezaArrastre(25, 20, 0)).toBe(false)
  })

  it('con contenido por encima, el dedo desplaza la hoja por dentro', () => {
    expect(empiezaArrastre(0, 40, 1)).toBe(false)
    expect(empiezaArrastre(0, 40, 120)).toBe(false)
  })
})

describe('cierraAlSoltar', () => {
  it('cierra si el dedo bajó la cuarta parte de una hoja corta', () => {
    // Hoja de 300 px: basta con 75.
    expect(cierraAlSoltar(75, 1000, 300)).toBe(true)
    expect(cierraAlSoltar(74, 1000, 300)).toBe(false)
  })

  it('en una hoja alta no pide más de 120 px', () => {
    expect(cierraAlSoltar(120, 1000, 700)).toBe(true)
    expect(cierraAlSoltar(119, 1000, 700)).toBe(false)
  })

  it('un tirón rápido cierra aunque baje poco, pero nunca con menos de 40 px', () => {
    // 50 px en 60 ms: más de medio píxel por milisegundo.
    expect(cierraAlSoltar(50, 60, 700)).toBe(true)
    // Igual de rápido, pero corto: un toque tembloroso.
    expect(cierraAlSoltar(30, 20, 700)).toBe(false)
    // 50 px despacio: vuelve a su sitio.
    expect(cierraAlSoltar(50, 400, 700)).toBe(false)
  })

  it('sin desplazamiento hacia abajo no cierra nunca', () => {
    expect(cierraAlSoltar(0, 10, 300)).toBe(false)
    expect(cierraAlSoltar(-20, 10, 300)).toBe(false)
  })
})
