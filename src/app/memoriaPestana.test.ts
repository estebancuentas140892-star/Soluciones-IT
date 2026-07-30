import { beforeEach, describe, expect, it } from 'vitest'
import { RAICES_DE_PESTANA } from '../lib/navegacion'
import {
  destinoDePestana,
  olvidarTodo,
  raizQueContiene,
  recordarBusqueda,
} from './memoriaPestana'

const RAICES = RAICES_DE_PESTANA

beforeEach(() => {
  olvidarTodo()
})

describe('raizQueContiene', () => {
  it('cada raíz se contiene a sí misma', () => {
    for (const raiz of RAICES) {
      expect(raizQueContiene(raiz, RAICES)).toBe(raiz)
    }
  })

  it('una ficha interna cae en la raíz de su sección', () => {
    expect(raizQueContiene('/soluciones/impresoras/zebra', RAICES)).toBe('/soluciones')
    expect(raizQueContiene('/dispositivos/pc-1', RAICES)).toBe('/dispositivos')
  })

  it('"/" solo coincide exacta, aunque sea prefijo de todo', () => {
    expect(raizQueContiene('/', RAICES)).toBe('/')
    expect(raizQueContiene('/personas', RAICES)).toBeNull()
    expect(raizQueContiene('/diagnostico', RAICES)).toBeNull()
  })

  it('compara por segmento completo: /redes no está dentro de /red', () => {
    expect(raizQueContiene('/redes', RAICES)).toBeNull()
    expect(raizQueContiene('/red/topologia', RAICES)).toBe('/red')
  })

  it('normaliza la barra final', () => {
    expect(raizQueContiene('/soluciones/', RAICES)).toBe('/soluciones')
  })
})

describe('destinoDePestana', () => {
  it('sin nada recordado, el destino es la raíz pelada', () => {
    expect(destinoDePestana('/soluciones', '/', RAICES)).toBe('/soluciones')
  })

  it('estando fuera, devuelve la raíz con el último filtro (R20)', () => {
    recordarBusqueda('/soluciones', '?categoria=impresoras', RAICES)
    expect(destinoDePestana('/soluciones', '/', RAICES)).toBe('/soluciones?categoria=impresoras')
  })

  it('estando dentro, devuelve la raíz pelada: tocar la pestaña activa suelta el filtro', () => {
    recordarBusqueda('/soluciones', '?categoria=impresoras', RAICES)
    expect(destinoDePestana('/soluciones', '/soluciones', RAICES)).toBe('/soluciones')
    expect(destinoDePestana('/soluciones', '/soluciones/impresoras/zebra', RAICES)).toBe('/soluciones')
  })

  it('cada pestaña recuerda lo suyo', () => {
    recordarBusqueda('/soluciones', '?categoria=impresoras', RAICES)
    recordarBusqueda('/dispositivos', '?estado=fuera_de_servicio', RAICES)
    expect(destinoDePestana('/soluciones', '/', RAICES)).toBe('/soluciones?categoria=impresoras')
    expect(destinoDePestana('/dispositivos', '/', RAICES)).toBe('/dispositivos?estado=fuera_de_servicio')
    expect(destinoDePestana('/red', '/', RAICES)).toBe('/red')
  })

  it('quitar el filtro se recuerda igual que ponerlo', () => {
    recordarBusqueda('/soluciones', '?categoria=impresoras', RAICES)
    recordarBusqueda('/soluciones', '', RAICES)
    expect(destinoDePestana('/soluciones', '/', RAICES)).toBe('/soluciones')
  })
})

describe('recordarBusqueda', () => {
  it('solo recuerda la búsqueda de la raíz, no la de una ficha interna', () => {
    recordarBusqueda('/soluciones/impresoras/zebra', '?paso=3', RAICES)
    expect(destinoDePestana('/soluciones', '/', RAICES)).toBe('/soluciones')
  })

  it('ignora una ruta que no pertenece a ninguna pestaña', () => {
    recordarBusqueda('/personas', '?orden=nombre', RAICES)
    expect(destinoDePestana('/', '/soluciones', RAICES)).toBe('/')
  })
})
