import { beforeEach, describe, expect, it } from 'vitest'
import { RAICES_DE_PESTANA } from '../lib/navegacion'
import {
  destinoDePestana,
  olvidarTodo,
  RAICES_CON_MEMORIA,
  raizQueContiene,
  recordarBusqueda,
} from './memoriaPestana'

// El algoritmo se prueba con una lista de seis raíces (la que tuvo la app
// hasta el 2026-09-22) porque ejercita más casos: raíces con fichas
// internas, una raíz que es prefijo de otra ruta (`/red` y `/redes`).
// Las funciones reciben las raíces, así que no dependen de la navegación
// vigente; la de la app se comprueba aparte, abajo.
const RAICES = ['/soluciones', '/dispositivos', '/red', '/boveda', '/mas', '/']

beforeEach(() => {
  olvidarTodo()
})

describe('las raíces de la app (encargo del 2026-09-22)', () => {
  it('son los cuatro destinos principales, con "/" al final', () => {
    expect(RAICES_DE_PESTANA).toEqual(['/dispositivos', '/boveda', '/mas', '/'])
  })

  it('una guía y el catálogo caen en Resolver, que no recuerda filtro: su raíz es "/" exacta', () => {
    expect(raizQueContiene('/soluciones', RAICES_DE_PESTANA)).toBeNull()
    expect(raizQueContiene('/dispositivos/pc-1', RAICES_DE_PESTANA)).toBe('/dispositivos')
  })
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

// Tarea 257: Red dejó de ser pestaña en la 254 y con eso perdió, sin que
// nadie lo notara, la memoria de su nodo. Su puerta cambia (una fila de
// Más), su comportamiento no: vuelve a recordar.
describe('Red recuerda su nodo aunque ya no sea pestaña (tarea 257)', () => {
  it('las raíces con memoria son las de las pestañas más /red, y /red sigue sin ser pestaña', () => {
    expect(RAICES_CON_MEMORIA).toEqual([...RAICES_DE_PESTANA, '/red'])
    expect(RAICES_DE_PESTANA).not.toContain('/red')
  })

  it('el nodo que se recorría en /red vuelve por la fila de Más', () => {
    recordarBusqueda('/red', '?nodo=sw-bodega', RAICES_CON_MEMORIA)
    expect(destinoDePestana('/red', '/mas', RAICES_CON_MEMORIA)).toBe('/red?nodo=sw-bodega')
  })

  it('una pantalla interna de Red (la lista de equipos) no pisa el nodo', () => {
    recordarBusqueda('/red', '?nodo=sw-bodega', RAICES_CON_MEMORIA)
    recordarBusqueda('/red/equipos', '?buscar=1', RAICES_CON_MEMORIA)
    expect(destinoDePestana('/red', '/mas', RAICES_CON_MEMORIA)).toBe('/red?nodo=sw-bodega')
  })

  it('las pestañas no cambian: tocar Más desde Red lleva a /mas, no al nodo', () => {
    recordarBusqueda('/red', '?nodo=sw-bodega', RAICES_CON_MEMORIA)
    expect(destinoDePestana('/mas', '/red', RAICES_DE_PESTANA)).toBe('/mas')
  })
})
