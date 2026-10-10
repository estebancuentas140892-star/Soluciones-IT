// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// QUIÉN ESCRIBE, SIN RED Y CON EL TOKEN VENCIDO (tarea 326).
//
// supabase-js simulado como el real en ese caso: `getSession()` se queda
// reintentando la renovación (aquí, no responde nunca). Antes cada
// guardado esperaba esos ~25 s y quedaba sin autor; ahora el autor sale
// de la sesión guardada en el teléfono, sin preguntar a la red. Datos
// inventados.

const CLAVE = 'sb-prueba-auth-token'

const auth = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('./supabase', () => ({
  supabase: { auth },
  supabaseConfigured: true,
  CLAVE_SESION: 'sb-prueba-auth-token',
}))
vi.mock('./sync', () => ({ programarSync: vi.fn() }))

import { db } from './db'
import { registrarIntervencion } from './repositorio'

const SESION_VENCIDA = {
  access_token: 'vencido',
  refresh_token: 'refresco',
  expires_at: Math.floor(Date.now() / 1000) - 7200,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'tecnico-1', email: 'tecnico@ejemplo.test' },
}

const nunca = () => new Promise<never>(() => {})

beforeEach(async () => {
  localStorage.clear()
  auth.getSession.mockReset()
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

describe('el autor de un guardado', () => {
  it('sale de la sesión guardada sin esperar a la red', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(SESION_VENCIDA))
    auth.getSession.mockImplementation(nunca)
    await db.perfiles.put({ id: 'tecnico-1', nombre: 'Técnica de prueba', correo: '', puedeVerBoveda: false })

    // Sin la corrección esto no termina nunca (getSession no responde).
    const id = await registrarIntervencion('equipo-1', 'Cambio de fuente')

    const entrada = await db.historial.get(id)
    expect(entrada).toMatchObject({ usuario: 'tecnico-1', usuarioNombre: 'Técnica de prueba' })
    expect(auth.getSession).not.toHaveBeenCalled()
  })

  it('sin perfil local usa el nombre del correo, como antes', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(SESION_VENCIDA))
    auth.getSession.mockImplementation(nunca)

    const id = await registrarIntervencion('equipo-1', 'Cambio de fuente')

    expect(await db.historial.get(id)).toMatchObject({ usuario: 'tecnico-1', usuarioNombre: 'tecnico' })
  })

  it('sin sesión guardada pregunta a supabase-js como antes', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESION_VENCIDA }, error: null })

    const id = await registrarIntervencion('equipo-1', 'Cambio de fuente')

    expect(auth.getSession).toHaveBeenCalledTimes(1)
    expect(await db.historial.get(id)).toMatchObject({ usuario: 'tecnico-1' })
  })

  it('una sesión guardada dañada no cuenta: se pregunta a supabase-js', async () => {
    localStorage.setItem(CLAVE, '{no es json')
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    const id = await registrarIntervencion('equipo-1', 'Cambio de fuente')

    expect(await db.historial.get(id)).toMatchObject({ usuario: null, usuarioNombre: '' })
  })
})
