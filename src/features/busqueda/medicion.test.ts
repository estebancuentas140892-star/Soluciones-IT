import { describe, expect, it } from 'vitest'
import { eventoDeResolucion, INTERACCIONES_BASE, registrarResolucion } from './medicion'

// La medicion del recorrido (tarea 241, seccion 17). La prueba que
// importa no es que cuente bien: es que NO lleve nada sensible.

describe('eventoDeResolucion', () => {
  const datos = {
    accion: 'copiar_credencial' as const,
    tipo: 'credencial' as const,
    desdeMejores: true,
    consulta: 'administrador POS',
  }

  it('cuenta dos interacciones: escribir y tocar la acción', () => {
    expect(eventoDeResolucion(datos).interacciones).toBe(INTERACCIONES_BASE)
  })

  it('cuenta una más cuando hubo que desbloquear la bóveda por el camino', () => {
    expect(eventoDeResolucion({ ...datos, huboDesbloqueo: true }).interacciones).toBe(
      INTERACCIONES_BASE + 1,
    )
  })

  it('de la consulta solo viaja su longitud, nunca su texto', () => {
    const evento = eventoDeResolucion(datos)
    expect(evento.longitudConsulta).toBe('administrador POS'.length)
    expect(JSON.stringify(evento)).not.toContain('administrador')
  })

  it('la longitud no cuenta los espacios de los extremos', () => {
    expect(eventoDeResolucion({ ...datos, consulta: '  ping  ' }).longitudConsulta).toBe(4)
  })

  it('el evento SOLO tiene los cinco campos previstos: nada se cuela por el objeto', () => {
    expect(Object.keys(eventoDeResolucion(datos)).sort()).toEqual([
      'accion',
      'desdeMejores',
      'interacciones',
      'longitudConsulta',
      'tipo',
    ])
  })

  it('ningún campo es texto libre: los dos que son cadenas vienen de un catálogo cerrado', () => {
    const evento = eventoDeResolucion(datos)
    expect(['empezar_guia', 'continuar_guia', 'iniciar_diagnostico', 'abrir_equipo', 'copiar_credencial']).toContain(
      evento.accion,
    )
    expect(typeof evento.tipo).toBe('string')
    expect(typeof evento.desdeMejores).toBe('boolean')
    expect(typeof evento.interacciones).toBe('number')
    expect(typeof evento.longitudConsulta).toBe('number')
  })
})

describe('registrarResolucion', () => {
  it('hoy no guarda nada y nunca falla: es un punto de enganche, no un sistema de telemetría', () => {
    expect(() =>
      registrarResolucion(
        eventoDeResolucion({
          accion: 'empezar_guia',
          tipo: 'articulo',
          desdeMejores: false,
          consulta: 'crear cliente externo',
        }),
      ),
    ).not.toThrow()
  })
})
