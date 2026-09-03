import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  guardarModoEjecucion,
  ID_PREFERENCIAS_TECNICO,
  leerModoEjecucion,
  MODO_EJECUCION_POR_DEFECTO,
  normalizarModoEjecucion,
} from './preferenciasEjecucion'

describe('preferencias de ejecucion', () => {
  beforeEach(async () => {
    await db.preferenciasTecnico.clear()
  })

  it('sin fila guardada la ejecucion es el foco (tarea 217)', async () => {
    expect(MODO_EJECUCION_POR_DEFECTO).toBe('foco')
    expect(await leerModoEjecucion()).toBe('foco')
  })

  it('guarda la eleccion del tecnico y la devuelve tal cual (G-17)', async () => {
    await guardarModoEjecucion('pasoEntero')
    expect(await leerModoEjecucion()).toBe('pasoEntero')
    await guardarModoEjecucion('foco')
    expect(await leerModoEjecucion()).toBe('foco')
  })

  it('escribe una sola fila, con el id fijo', async () => {
    await guardarModoEjecucion('pasoEntero')
    await guardarModoEjecucion('foco')
    expect(await db.preferenciasTecnico.count()).toBe(1)
    const fila = await db.preferenciasTecnico.get(ID_PREFERENCIAS_TECNICO)
    expect(fila?.modoEjecucion).toBe('foco')
    expect(fila?.actualizadoEn).toBeTruthy()
  })

  it('una fila con un valor que no reconocemos cae en el defecto, no rompe la ejecucion', async () => {
    await db.preferenciasTecnico.put({
      id: ID_PREFERENCIAS_TECNICO,
      modoEjecucion: 'loQueSea' as never,
      actualizadoEn: new Date().toISOString(),
    })
    expect(await leerModoEjecucion()).toBe('foco')
  })

  it('normalizarModoEjecucion acepta los dos modos y rechaza el resto', () => {
    expect(normalizarModoEjecucion('foco')).toBe('foco')
    expect(normalizarModoEjecucion('pasoEntero')).toBe('pasoEntero')
    expect(normalizarModoEjecucion(undefined)).toBe('foco')
    expect(normalizarModoEjecucion(null)).toBe('foco')
    expect(normalizarModoEjecucion(3)).toBe('foco')
  })
})
