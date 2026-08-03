import { describe, expect, it } from 'vitest'
import { conOrigen, leerOrigen } from './origenNavegacion'

describe('conOrigen', () => {
  it('arma el estado que viaja en el enlace', () => {
    expect(conOrigen('/escaner', 'Escáner')).toEqual({
      origen: { to: '/escaner', etiqueta: 'Escáner' },
    })
  })
})

describe('leerOrigen', () => {
  it('lee un origen bien formado', () => {
    expect(leerOrigen({ origen: { to: '/red/topologia/sw-1', etiqueta: 'Topología' } })).toEqual({
      to: '/red/topologia/sw-1',
      etiqueta: 'Topología',
    })
  })

  it('convive con otras claves del estado de navegación', () => {
    // `DispositivoPage` ya usa `location.state.recienCreado`; los dos
    // datos tienen que poder viajar juntos.
    const estado = { recienCreado: true, origen: { to: '/escaner', etiqueta: 'Escáner' } }
    expect(leerOrigen(estado)).toEqual({ to: '/escaner', etiqueta: 'Escáner' })
  })

  // El estado es un canal SIN TIPO que sobrevive a recargas del
  // historial: puede llegar de otra versión de la app o de otra
  // pantalla. Devolver null es lo que hace que quien llama caiga al
  // padre declarado, que siempre existe, en vez de quedarse sin salida.
  describe('cae a null ante cualquier cosa que no sea un origen usable', () => {
    it('sin estado', () => {
      expect(leerOrigen(null)).toBeNull()
      expect(leerOrigen(undefined)).toBeNull()
    })

    it('estado que no es un objeto', () => {
      expect(leerOrigen('escaner')).toBeNull()
      expect(leerOrigen(42)).toBeNull()
    })

    it('estado sin la clave origen', () => {
      expect(leerOrigen({ recienCreado: true })).toBeNull()
    })

    it('origen incompleto o con tipos equivocados', () => {
      expect(leerOrigen({ origen: { to: '/escaner' } })).toBeNull()
      expect(leerOrigen({ origen: { etiqueta: 'Escáner' } })).toBeNull()
      expect(leerOrigen({ origen: { to: 7, etiqueta: 'Escáner' } })).toBeNull()
      expect(leerOrigen({ origen: null })).toBeNull()
    })

    it('cadenas vacías o en blanco', () => {
      // Un regreso a "" dejaría la pantalla sin salida, y una etiqueta
      // en blanco dejaría el ancla de contexto mudo.
      expect(leerOrigen({ origen: { to: '', etiqueta: 'Escáner' } })).toBeNull()
      expect(leerOrigen({ origen: { to: '/escaner', etiqueta: '   ' } })).toBeNull()
    })
  })
})
