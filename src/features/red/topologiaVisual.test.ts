import { describe, expect, it } from 'vitest'
import { detalleDeNodo, puntoDeEstado, tipoDeNodoVisual } from './topologiaVisual'

describe('tipoDeNodoVisual', () => {
  it('reconoce las categorías iniciales reales del esquema', () => {
    expect(tipoDeNodoVisual('Racks')).toBe('rack')
    expect(tipoDeNodoVisual('Switches')).toBe('switch')
    expect(tipoDeNodoVisual('Cámaras')).toBe('camara')
    expect(tipoDeNodoVisual('CCTV')).toBe('camara')
    expect(tipoDeNodoVisual('Impresoras')).toBe('impresora')
    expect(tipoDeNodoVisual('Servidores')).toBe('servidor')
    expect(tipoDeNodoVisual('Access Points')).toBe('ap')
    expect(tipoDeNodoVisual('POS')).toBe('pos')
    expect(tipoDeNodoVisual('Puntos de red')).toBe('punto')
    expect(tipoDeNodoVisual('Computadores')).toBe('pc')
    expect(tipoDeNodoVisual('Redes')).toBe('router')
  })

  it('no confunde substrings: "Puntos de red" no es POS ni router', () => {
    // "puntos" contiene "pos"? no; y aunque contiene "red", la regla
    // de punto va antes que la de router.
    expect(tipoDeNodoVisual('Puntos de red')).toBe('punto')
    // "Dispositivos" contiene "pos" como substring pero no como palabra.
    expect(tipoDeNodoVisual('Dispositivos varios')).toBe('generico')
  })

  it('es insensible a mayúsculas y acentos', () => {
    expect(tipoDeNodoVisual('cámaras')).toBe('camara')
    expect(tipoDeNodoVisual('CAMARAS')).toBe('camara')
    expect(tipoDeNodoVisual('punto de venta')).toBe('pos')
    expect(tipoDeNodoVisual('Puntos de Venta')).toBe('pos')
  })

  it('cae al icono genérico con una categoría vacía o desconocida', () => {
    expect(tipoDeNodoVisual('')).toBe('generico')
    expect(tipoDeNodoVisual('Telefonía')).toBe('generico')
  })
})

describe('puntoDeEstado', () => {
  it('asigna el color de cada estado sugerido, sin importar mayúsculas', () => {
    expect(puntoDeEstado('Operativo').clase).toBe('bg-green-600')
    expect(puntoDeEstado('operativo').clase).toBe('bg-green-600')
    expect(puntoDeEstado('En mantenimiento').clase).toBe('bg-amber-600')
    expect(puntoDeEstado('Fuera de servicio').clase).toBe('bg-red-600')
    expect(puntoDeEstado('De baja').clase).toBe('bg-zinc-500')
  })

  it('usa gris neutro y conserva el texto en estados desconocidos', () => {
    const punto = puntoDeEstado('Prestado a bodega')
    expect(punto.clase).toBe('bg-zinc-300')
    expect(punto.titulo).toBe('Prestado a bodega')
  })

  it('marca "Sin estado" cuando el estado viene vacío', () => {
    expect(puntoDeEstado('').titulo).toBe('Sin estado')
    expect(puntoDeEstado('').clase).toBe('bg-zinc-300')
  })
})

describe('detalleDeNodo', () => {
  it('une categoría, marca y modelo, via y medio con puntos medios', () => {
    expect(
      detalleDeNodo({ categoria: 'Impresoras', marcaModelo: 'Zebra ZT411', via: 'Puerto 3', medio: 'UTP' }),
    ).toBe('Impresoras · Zebra ZT411 · Puerto 3 · UTP')
  })

  it('omite las partes vacías', () => {
    expect(detalleDeNodo({ categoria: 'Racks' })).toBe('Racks')
    expect(detalleDeNodo({ via: 'Instalado' })).toBe('Instalado')
    expect(detalleDeNodo({})).toBe('')
  })

  it('no repite el medio cuando la via ya es el medio (enlace sin puerto)', () => {
    expect(detalleDeNodo({ categoria: 'Switches', via: 'Fibra óptica', medio: 'fibra óptica' })).toBe(
      'Switches · Fibra óptica',
    )
  })
})
