import { describe, expect, it } from 'vitest'
import { debeMostrarBienvenida, pasosBienvenida } from './bienvenida'

describe('pasosBienvenida', () => {
  it('el primer paso siempre está hecho: la pantalla solo se ve con sesión', () => {
    const pasos = pasosBienvenida({ instalada: false, descargaHecha: false })
    expect(pasos).toHaveLength(3)
    expect(pasos[0]).toMatchObject({ clave: 'sesion', numero: 1, hecho: true })
  })

  it('marca como "siguiente" solo el primer paso pendiente', () => {
    const pasos = pasosBienvenida({ instalada: false, descargaHecha: false })
    expect(pasos.filter((paso) => paso.siguiente).map((paso) => paso.clave)).toEqual(['instalar'])
  })

  it('con la app instalada, el siguiente pasa a ser la descarga', () => {
    const pasos = pasosBienvenida({ instalada: true, descargaHecha: false })
    expect(pasos[1]).toMatchObject({ clave: 'instalar', hecho: true, siguiente: false })
    expect(pasos[2]).toMatchObject({ clave: 'offline', hecho: false, siguiente: true })
  })

  it('los pasos hechos conservan su número: la lista se apaga, no se acorta', () => {
    const pasos = pasosBienvenida({ instalada: true, descargaHecha: true })
    expect(pasos.map((paso) => paso.numero)).toEqual([1, 2, 3])
    expect(pasos.every((paso) => paso.hecho)).toBe(true)
    expect(pasos.some((paso) => paso.siguiente)).toBe(false)
  })

  it('la descarga hecha sin instalar no adelanta el turno del paso 2', () => {
    const pasos = pasosBienvenida({ instalada: false, descargaHecha: true })
    expect(pasos[1]).toMatchObject({ clave: 'instalar', siguiente: true })
    expect(pasos[2]).toMatchObject({ clave: 'offline', hecho: true, siguiente: false })
  })
})

describe('debeMostrarBienvenida', () => {
  it('se muestra mientras quede algún paso pendiente y no haya bloques reales', () => {
    const pasos = pasosBienvenida({ instalada: false, descargaHecha: false })
    expect(debeMostrarBienvenida({ pasos, hayBloquesReales: false })).toBe(true)
  })

  it('se retira sola cuando los tres pasos están hechos', () => {
    const pasos = pasosBienvenida({ instalada: true, descargaHecha: true })
    expect(debeMostrarBienvenida({ pasos, hayBloquesReales: false })).toBe(false)
  })

  it('se retira sola cuando Inicio ya tiene bloques propios, aunque falten pasos', () => {
    const pasos = pasosBienvenida({ instalada: false, descargaHecha: false })
    expect(debeMostrarBienvenida({ pasos, hayBloquesReales: true })).toBe(false)
  })
})
