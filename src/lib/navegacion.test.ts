import { describe, expect, it } from 'vitest'
import { padreDe } from './navegacion'

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

    it('editar y ejecutar vuelven a la ficha del artículo', () => {
      const ficha = { to: '/soluciones/cat-pos/art-1', etiqueta: 'Volver' }
      expect(padreDe('/soluciones/cat-pos/art-1/editar')).toEqual(ficha)
      expect(padreDe('/soluciones/cat-pos/art-1/ejecutar')).toEqual(ficha)
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
