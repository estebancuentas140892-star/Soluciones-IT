import { describe, expect, it } from 'vitest'
import { claseDeNombre } from './claseVisual'

// LA CLASE VISUAL (tarea 350): el glifo y el color del «Icono de categoría»
// del prototipo de Claude Design salen del nombre que escribió el equipo.

describe('claseDeNombre', () => {
  it('reconoce las categorías de guías y las clases de equipos del prototipo', () => {
    expect(claseDeNombre('Software')).toBe('software')
    expect(claseDeNombre('Impresoras')).toBe('impresora')
    expect(claseDeNombre('POS')).toBe('pos')
    expect(claseDeNombre('Servidores')).toBe('servidor')
    expect(claseDeNombre('Redes')).toBe('red')
    expect(claseDeNombre('Puntos de red')).toBe('red')
    expect(claseDeNombre('Computadores')).toBe('computador')
    expect(claseDeNombre('Cámaras')).toBe('camara')
    expect(claseDeNombre('CCTV')).toBe('camara')
    expect(claseDeNombre('Switches')).toBe('switch')
    expect(claseDeNombre('Datáfonos')).toBe('datafono')
  })

  it('resuelve los nombres que se pisan por el orden de las reglas', () => {
    // "Punto de venta" es POS, no red; un datáfono de caja es un datáfono.
    expect(claseDeNombre('Punto de venta')).toBe('pos')
    expect(claseDeNombre('Datáfono de la caja')).toBe('datafono')
    // "credencial" contiene "red" pero no es la palabra.
    expect(claseDeNombre('Credenciales')).toBe('general')
  })

  it('lo que no reconoce, o no tiene nombre, es la clase general', () => {
    expect(claseDeNombre('Varios')).toBe('general')
    expect(claseDeNombre('')).toBe('general')
    expect(claseDeNombre(null)).toBe('general')
  })
})
