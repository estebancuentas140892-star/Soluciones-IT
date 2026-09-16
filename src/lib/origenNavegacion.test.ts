import { describe, expect, it } from 'vitest'
import {
  anotarBusqueda,
  conOrigen,
  estadoDeRegreso,
  leerBusquedaRestaurada,
  leerOrigen,
  sinBusqueda,
} from './origenNavegacion'

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

// LA BÚSQUEDA VUELVE CON EL ORIGEN (encargo del 2026-09-16, sección 13).
// Viaja por el mismo canal sin tipo que el origen, así que se valida con
// el mismo cuidado: una búsqueda rota no puede dejar a nadie sin regreso.
describe('la búsqueda que viaja con el origen', () => {
  const busqueda = { consulta: 'servidor', capa: false }

  it('conOrigen la lleva cuando el salto sale de un buscador', () => {
    expect(conOrigen('/', 'la búsqueda', busqueda)).toEqual({
      origen: { to: '/', etiqueta: 'la búsqueda', busqueda },
    })
  })

  it('leerOrigen la devuelve junto al origen', () => {
    const capa = { consulta: 'zabbix', capa: true }
    expect(leerOrigen({ origen: { to: '/red', etiqueta: 'la búsqueda', busqueda: capa } })).toEqual({
      to: '/red',
      etiqueta: 'la búsqueda',
      busqueda: capa,
    })
  })

  it('una búsqueda mal formada no invalida el origen: se vuelve igual, sin reponer nada', () => {
    const rotas = [
      { consulta: '', capa: true },
      { consulta: '   ', capa: false },
      { consulta: 7, capa: true },
      { consulta: 'x' },
      'x',
      null,
    ]
    for (const rota of rotas) {
      expect(leerOrigen({ origen: { to: '/', etiqueta: 'la búsqueda', busqueda: rota } })).toEqual({
        to: '/',
        etiqueta: 'la búsqueda',
      })
    }
  })

  it('estadoDeRegreso entrega la búsqueda al regreso, y nada si no hubo búsqueda', () => {
    expect(estadoDeRegreso({ to: '/', etiqueta: 'la búsqueda', busqueda })).toEqual({ busqueda })
    expect(estadoDeRegreso({ to: '/escaner', etiqueta: 'Escáner' })).toBeUndefined()
    expect(estadoDeRegreso(null)).toBeUndefined()
  })

  it('leerBusquedaRestaurada lee lo que trae el regreso, y null ante cualquier otra cosa', () => {
    expect(leerBusquedaRestaurada({ busqueda })).toEqual(busqueda)
    expect(leerBusquedaRestaurada({ busqueda: { consulta: 'zabbix', capa: 'si' } })).toBeNull()
    expect(leerBusquedaRestaurada({ origen: { to: '/', etiqueta: 'x' } })).toBeNull()
    expect(leerBusquedaRestaurada(null)).toBeNull()
    expect(leerBusquedaRestaurada('servidor')).toBeNull()
  })

  it('anotarBusqueda conserva lo que la entrada ya llevaba (su propio origen)', () => {
    const origen = { to: '/escaner', etiqueta: 'Escáner' }
    expect(anotarBusqueda({ origen }, busqueda)).toEqual({ origen, busqueda })
    expect(anotarBusqueda(null, busqueda)).toEqual({ busqueda })
  })

  it('sinBusqueda la quita y conserva el resto', () => {
    const origen = { to: '/escaner', etiqueta: 'Escáner' }
    expect(sinBusqueda({ origen, busqueda })).toEqual({ origen })
    expect(sinBusqueda({ busqueda })).toBeNull()
    expect(sinBusqueda(null)).toBeNull()
  })

  it('solo guarda lo que se tecleó y si la capa estaba abierta: nada más viaja', () => {
    const estado = conOrigen('/', 'la búsqueda', busqueda)
    expect(Object.keys(estado.origen?.busqueda ?? {}).sort()).toEqual(['capa', 'consulta'])
  })
})
