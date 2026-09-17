import { describe, expect, it } from 'vitest'
import { esRaizDePestana, esSeccionEnMas, padreDe, pestanaMovilDe, vueltaDeTarea } from './navegacion'

describe('padreDe', () => {
  it('las pestañas de la barra no tienen pantalla superior', () => {
    for (const tab of ['/', '/soluciones', '/dispositivos', '/red', '/boveda', '/mas']) {
      expect(padreDe(tab)).toBeNull()
    }
  })

  it('normaliza barras finales', () => {
    expect(padreDe('/soluciones/')).toBeNull()
    expect(padreDe('/dispositivos/cam-1/')).toEqual({ to: '/dispositivos', etiqueta: 'Equipos' })
  })

  describe('Guías: la categoría es un filtro de la lista', () => {
    it('la ficha de artículo vuelve a la lista con su chip de categoría', () => {
      expect(padreDe('/soluciones/cat-pos/art-1')).toEqual({
        to: '/soluciones?categoria=cat-pos',
        etiqueta: 'Guías',
      })
    })

    it('crear artículo vuelve a la lista con su chip', () => {
      expect(padreDe('/soluciones/cat-pos/nuevo')).toEqual({
        to: '/soluciones?categoria=cat-pos',
        etiqueta: 'Guías',
      })
    })

    // Encargo del 2026-09-17: la dirección de la guía es su ejecución y
    // la ficha baja a /detalles.
    it('editar vuelve a la ficha de la guía, que vive en /detalles', () => {
      expect(padreDe('/soluciones/cat-pos/art-1/editar')).toEqual({
        to: '/soluciones/cat-pos/art-1/detalles',
        etiqueta: 'Volver',
      })
    })

    it('los detalles vuelven a la guía', () => {
      expect(padreDe('/soluciones/cat-pos/art-1/detalles')).toEqual({
        to: '/soluciones/cat-pos/art-1',
        etiqueta: 'Guía',
      })
    })

    it('la dirección antigua /ejecutar sube como la guía, a la lista con su chip', () => {
      expect(padreDe('/soluciones/cat-pos/art-1/ejecutar')).toEqual({
        to: '/soluciones?categoria=cat-pos',
        etiqueta: 'Guías',
      })
    })

    it('la ficha de categoría vuelve a la lista principal (sin chip), no a sí misma', () => {
      expect(padreDe('/soluciones/cat-pos')).toEqual({ to: '/soluciones', etiqueta: 'Guías' })
    })

    it('nunca devuelve la CategoriaPage como destino de una ficha de artículo', () => {
      expect(padreDe('/soluciones/cat-pos/art-1')?.to).not.toBe('/soluciones/cat-pos')
    })
  })

  describe('Equipos', () => {
    it('nuevo, importar, etiquetas y la ficha vuelven a la lista', () => {
      const lista = { to: '/dispositivos', etiqueta: 'Equipos' }
      expect(padreDe('/dispositivos/nuevo')).toEqual(lista)
      expect(padreDe('/dispositivos/importar')).toEqual(lista)
      expect(padreDe('/dispositivos/etiquetas')).toEqual(lista)
      expect(padreDe('/dispositivos/cam-1')).toEqual(lista)
    })

    it('editar vuelve a la ficha del dispositivo', () => {
      expect(padreDe('/dispositivos/cam-1/editar')).toEqual({
        to: '/dispositivos/cam-1',
        etiqueta: 'Volver',
      })
    })

    it('dar de baja (hallazgo L1) vuelve a la ficha del dispositivo', () => {
      expect(padreDe('/dispositivos/cam-1/baja')).toEqual({
        to: '/dispositivos/cam-1',
        etiqueta: 'Volver',
      })
    })

    it('reemplazo (hallazgos L2/L3) vuelve a la ficha del dispositivo', () => {
      expect(padreDe('/dispositivos/cam-1/reemplazo')).toEqual({
        to: '/dispositivos/cam-1',
        etiqueta: 'Volver',
      })
    })
  })

  describe('Ubicaciones (se alcanza desde "Más", tarea 182)', () => {
    it('la lista de ubicaciones sube a Más, no a Equipos', () => {
      expect(padreDe('/ubicaciones')).toEqual({ to: '/mas', etiqueta: 'Más' })
    })

    it('nueva, migrar y la ficha vuelven a la lista de ubicaciones', () => {
      const lista = { to: '/ubicaciones', etiqueta: 'Ubicaciones' }
      expect(padreDe('/ubicaciones/nueva')).toEqual(lista)
      expect(padreDe('/ubicaciones/migrar')).toEqual(lista)
      expect(padreDe('/ubicaciones/ubi-1')).toEqual(lista)
    })

    it('editar vuelve a la ficha de la ubicación', () => {
      expect(padreDe('/ubicaciones/ubi-1/editar')).toEqual({
        to: '/ubicaciones/ubi-1',
        etiqueta: 'Volver',
      })
    })
  })

  describe('Personas (se alcanza desde "Más", tarea 182)', () => {
    it('la lista de personas sube a Más, no a Equipos', () => {
      expect(padreDe('/personas')).toEqual({ to: '/mas', etiqueta: 'Más' })
    })

    it('nueva, migrar y la ficha vuelven a la lista de personas', () => {
      const lista = { to: '/personas', etiqueta: 'Personas' }
      expect(padreDe('/personas/nueva')).toEqual(lista)
      expect(padreDe('/personas/migrar')).toEqual(lista)
      expect(padreDe('/personas/per-1')).toEqual(lista)
    })

    it('editar vuelve a la ficha de la persona', () => {
      expect(padreDe('/personas/per-1/editar')).toEqual({
        to: '/personas/per-1',
        etiqueta: 'Volver',
      })
    })
  })

  describe('Centro de consulta (ruta /referencia, se alcanza desde "Más")', () => {
    it('la lista sube a Más', () => {
      expect(padreDe('/referencia')).toEqual({ to: '/mas', etiqueta: 'Más' })
    })

    it('nueva y la ficha vuelven a la lista, nombrada como la ve el técnico', () => {
      const lista = { to: '/referencia', etiqueta: 'Centro de consulta' }
      expect(padreDe('/referencia/nueva')).toEqual(lista)
      expect(padreDe('/referencia/ref-1')).toEqual(lista)
      expect(vueltaDeTarea('/referencia/nueva')).toBe('Centro de consulta')
    })

    it('editar vuelve a la ficha', () => {
      expect(padreDe('/referencia/ref-1/editar')).toEqual({ to: '/referencia/ref-1', etiqueta: 'Volver' })
    })
  })

  describe('Bóveda', () => {
    it('nueva y la ficha vuelven a la lista', () => {
      const lista = { to: '/boveda', etiqueta: 'Bóveda' }
      expect(padreDe('/boveda/nueva')).toEqual(lista)
      expect(padreDe('/boveda/cred-1')).toEqual(lista)
    })

    it('editar vuelve a la ficha de la credencial', () => {
      expect(padreDe('/boveda/cred-1/editar')).toEqual({ to: '/boveda/cred-1', etiqueta: 'Volver' })
    })
  })

  describe('Diagnóstico (se alcanza desde Inicio)', () => {
    it('la lista sube a Inicio', () => {
      expect(padreDe('/diagnostico')).toEqual({ to: '/', etiqueta: 'Inicio' })
    })

    it('nuevo, editar, sugerencias y el asistente vuelven a la lista de diagnósticos', () => {
      const lista = { to: '/diagnostico', etiqueta: 'Diagnósticos' }
      expect(padreDe('/diagnostico/nuevo')).toEqual(lista)
      expect(padreDe('/diagnostico/diag-1/editar')).toEqual(lista)
      expect(padreDe('/diagnostico/sugerencias')).toEqual(lista)
      expect(padreDe('/diagnostico/diag-1')).toEqual(lista)
    })
  })

  describe('Escáner (se alcanza desde Inicio)', () => {
    it('sube a Inicio', () => {
      expect(padreDe('/escaner')).toEqual({ to: '/', etiqueta: 'Inicio' })
    })
  })

  describe('Red', () => {
    it('la topología general vuelve a Red', () => {
      expect(padreDe('/red/topologia')).toEqual({ to: '/red', etiqueta: 'Red' })
    })

    it('la topología de un equipo sube al mapa general', () => {
      expect(padreDe('/red/topologia/sw-1')).toEqual({ to: '/red/topologia', etiqueta: 'Topología' })
    })

    // Desde la tarea 204 la raíz de la pestaña es el recorrido por
    // nodos, y la lista de equipos cuelga de ella (hallazgo M-018).
    it('la lista de equipos de red vuelve a Red', () => {
      expect(padreDe('/red/equipos')).toEqual({ to: '/red', etiqueta: 'Red' })
    })
  })

  describe('Cuenta', () => {
    it('Mi cuenta sube a Inicio', () => {
      expect(padreDe('/cuenta')).toEqual({ to: '/', etiqueta: 'Inicio' })
    })

    it('Seguridad sube a Mi cuenta', () => {
      expect(padreDe('/cuenta/seguridad')).toEqual({ to: '/cuenta', etiqueta: 'Mi cuenta' })
    })
  })
})

