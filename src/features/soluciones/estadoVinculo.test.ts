import { describe, expect, it } from 'vitest'
import { estadoVinculo, kickerVinculo } from './estadoVinculo'

// Encargo del 2026-09-10, tarea 4: el anillo de avance junto al nombre
// se sustituye por texto explícito.
describe('estadoVinculo', () => {
  it('sin avance dice "Sin iniciar" y ofrece abrirla', () => {
    expect(estadoVinculo(0, 5, false)).toEqual({
      texto: 'Sin iniciar',
      accion: 'Abrir guía',
      clase: 'sin-iniciar',
    })
  })

  it('a medias nombra el paso al que se vuelve, no el ultimo cerrado', () => {
    expect(estadoVinculo(2, 5, false)).toEqual({
      texto: 'Paso 3 de 5',
      accion: 'Continuar guía',
      clase: 'en-curso',
    })
  })

  it('terminada dice "Completada" y ofrece verla', () => {
    expect(estadoVinculo(5, 5, true)).toEqual({
      texto: 'Completada',
      accion: 'Ver guía completada',
      clase: 'completada',
    })
  })

  it('con todos los pasos cerrados pero sin terminar NO dice completada', () => {
    // El caso de una guia con comprobaciones finales pendientes: la
    // cuenta de pasos esta llena, pero la guia no termino. Nombrar un
    // paso mas alla del total mandaria al tecnico a ninguna parte, asi
    // que se queda en el ultimo.
    expect(estadoVinculo(5, 5, false)).toEqual({
      texto: 'Paso 5 de 5',
      accion: 'Continuar guía',
      clase: 'en-curso',
    })
  })

  it('una guia sin pasos no inventa un recorrido', () => {
    expect(estadoVinculo(0, 0, false).texto).toBe('Sin iniciar')
    expect(estadoVinculo(0, 0, true).texto).toBe('Completada')
  })

  it('el rotulo distingue el requisito de la consulta', () => {
    expect(kickerVinculo(true)).toBe('Guía necesaria')
    expect(kickerVinculo(false)).toBe('Consulta opcional')
  })
})
