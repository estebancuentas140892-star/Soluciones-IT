import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { codigosLeidos, registrarCodigoLeido, reiniciarConteo } from './sesionEscaneo'

// Las pruebas corren en Node (ver `vite.config.ts`), donde no hay
// `sessionStorage`. Se sustituye por uno en memoria con la misma
// interfaz, para probar la lógica real y no un doble de ella.
function almacenEnMemoria() {
  const datos = new Map<string, string>()
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
    clear: () => datos.clear(),
  }
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', almacenEnMemoria())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sesión de escaneo', () => {
  it('empieza vacía', () => {
    expect(codigosLeidos()).toEqual([])
  })

  it('cuenta los códigos resueltos', () => {
    expect(registrarCodigoLeido('MP-001')).toEqual(['MP-001'])
    expect(registrarCodigoLeido('MP-002')).toEqual(['MP-001', 'MP-002'])
    expect(codigosLeidos()).toEqual(['MP-001', 'MP-002'])
  })

  it('apuntar dos veces a la misma etiqueta no suma dos equipos', () => {
    registrarCodigoLeido('MP-001')
    expect(registrarCodigoLeido('MP-001')).toEqual(['MP-001'])
  })

  it('el conteo se reinicia solo cuando el técnico lo pide', () => {
    registrarCodigoLeido('MP-001')
    registrarCodigoLeido('MP-002')
    expect(reiniciarConteo()).toEqual([])
    expect(codigosLeidos()).toEqual([])
  })

  // Es la razón por la que el mecanismo del marcador se descartó: leer
  // el conteo tiene que poder ocurrir en un inicializador de estado o en
  // un render, y React invoca los dos DOS VECES en desarrollo. Si leer
  // tuviera efectos, contador y almacenamiento acabarían diciendo cosas
  // distintas, que fue justo lo que se midió en el navegador.
  it('leer el conteo no lo altera, por muchas veces que se llame', () => {
    registrarCodigoLeido('MP-001')
    expect(codigosLeidos()).toEqual(['MP-001'])
    expect(codigosLeidos()).toEqual(['MP-001'])
    expect(codigosLeidos()).toEqual(['MP-001'])
  })

  it('ignora un contenido corrupto en vez de fallar', () => {
    sessionStorage.setItem('escaner:codigos-leidos', 'esto no es json')
    expect(codigosLeidos()).toEqual([])
    expect(registrarCodigoLeido('MP-001')).toEqual(['MP-001'])
  })

  // El contador es un adorno útil, nunca un motivo para que el escáner
  // deje de escanear: en modo privado o con la cuota llena el
  // almacenamiento no existe o lanza.
  it('sin almacenamiento disponible no rompe nada', () => {
    vi.stubGlobal('sessionStorage', undefined)
    expect(codigosLeidos()).toEqual([])
    expect(registrarCodigoLeido('MP-001')).toEqual(['MP-001'])
    expect(reiniciarConteo()).toEqual([])
  })
})
