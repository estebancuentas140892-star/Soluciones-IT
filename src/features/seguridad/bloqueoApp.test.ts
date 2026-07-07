import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  bloquearApp,
  bloqueoAppConfigurado,
  bloqueoAppDesbloqueado,
  cambiarBloqueoApp,
  configurarBloqueoApp,
  desbloquearApp,
  quitarBloqueoApp,
  restablecerBloqueoApp,
  validarSecreto,
} from './bloqueoApp'

beforeEach(async () => {
  bloquearApp()
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

describe('configurarBloqueoApp', () => {
  it('configura y deja la app desbloqueada', async () => {
    const error = await configurarBloqueoApp('contrasena', 'clave1234')
    expect(error).toBeNull()
    expect(await bloqueoAppConfigurado()).toBe(true)
    expect(bloqueoAppDesbloqueado()).toBe(true)
  })

  it('no permite configurar si ya existe', async () => {
    await configurarBloqueoApp('contrasena', 'clave1234')
    const error = await configurarBloqueoApp('contrasena', 'otra5678')
    expect(error).toMatch(/ya está configurado/i)
  })

  it('rechaza una contraseña demasiado corta', async () => {
    const error = await configurarBloqueoApp('contrasena', '12')
    expect(error).toMatch(/al menos 4/i)
    expect(await bloqueoAppConfigurado()).toBe(false)
  })

  it('rechaza un patrón con menos de 4 puntos', async () => {
    const error = await configurarBloqueoApp('patron', '0-1')
    expect(error).toMatch(/al menos 4 puntos/i)
    expect(await bloqueoAppConfigurado()).toBe(false)
  })
})

describe('desbloquearApp', () => {
  it('desbloquea con la contraseña correcta y rechaza la incorrecta', async () => {
    await configurarBloqueoApp('contrasena', 'clave1234')
    bloquearApp()
    expect(bloqueoAppDesbloqueado()).toBe(false)

    const malo = await desbloquearApp('incorrecta')
    expect(malo).toMatch(/contraseña incorrecta/i)
    expect(bloqueoAppDesbloqueado()).toBe(false)

    const bueno = await desbloquearApp('clave1234')
    expect(bueno).toBeNull()
    expect(bloqueoAppDesbloqueado()).toBe(true)
  })

  it('desbloquea con el patrón correcto', async () => {
    await configurarBloqueoApp('patron', '0-1-2-5')
    bloquearApp()

    expect(await desbloquearApp('0-3-6-7')).toMatch(/patrón incorrecto/i)
    expect(bloqueoAppDesbloqueado()).toBe(false)

    expect(await desbloquearApp('0-1-2-5')).toBeNull()
    expect(bloqueoAppDesbloqueado()).toBe(true)
  })
})

describe('cambiarBloqueoApp', () => {
  it('cambia el método y el secreto tras verificar el actual', async () => {
    await configurarBloqueoApp('contrasena', 'clave1234')

    const malActual = await cambiarBloqueoApp('otra', 'patron', '0-3-6-7')
    expect(malActual).toMatch(/actual no es correcto/i)

    const ok = await cambiarBloqueoApp('clave1234', 'patron', '0-3-6-7')
    expect(ok).toBeNull()

    bloquearApp()
    expect(await desbloquearApp('clave1234')).toMatch(/patrón incorrecto/i)
    expect(await desbloquearApp('0-3-6-7')).toBeNull()
  })
})

describe('quitarBloqueoApp y restablecerBloqueoApp', () => {
  it('quita el bloqueo solo con el secreto correcto', async () => {
    await configurarBloqueoApp('contrasena', 'clave1234')

    expect(await quitarBloqueoApp('incorrecta')).toMatch(/actual no es correcto/i)
    expect(await bloqueoAppConfigurado()).toBe(true)

    expect(await quitarBloqueoApp('clave1234')).toBeNull()
    expect(await bloqueoAppConfigurado()).toBe(false)
  })

  it('restablece sin secreto (salida de emergencia) y bloquea', async () => {
    await configurarBloqueoApp('contrasena', 'clave1234')
    await restablecerBloqueoApp()
    expect(await bloqueoAppConfigurado()).toBe(false)
    expect(bloqueoAppDesbloqueado()).toBe(false)
  })
})

describe('límite de intentos', () => {
  it('impone una espera tras varios intentos fallidos, incluso con el secreto correcto', async () => {
    await configurarBloqueoApp('contrasena', 'clave1234')
    bloquearApp()

    let ultimo: string | null = null
    for (let i = 0; i < 5; i++) {
      ultimo = await desbloquearApp('incorrecta')
    }
    expect(ultimo).toMatch(/demasiados intentos/i)

    // Durante la espera, ni el secreto correcto entra.
    const durante = await desbloquearApp('clave1234')
    expect(durante).toMatch(/demasiados intentos/i)
    expect(bloqueoAppDesbloqueado()).toBe(false)
  })
})

describe('validarSecreto', () => {
  it('valida longitud de contraseña y puntos del patrón', () => {
    expect(validarSecreto('contrasena', '1234')).toBeNull()
    expect(validarSecreto('contrasena', '123')).toMatch(/al menos 4/i)
    expect(validarSecreto('patron', '0-1-2-5')).toBeNull()
    expect(validarSecreto('patron', '0-1-2')).toMatch(/al menos 4 puntos/i)
  })
})
