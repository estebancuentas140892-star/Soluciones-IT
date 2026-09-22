import { describe, expect, it } from 'vitest'
import { destinoPrincipalDe, esRaizDePestana, padreDe, vueltaDeTarea } from './navegacion'

describe('padreDe', () => {
  // Encargo del 2026-09-22: Resolver, Equipos, Bóveda y Más.
  it('los cuatro destinos principales no tienen pantalla superior', () => {
    for (const tab of ['/', '/dispositivos', '/boveda', '/mas']) {
      expect(padreDe(tab)).toBeNull()
    }
  })

  it('normaliza barras finales', () => {
    expect(padreDe('/mas/')).toBeNull()
    expect(padreDe('/dispositivos/cam-1/')).toEqual({ to: '/dispositivos', etiqueta: 'Equipos' })
  })

  it('el catálogo de guías y la agenda cuelgan de Resolver', () => {
    expect(padreDe('/soluciones')).toEqual({ to: '/', etiqueta: 'Resolver' })
    expect(padreDe('/soluciones/')).toEqual({ to: '/', etiqueta: 'Resolver' })
    expect(padreDe('/agenda')).toEqual({ to: '/', etiqueta: 'Resolver' })
    expect(padreDe('/conectar')).toEqual({ to: '/', etiqueta: 'Resolver' })
  })

  it('lo que no tiene padre declarado sube a Resolver, nunca a una pantalla que ya no existe', () => {
    expect(padreDe('/una-ruta-desconocida')).toEqual({ to: '/', etiqueta: 'Resolver' })
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

  describe('Diagnóstico (se alcanza desde Más, Herramientas)', () => {
    it('la lista sube a Más', () => {
      expect(padreDe('/diagnostico')).toEqual({ to: '/mas', etiqueta: 'Más' })
    })

    it('nuevo, editar, sugerencias y el asistente vuelven a la lista de diagnósticos', () => {
      const lista = { to: '/diagnostico', etiqueta: 'Diagnósticos' }
      expect(padreDe('/diagnostico/nuevo')).toEqual(lista)
      expect(padreDe('/diagnostico/diag-1/editar')).toEqual(lista)
      expect(padreDe('/diagnostico/sugerencias')).toEqual(lista)
      expect(padreDe('/diagnostico/diag-1')).toEqual(lista)
    })
  })

  describe('Escáner (otra forma de buscar un equipo)', () => {
    it('sube a Equipos', () => {
      expect(padreDe('/escaner')).toEqual({ to: '/dispositivos', etiqueta: 'Equipos' })
    })
  })

  describe('Red (Más, Infraestructura)', () => {
    it('Red deja de ser raíz de pestaña y sube a Más', () => {
      expect(padreDe('/red')).toEqual({ to: '/mas', etiqueta: 'Más' })
    })

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
    it('Mi cuenta sube a Más, donde está su puerta', () => {
      expect(padreDe('/cuenta')).toEqual({ to: '/mas', etiqueta: 'Más' })
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
    expect(vueltaDeTarea('/dispositivos')).toBeNull()
    expect(vueltaDeTarea('/')).toBeNull()
  })

  it('el catálogo de guías nombra Resolver, que es a donde sube', () => {
    expect(vueltaDeTarea('/soluciones')).toBe('Resolver')
  })
})

describe('esRaizDePestana', () => {
  it('los cuatro destinos principales lo son', () => {
    for (const tab of ['/', '/dispositivos', '/boveda', '/mas']) {
      expect(esRaizDePestana(tab)).toBe(true)
    }
  })

  it('normaliza la barra final', () => {
    expect(esRaizDePestana('/mas/')).toBe(true)
  })

  it('el catálogo de guías y Red ya no son raíces', () => {
    expect(esRaizDePestana('/soluciones')).toBe(false)
    expect(esRaizDePestana('/red')).toBe(false)
  })

  it('una ficha o lista interna no es una raíz', () => {
    expect(esRaizDePestana('/soluciones/cat-1')).toBe(false)
    expect(esRaizDePestana('/dispositivos/pc-1')).toBe(false)
    expect(esRaizDePestana('/diagnostico')).toBe(false)
  })
})

// Encargo del 2026-09-22: Resolver, Equipos, Bóveda y Más, en el teléfono
// y en la barra lateral por igual.
describe('destinoPrincipalDe', () => {
  it('Resolver cubre su agenda, el catálogo, la guía en ejecución y el emparejamiento', () => {
    for (const ruta of [
      '/',
      '/agenda',
      '/conectar',
      '/soluciones',
      '/soluciones/cat-pos',
      '/soluciones/cat-pos/art-1',
      '/soluciones/cat-pos/art-1/detalles',
      '/soluciones/cat-pos/art-1/editar',
    ]) {
      expect(destinoPrincipalDe(ruta)).toBe('/')
    }
  })

  it('Equipos cubre sus fichas y el escáner', () => {
    for (const ruta of ['/dispositivos', '/dispositivos/pc-1', '/dispositivos/pc-1/editar', '/escaner']) {
      expect(destinoPrincipalDe(ruta)).toBe('/dispositivos')
    }
  })

  it('la Bóveda es su propio destino', () => {
    for (const ruta of ['/boveda', '/boveda/cred-1', '/boveda/nueva']) {
      expect(destinoPrincipalDe(ruta)).toBe('/boveda')
    }
  })

  it('lo que se abre desde Más ilumina Más: Red, consulta, herramientas y cuenta', () => {
    for (const ruta of [
      '/mas',
      '/red',
      '/red/topologia',
      '/referencia',
      '/referencia/ref-1',
      '/ubicaciones',
      '/personas/per-1',
      '/diagnostico',
      '/cuenta',
      '/cuenta/seguridad',
    ]) {
      expect(destinoPrincipalDe(ruta)).toBe('/mas')
    }
  })

  it('compara por segmento completo: /solucionesx no es Resolver', () => {
    expect(destinoPrincipalDe('/solucionesx')).toBe('/mas')
    expect(destinoPrincipalDe('/bovedas')).toBe('/mas')
  })
})
