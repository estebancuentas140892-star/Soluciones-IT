// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { CLAVE_VERSION_VISTA, estrenoDeVersion, textoVersionEstrenada, versionEstrenada } from './versionVista'

// «SOLUCIONES IT SE ACTUALIZÓ A LA VERSIÓN X» (tarea 353): una vez por
// versión nueva y por teléfono, venga del botón o se haya aplicado sola.

const sinUso = async () => false
const conUso = async () => true

beforeEach(() => {
  localStorage.clear()
})

describe('versionEstrenada', () => {
  it('avisa cuando la versión guardada es otra', () => {
    expect(versionEstrenada('e20cb62', '91d803a', false)).toBe(true)
  })
  it('no avisa con la misma versión', () => {
    expect(versionEstrenada('91d803a', '91d803a', true)).toBe(false)
  })
  it('sin versión guardada, avisa solo si el teléfono ya usaba la app', () => {
    expect(versionEstrenada(null, '91d803a', true)).toBe(true)
    expect(versionEstrenada(null, '91d803a', false)).toBe(false)
  })
  it('en desarrollo no dice nada', () => {
    expect(versionEstrenada('91d803a', 'desarrollo', true)).toBe(false)
  })
})

describe('estrenoDeVersion', () => {
  it('una instalación nueva no anuncia nada, pero recuerda la versión', async () => {
    expect(await estrenoDeVersion('91d803a', sinUso)).toBeNull()
    expect(localStorage.getItem(CLAVE_VERSION_VISTA)).toBe('91d803a')
  })

  it('quien ya usaba la app lo ve la primera vez que llega este aviso', async () => {
    expect(await estrenoDeVersion('91d803a', conUso)).toBe('91d803a')
  })

  it('lo dice una sola vez por versión', async () => {
    localStorage.setItem(CLAVE_VERSION_VISTA, 'e20cb62')
    expect(await estrenoDeVersion('91d803a', conUso)).toBe('91d803a')
    expect(await estrenoDeVersion('91d803a', conUso)).toBeNull()
    expect(await estrenoDeVersion('a1b2c3d', conUso)).toBe('a1b2c3d')
  })

  it('en desarrollo ni anuncia ni escribe', async () => {
    expect(await estrenoDeVersion('desarrollo', conUso)).toBeNull()
    expect(localStorage.getItem(CLAVE_VERSION_VISTA)).toBeNull()
  })

  it('el texto dice la versión', () => {
    expect(textoVersionEstrenada('91d803a')).toBe('Soluciones IT se actualizó a la versión 91d803a')
  })
})