// La barra de tarea (nivel 3 del chasis, tarea 185) es la única que
// puede quitar las pestañas, así que tiene que escribir a dónde vuelve
// (R19). Esta función dice cuándo la jerarquía basta y cuándo la
// pantalla debe poner su propio texto.
describe('vueltaDeTarea', () => {
  it('usa la etiqueta del padre cuando esta nombra su destino', () => {
    expect(vueltaDeTarea('/dispositivos/nuevo')).toBe('Equipos')
    expect(vueltaDeTarea('/soluciones/impresoras/nuevo')).toBe('Guías')
    expect(vueltaDeTarea('/boveda/nueva')).toBe('Bóveda')
    expect(vueltaDeTarea('/diagnostico/nuevo')).toBe('Diagnósticos')
    expect(vueltaDeTarea('/personas/nueva')).toBe('Personas')
    expect(vueltaDeTarea('/ubicaciones/nueva')).toBe('Ubicaciones')
  })

  it('devuelve null donde el padre solo sabe decir "Volver"', () => {
    // Editar sube a la ficha de una entidad cuyo nombre depende de datos
    // en runtime: ahí escribe la pantalla.
    expect(vueltaDeTarea('/soluciones/impresoras/zebra/editar')).toBeNull()
    expect(vueltaDeTarea('/dispositivos/pc-1/editar')).toBeNull()
    expect(vueltaDeTarea('/dispositivos/pc-1/baja')).toBeNull()
    expect(vueltaDeTarea('/boveda/wifi/editar')).toBeNull()
  })

  it('devuelve null en una raíz, que no tiene a dónde volver', () => {
    expect(vueltaDeTarea('/soluciones')).toBeNull()
  })
})

