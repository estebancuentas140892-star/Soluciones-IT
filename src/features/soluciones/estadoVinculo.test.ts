import { describe, expect, it } from 'vitest'
import { estadoVinculo, kickerVinculo } from './estadoVinculo'

// Encargo del 2026-09-10, tarea 4: el anillo de avance junto al nombre
// se sustituye por texto explícito. Desde la tarea 289 (fase 3), sin
// "guía" en las palabras y sin la numeración de lo abierto, que al lado
// del contador de la guía que se ejecuta era una segunda numeración.
describe('estadoVinculo', () => {
  it('sin avance dice "Sin empezar" y ofrece abrir', () => {
    expect(estadoVinculo(0, 5, false)).toEqual({ texto: 'Sin empezar', accion: 'Abrir', clase: 'sin-iniciar' })
  })

  it('a medias lo dice y ofrece seguir donde se iba, sin numerar', () => {
    expect(estadoVinculo(2, 5, false)).toEqual({ texto: 'A medias', accion: 'Seguir donde ibas', clase: 'en-curso' })
  })

  it('terminada dice "Hecha" y ofrece verla de nuevo', () => {
    expect(estadoVinculo(5, 5, true)).toEqual({ texto: 'Hecha', accion: 'Ver de nuevo', clase: 'completada' })
  })

  it('con todos los pasos cerrados pero sin terminar NO dice hecha', () => {
    // El caso de una guia con comprobaciones finales pendientes: la
    // cuenta de pasos esta llena, pero la guia no termino.
    expect(estadoVinculo(5, 5, false)).toEqual({ texto: 'A medias', accion: 'Seguir donde ibas', clase: 'en-curso' })
  })

  it('una guia sin pasos no inventa un recorrido', () => {
    expect(estadoVinculo(0, 0, false).texto).toBe('Sin empezar')
    expect(estadoVinculo(0, 0, true).texto).toBe('Hecha')
  })

  it('el rotulo dice el papel sin hablar de vinculos', () => {
    expect(kickerVinculo(true)).toBe('Necesario para seguir')
    expect(kickerVinculo(false)).toBe('Si lo necesitas')
  })
})
