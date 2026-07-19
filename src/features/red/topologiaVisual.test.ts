import { describe, expect, it } from 'vitest'
import { claseEstado, detalleDeNodo, estadoConEtiqueta, tipoDeNodoVisual } from './topologiaVisual'

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

  it('reconoce UPS (categoría del diseño de Red, no está en el esquema por defecto)', () => {
    expect(tipoDeNodoVisual('UPS')).toBe('ups')
    expect(tipoDeNodoVisual('Reguladores')).toBe('ups')
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

describe('estadoConEtiqueta', () => {
  it('normaliza los estados sugeridos a su etiqueta canónica, sin importar mayúsculas', () => {
    expect(estadoConEtiqueta('Operativo').etiqueta).toBe('Operativo')
    expect(estadoConEtiqueta('operativo').etiqueta).toBe('Operativo')
    expect(estadoConEtiqueta('OPERATIVO').etiqueta).toBe('Operativo')
    expect(estadoConEtiqueta('en mantenimiento').etiqueta).toBe('En mantenimiento')
    expect(estadoConEtiqueta('fuera de servicio').etiqueta).toBe('Fuera de servicio')
    expect(estadoConEtiqueta('de baja').etiqueta).toBe('De baja')
  })

  it('conserva tal cual un estado libre desconocido', () => {
    expect(estadoConEtiqueta('Prestado a bodega').etiqueta).toBe('Prestado a bodega')
  })

  it('marca "Sin estado" cuando el estado viene vacío', () => {
    expect(estadoConEtiqueta('').etiqueta).toBe('Sin estado')
    expect(estadoConEtiqueta('   ').etiqueta).toBe('Sin estado')
  })
})

describe('claseEstado', () => {
  it('mapea cada etiqueta canónica a su color Nocturne', () => {
    expect(claseEstado('Operativo')).toBe('text-noct-exito')
    expect(claseEstado('En mantenimiento')).toBe('text-noct-precaucion')
    expect(claseEstado('Fuera de servicio')).toBe('text-noct-error')
    expect(claseEstado('De baja')).toBe('text-noct-neutral-500')
  })

  it('es insensible a mayúsculas y cae a neutro con un estado libre', () => {
    expect(claseEstado('OPERATIVO')).toBe('text-noct-exito')
    expect(claseEstado('Prestado a bodega')).toBe('text-noct-neutral-500')
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
