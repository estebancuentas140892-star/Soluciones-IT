import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { borrarSesionGuardada, claveSesionDe, leerSesionGuardada, sesionTrasComprobar } from './sesionGuardada'

function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    getItem: (clave: string) => datos.get(clave) ?? null,
    removeItem: (clave: string) => void datos.delete(clave),
  }
}

const SESION = {
  access_token: 'a',
  refresh_token: 'r',
  expires_at: 1,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'u1' },
} as unknown as Session
const OTRA = { ...SESION, access_token: 'b' } as Session

describe('claveSesionDe', () => {
  it('es la misma clave que usa supabase-js', () => {
    expect(claveSesionDe('https://kwwxnmlprdivckqcgjws.supabase.co')).toBe('sb-kwwxnmlprdivckqcgjws-auth-token')
    expect(claveSesionDe('https://prueba-sin-conexion.supabase.co/')).toBe('sb-prueba-sin-conexion-auth-token')
  })
})

describe('leerSesionGuardada', () => {
  it('devuelve la sesión guardada, aunque su token haya vencido', () => {
    const guardado = almacen({ clave: JSON.stringify(SESION) })
    expect(leerSesionGuardada(guardado, 'clave')).toEqual(SESION)
  })

  it('sin sesión, con texto dañado o sin la forma de supabase-js, no hay sesión', () => {
    expect(leerSesionGuardada(almacen(), 'clave')).toBeNull()
    expect(leerSesionGuardada(almacen({ clave: '{roto' }), 'clave')).toBeNull()
    expect(leerSesionGuardada(almacen({ clave: 'null' }), 'clave')).toBeNull()
    const { expires_at: _sinVencimiento, ...incompleta } = SESION
    expect(leerSesionGuardada(almacen({ clave: JSON.stringify(incompleta) }), 'clave')).toBeNull()
    expect(leerSesionGuardada(almacen({ clave: JSON.stringify({ ...SESION, user: null }) }), 'clave')).toBeNull()
  })

  it('un almacenamiento bloqueado cuenta como "no hay"', () => {
    const bloqueado = { getItem: () => { throw new Error('SecurityError') } }
    expect(leerSesionGuardada(bloqueado, 'clave')).toBeNull()
  })
})

describe('borrarSesionGuardada', () => {
  it('borra la sesión y sus dos compañeras, y nada más', () => {
    const guardado = almacen({ clave: 'x', 'clave-user': 'x', 'clave-code-verifier': 'x', otra: 'x' })
    borrarSesionGuardada(guardado, 'clave')
    expect([...guardado.datos.keys()]).toEqual(['otra'])
  })
})

describe('sesionTrasComprobar', () => {
  it('se queda con la que devuelve supabase-js cuando la hay', () => {
    expect(sesionTrasComprobar(OTRA, null, SESION)).toBe(OTRA)
  })

  it('sin red conserva la que ya se usaba', () => {
    const sinRed = new AuthRetryableFetchError('Failed to fetch', 0)
    expect(sesionTrasComprobar(null, sinRed, SESION)).toBe(SESION)
    expect(sesionTrasComprobar(null, sinRed, null)).toBeNull()
  })

  it('si el servidor la rechazó o no la hay, no hay sesión', () => {
    expect(sesionTrasComprobar(null, new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'), SESION)).toBeNull()
    expect(sesionTrasComprobar(null, null, SESION)).toBeNull()
  })
})
