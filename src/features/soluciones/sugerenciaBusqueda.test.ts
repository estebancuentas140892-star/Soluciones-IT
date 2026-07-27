import { describe, expect, it } from 'vitest'
import { distanciaEdicion, sugerenciaBusqueda, vocabularioDe } from './sugerenciaBusqueda'

describe('distanciaEdicion', () => {
  it('da 0 en cadenas iguales', () => {
    expect(distanciaEdicion('zebra', 'zebra', 2)).toBe(0)
  })

  it('cuenta sustituciones, inserciones y borrados', () => {
    expect(distanciaEdicion('zebra', 'zebro', 2)).toBe(1)
    expect(distanciaEdicion('zebra', 'zebbra', 2)).toBe(1)
    expect(distanciaEdicion('zebbra', 'zebra', 2)).toBe(1)
    expect(distanciaEdicion('zbra', 'zebra', 2)).toBe(1)
  })

  // El corte temprano solo debe ahorrar trabajo, nunca cambiar el
  // veredicto: por encima del máximo basta con devolver "no entra".
  it('abandona en cuanto supera el máximo tolerado', () => {
    expect(distanciaEdicion('zebra', 'impresora', 2)).toBeGreaterThan(2)
  })

  it('descarta por diferencia de longitud sin recorrer la matriz', () => {
    expect(distanciaEdicion('red', 'redundancia', 1)).toBeGreaterThan(1)
  })
})

describe('vocabularioDe', () => {
  it('parte en palabras de 4 letras o más y descarta las cortas', () => {
    const vocabulario = vocabularioDe(['Instalar la impresora de red'])
    expect([...vocabulario.keys()].sort()).toEqual(['impresora', 'instalar'])
  })

  it('conserva la forma original con acentos para poder mostrarla', () => {
    const vocabulario = vocabularioDe(['Consola de cámaras'])
    expect(vocabulario.get('camaras')).toBe('cámaras')
  })

  it('no duplica una palabra repetida entre textos', () => {
    const vocabulario = vocabularioDe(['Zebra ZT411', 'Calibrar Zebra'])
    expect([...vocabulario.keys()].filter((p) => p === 'zebra')).toHaveLength(1)
  })
})

describe('sugerenciaBusqueda', () => {
  const textos = ['Instalar impresora Zebra ZT411', 'Consola de cámaras Hikvision', 'Impresoras']

  it('corrige una letra de más', () => {
    expect(sugerenciaBusqueda('zebbra', textos)).toBe('Zebra')
  })

  it('corrige una letra cambiada', () => {
    expect(sugerenciaBusqueda('zebro', textos)).toBe('Zebra')
  })

  it('sugiere con acentos aunque se escriba sin ellos', () => {
    expect(sugerenciaBusqueda('camaars', textos)).toBe('cámaras')
  })

  it('no sugiere nada si la consulta ya es una palabra del vocabulario', () => {
    expect(sugerenciaBusqueda('zebra', textos)).toBeNull()
  })

  it('no sugiere nada cuando no hay nada parecido', () => {
    expect(sugerenciaBusqueda('switch', textos)).toBeNull()
  })

  // Con 3 letras cualquier sugerencia es adivinar: "red" y "web" están a
  // distancia 2 y no significan lo mismo.
  it('no corrige consultas de menos de 4 letras', () => {
    expect(sugerenciaBusqueda('zeb', textos)).toBeNull()
    expect(sugerenciaBusqueda('red', ['Redes'])).toBeNull()
  })

  it('no corrige más allá de la tolerancia de su longitud', () => {
    // 5 letras toleran 1 error; "zebrra" -> "zebra" es 1, "zbrra" son 2.
    expect(sugerenciaBusqueda('zebrra', textos)).toBe('Zebra')
    expect(sugerenciaBusqueda('zzbrr', textos)).toBeNull()
  })

  it('con empate elige la más corta, para ser estable entre dispositivos', () => {
    const resultado = sugerenciaBusqueda('impresorb', ['Impresora', 'Impresoras'])
    expect(resultado).toBe('Impresora')
  })

  it('tolera un vocabulario vacío', () => {
    expect(sugerenciaBusqueda('zebbra', [])).toBeNull()
  })
})