describe('esRaizDePestana', () => {
  it('las seis raíces (pestañas móviles y de escritorio) lo son', () => {
    for (const tab of ['/', '/soluciones', '/dispositivos', '/red', '/boveda', '/mas']) {
      expect(esRaizDePestana(tab)).toBe(true)
    }
  })

  it('normaliza la barra final', () => {
    expect(esRaizDePestana('/soluciones/')).toBe(true)
  })

  it('una ficha o lista interna no es una raíz', () => {
    expect(esRaizDePestana('/soluciones/cat-1')).toBe(false)
    expect(esRaizDePestana('/dispositivos/pc-1')).toBe(false)
    expect(esRaizDePestana('/diagnostico')).toBe(false)
  })
})

// Encargo del 2026-09-17: en el teléfono, Inicio, Guías y Más.
describe('pestanaMovilDe', () => {
  it('Inicio cubre también su agenda', () => {
    expect(pestanaMovilDe('/')).toBe('/')
    expect(pestanaMovilDe('/agenda')).toBe('/')
  })

  it('Guías cubre todo lo que cuelga de /soluciones, la guía en ejecución incluida', () => {
    expect(pestanaMovilDe('/soluciones')).toBe('/soluciones')
    expect(pestanaMovilDe('/soluciones/cat-pos/art-1')).toBe('/soluciones')
    expect(pestanaMovilDe('/soluciones/cat-pos/art-1/detalles')).toBe('/soluciones')
  })

  it('lo que se abre desde Más ilumina Más, también Equipos, Red y la Bóveda', () => {
    for (const ruta of ['/mas', '/dispositivos', '/dispositivos/pc-1', '/red', '/boveda', '/referencia', '/personas']) {
      expect(pestanaMovilDe(ruta)).toBe('/mas')
    }
  })
})

describe('esSeccionEnMas', () => {
  it('Equipos, Red y la Bóveda, en su raíz, se abren desde Más', () => {
    for (const ruta of ['/dispositivos', '/red', '/boveda', '/red/']) {
      expect(esSeccionEnMas(ruta)).toBe(true)
    }
  })

  it('ni sus fichas ni las pestañas que quedan lo son', () => {
    for (const ruta of ['/', '/soluciones', '/mas', '/dispositivos/pc-1']) {
      expect(esSeccionEnMas(ruta)).toBe(false)
    }
  })
})
