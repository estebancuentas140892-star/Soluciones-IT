// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PortalAsistencia } from './PortalAsistencia'

// EL PORTAL, MONTADO DE VERDAD (tarea 258, sección 15 del encargo).
//
// Un servidor falso responde las tres funciones del portal por `fetch`
// (lo mismo que haría Supabase), y las consultas se aceleran a 40 ms para
// recorrer los estados sin esperar 2 s cada vez. Todo es inventado.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./estadoPortal', async (original) => ({
  ...(await original<typeof import('./estadoPortal')>()),
  intervaloConsulta: () => 40,
}))

interface ServidorFalso {
  estado: 'esperando' | 'conectada' | 'cerrada' | 'expirada'
  motivo: string | null
  codigo: string
  mensajes: { id: number; creado_en: string; contenido: unknown }[]
  llamadas: string[]
  crearResponde: number
  sinRed: boolean
}

const SECRETO = 'cd'.repeat(32)
let servidor: ServidorFalso
let raiz: Root | null = null
let contenedor: HTMLDivElement | null = null

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://prueba.supabase.invalid')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave-publicable-de-prueba')
  sessionStorage.clear()
  servidor = {
    estado: 'esperando',
    motivo: null,
    codigo: '482731',
    mensajes: [],
    llamadas: [],
    crearResponde: 200,
    sinRed: false,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (servidor.sinRed) throw new TypeError('Failed to fetch')
      const funcion = String(url).split('/rpc/')[1]
      const cuerpo = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      servidor.llamadas.push(funcion)
      const ahora = new Date().toISOString()
      if (funcion === 'asistencia_crear') {
        if (servidor.crearResponde !== 200) return responder({ code: 'PGRST202' }, servidor.crearResponde)
        return responder({
          ok: true,
          id: 'sesion-1',
          secreto: SECRETO,
          codigo: servidor.codigo,
          codigo_vence_en: new Date(Date.now() + 10 * 60_000).toISOString(),
          ahora,
        })
      }
      if (funcion === 'asistencia_estado') {
        if (cuerpo.p_secreto !== SECRETO) return responder({ ok: true, estado: 'no_encontrada', ahora })
        const desde = Number(cuerpo.p_desde ?? 0)
        return responder({
          ok: true,
          estado: servidor.estado,
          codigo: servidor.estado === 'esperando' ? servidor.codigo : null,
          codigo_vence_en: servidor.estado === 'esperando' ? new Date(Date.now() + 9 * 60_000).toISOString() : null,
          motivo: servidor.motivo,
          mensajes: servidor.estado === 'conectada' ? servidor.mensajes.filter((m) => m.id > desde) : [],
          ahora,
        })
      }
      if (funcion === 'asistencia_cerrar_portal') {
        servidor.estado = 'cerrada'
        servidor.motivo = 'portal'
        return responder({ ok: true, estado: 'cerrada' })
      }
      return responder({ message: 'no existe' }, 404)
    }),
  )
})

