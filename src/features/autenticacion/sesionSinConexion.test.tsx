// @vitest-environment happy-dom
import { AuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// La sesión sin conexión (tarea 284), montando el AuthProvider de verdad
// sobre un supabase-js simulado que se comporta como el real sin red:
// getSession tarda en rendirse y contesta "sin sesión" con un error de red,
// y signOut devuelve el error sin borrar nada.

const CLAVE = 'sb-prueba-auth-token'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  escucha: null as null | ((evento: string, sesion: unknown) => void),
}))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth },
  supabaseConfigured: true,
  CLAVE_SESION: 'sb-prueba-auth-token',
}))
vi.mock('../../lib/sync', () => ({ sincronizar: vi.fn() }))
vi.mock('../asistencia/sesionAsistencia', () => ({ desconectarAlSalir: vi.fn(async () => {}) }))

import { AuthProvider } from './AuthProvider'
import { useAuth, type AuthContextValue } from './authContext'

const SESION = {
  access_token: 'vencido',
  refresh_token: 'refresco',
  expires_at: Math.floor(Date.now() / 1000) - 7200,
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'tecnico-1', email: 'tecnico@ejemplo.test' },
} as unknown as Session

let raiz: Root | null = null
let contenedor: HTMLElement
let valor: AuthContextValue

function Espia() {
  valor = useAuth()
  return null
}

async function montar() {
  contenedor = document.createElement('div')
  raiz = createRoot(contenedor)
  await act(async () => raiz!.render(createElement(AuthProvider, null, createElement(Espia))))
}

const nunca = () => new Promise<never>(() => {})
const sinRed = () => new AuthRetryableFetchError('Failed to fetch', 0)

beforeEach(() => {
  localStorage.clear()
  auth.escucha = null
  auth.getSession.mockReset().mockImplementation(nunca)
  auth.signOut.mockReset()
  auth.onAuthStateChange.mockReset().mockImplementation((escucha) => {
    auth.escucha = escucha
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
})

afterEach(async () => {
  await act(async () => raiz?.unmount())
  raiz = null
  vi.useRealTimers()
})

describe('abrir la app sin conexión', () => {
  it('con una sesión guardada abre al instante, sin esperar a que supabase-js se rinda', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(SESION))
    await montar()
    expect(valor.cargando).toBe(false)
    expect(valor.session?.user.id).toBe('tecnico-1')
  })

  it('si supabase-js no pudo renovar el token por falta de red, sigue con la guardada', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(SESION))
    auth.getSession.mockResolvedValue({ data: { session: null }, error: sinRed() })
    await montar()
    expect(valor.session?.user.id).toBe('tecnico-1')
  })

  it('el aviso inicial de "sin sesión" no la pisa; un cierre de sesión de verdad, sí', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(SESION))
    await montar()
    await act(async () => auth.escucha!('INITIAL_SESSION', null))
    expect(valor.session?.user.id).toBe('tecnico-1')
    await act(async () => auth.escucha!('SIGNED_OUT', null))
    expect(valor.session).toBeNull()
  })

  it('si el servidor la rechaza, no hay sesión', async () => {
    localStorage.setItem(CLAVE, JSON.stringify(SESION))
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    await montar()
    expect(valor.session).toBeNull()
    expect(valor.cargando).toBe(false)
  })

  it('sin sesión guardada espera a supabase-js, como siempre', async () => {
    await montar()
    expect(valor.cargando).toBe(true)
    expect(valor.session).toBeNull()
  })
})

describe('cerrar sesión', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE, JSON.stringify(SESION))
    localStorage.setItem(`${CLAVE}-user`, '{}')
    localStorage.setItem('otra-cosa', 'se queda')
  })

  it('sin red no espera al servidor: borra al instante la sesión de este teléfono', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    let guardadaAlLlamar: string | null = 'sin llamar'
    auth.signOut.mockImplementation(async () => {
      guardadaAlLlamar = localStorage.getItem(CLAVE)
      return { error: null }
    })
    await montar()
    await act(async () => valor.cerrarSesion())
    expect(valor.session).toBeNull()
    expect(localStorage.getItem(CLAVE)).toBeNull()
    expect(localStorage.getItem(`${CLAVE}-user`)).toBeNull()
    expect(localStorage.getItem('otra-cosa')).toBe('se queda')
    // supabase-js se entera después, ya sin nada guardado: así cierra sin
    // ir al servidor y avisa SIGNED_OUT (el canal de tiempo real se corta).
    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(guardadaAlLlamar).toBeNull()
    vi.restoreAllMocks()
  })

  it('con red, si el servidor devuelve un error de red, también la cierra', async () => {
    auth.signOut.mockResolvedValue({ error: sinRed() })
    await montar()
    await act(async () => valor.cerrarSesion())
    expect(valor.session).toBeNull()
    expect(localStorage.getItem(CLAVE)).toBeNull()
  })

  it('si el servidor no contesta, a los 4 segundos la da por cerrada', async () => {
    vi.useFakeTimers()
    auth.signOut.mockImplementation(nunca)
    await montar()
    let cerrada = false
    await act(async () => {
      void valor.cerrarSesion().then(() => (cerrada = true))
    })
    await act(async () => vi.advanceTimersByTimeAsync(3900))
    expect(cerrada).toBe(false)
    await act(async () => vi.advanceTimersByTimeAsync(200))
    expect(cerrada).toBe(true)
    expect(valor.session).toBeNull()
    expect(localStorage.getItem(CLAVE)).toBeNull()
  })

  it('con red la cierra supabase-js, sin tocar su almacenamiento', async () => {
    auth.signOut.mockResolvedValue({ error: null })
    await montar()
    await act(async () => valor.cerrarSesion())
    expect(auth.signOut).toHaveBeenCalledOnce()
    // El borrado y el SIGNED_OUT los hace supabase-js; el simulado no.
    expect(localStorage.getItem(CLAVE)).not.toBeNull()
  })
})