afterEach(async () => {
  if (raiz) await act(async () => raiz?.unmount())
  contenedor?.remove()
  raiz = null
  contenedor = null
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function pausa(ms = 60) {
  await act(async () => {
    await new Promise((resolver) => setTimeout(resolver, ms))
  })
}

async function montarPortal() {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
  raiz = createRoot(contenedor)
  await act(async () => raiz?.render(<PortalAsistencia />))
  await pausa()
}

async function esperarTexto(texto: string, ms = 3000) {
  const limite = Date.now() + ms
  while (Date.now() < limite) {
    if (document.body.textContent?.includes(texto)) return
    await pausa(30)
  }
  throw new Error(`No apareció «${texto}». Se ve: ${document.body.textContent}`)
}

function boton(texto: string): HTMLButtonElement {
  const encontrado = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto)
  if (!encontrado) throw new Error(`No hay un botón «${texto}»`)
  return encontrado
}

describe('el portal de asistencia', () => {
  it('espera, se conecta, recibe un envío y termina cuando el técnico se desconecta', async () => {
    await montarPortal()
    await esperarTexto('Dale este código al técnico')
    expect(document.body.textContent).toContain('482 731')
    expect(document.body.textContent).toContain('El código vence en')
    expect(document.querySelector('svg[role=img]')).not.toBeNull()

    servidor.estado = 'conectada'
    await esperarTexto('Conectado con el técnico')

    servidor.mensajes.push({
      id: 1,
      creado_en: new Date().toISOString(),
      contenido: {
        v: 1,
        titulo: 'Paso 2 · Vaciar la caché DNS',
        bloques: [
          { tipo: 'accion', texto: 'Ejecuta el comando en el símbolo del sistema' },
          { tipo: 'comando', texto: 'ipconfig /flushdns' },
        ],
      },
    })
    await esperarTexto('Paso 2 · Vaciar la caché DNS')
    expect(document.body.textContent).toContain('ipconfig /flushdns')
    expect(boton('Copiar')).toBeTruthy()

    servidor.estado = 'cerrada'
    servidor.motivo = 'tecnico'
    await esperarTexto('El técnico se desconectó')
    // Lo que se había recibido deja de verse al terminar.
    expect(document.body.textContent).not.toContain('ipconfig /flushdns')
    expect(sessionStorage.getItem('asistencia:portal')).toBeNull()
    expect(boton('Generar un código nuevo')).toBeTruthy()
  })

  it('dibuja todo como texto: un envío con HTML no crea elementos', async () => {
    await montarPortal()
    servidor.estado = 'conectada'
    servidor.mensajes.push({
      id: 1,
      creado_en: new Date().toISOString(),
      contenido: { v: 1, titulo: 'Paso 1', bloques: [{ tipo: 'accion', texto: '<img src=x onerror="alert(1)">' }] },
    })
    await esperarTexto('<img src=x')
    expect(document.querySelector('img')).toBeNull()
  })

  it('no dibuja un envío con un tipo desconocido ni uno con forma de secreto', async () => {
    await montarPortal()
    servidor.estado = 'conectada'
    servidor.mensajes.push(
      { id: 1, creado_en: new Date().toISOString(), contenido: { v: 1, titulo: 'Raro', bloques: [{ tipo: 'script', texto: 'x' }] } },
      { id: 2, creado_en: new Date().toISOString(), contenido: { v: 1, titulo: 'Paso', bloques: [{ tipo: 'dato', texto: 'PIN: 4321' }] } },
    )
    await esperarTexto('Conectado con el técnico')
    await pausa(200)
    expect(document.body.textContent).not.toContain('Raro')
    expect(document.body.textContent).not.toContain('4321')
  })

  it('"Terminar la asistencia" cierra la sesión en el servidor', async () => {
    await montarPortal()
    await esperarTexto('Dale este código al técnico')
    await act(async () => boton('Terminar la asistencia').click())
    await esperarTexto('Sesión finalizada')
    expect(servidor.llamadas).toContain('asistencia_cerrar_portal')
  })

  it('el código vencido lo dice y ofrece uno nuevo', async () => {
    await montarPortal()
    servidor.estado = 'expirada'
    servidor.motivo = 'codigo_vencido'
    await esperarTexto('El código venció')
    servidor.estado = 'esperando'
    servidor.motivo = null
    servidor.codigo = '905112'
    await act(async () => boton('Generar un código nuevo').click())
    await esperarTexto('905 112')
  })

  it('al recargar la pestaña retoma su sesión, sin crear otra', async () => {
    sessionStorage.setItem('asistencia:portal', JSON.stringify({ id: 'sesion-1', secreto: SECRETO }))
    servidor.estado = 'conectada'
    await montarPortal()
    await esperarTexto('Conectado con el técnico')
    expect(servidor.llamadas).not.toContain('asistencia_crear')
  })

  it('una sesión guardada que ya no existe termina limpia', async () => {
    sessionStorage.setItem('asistencia:portal', JSON.stringify({ id: 'sesion-1', secreto: 'ef'.repeat(32) }))
    await montarPortal()
    await esperarTexto('Esta asistencia ya no existe')
  })

  it('sin red lo dice y se recupera sola', async () => {
    await montarPortal()
    await esperarTexto('Dale este código al técnico')
    servidor.sinRed = true
    await esperarTexto('Sin conexión')
    servidor.sinRed = false
    servidor.estado = 'conectada'
    await esperarTexto('Conectado con el técnico')
    expect(document.body.textContent).not.toContain('Sin conexión')
  })

  it('si la asistencia no existe en el servidor (sin migrar), lo dice', async () => {
    servidor.crearResponde = 404
    await montarPortal()
    await esperarTexto('La asistencia no está disponible ahora')
  })

  it('no toca IndexedDB ni registra un service worker', async () => {
    const abrir = vi.spyOn(indexedDB, 'open')
    await montarPortal()
    await esperarTexto('Dale este código al técnico')
    expect(abrir).not.toHaveBeenCalled()
    expect(navigator.serviceWorker?.controller ?? null).toBeNull()
  })
})
