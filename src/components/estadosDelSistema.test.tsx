// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstadoSync } from '../lib/sync'
import { control, desmontarTodo, esperar, montar, pausa, textoPantalla, tocar } from '../pruebas/montaje'
import { EsqueletoAutorizacion, EsqueletoBusqueda, EsqueletoFicha, EsqueletoMantenimiento } from './Esqueleto'
import { FranjaEstadoSistema, LineaSincronizacion } from './EstadoDelSistema'

// LOS ESTADOS DEL SISTEMA EN EL TELÉFONO (tarea 342, "Estados" del sistema
// visual móvil "1b Pulgar"): la franja de sin conexión, la de error al subir
// con "Reintentar", la línea de 2 px mientras se sincroniza y los esqueletos
// con la forma de lo que va a llegar. Solo presentación: el estado de la
// sincronización se finge aquí y la red se finge con `navigator.onLine`.

const sync = vi.hoisted(() => {
  const escuchas = new Set<() => void>()
  let estado: EstadoSync = {
    enCurso: false,
    ultimaSync: null,
    cambiosPendientes: 0,
    cambiosConError: 0,
    ultimoError: null,
    tiempoReal: false,
    sinSesion: false,
    conflictosRecientes: [],
  }
  return {
    obtener: () => estado,
    suscribir: (escucha: () => void) => {
      escuchas.add(escucha)
      return () => {
        escuchas.delete(escucha)
      }
    },
    poner: (cambios: Partial<EstadoSync>) => {
      estado = { ...estado, ...cambios }
      for (const escucha of escuchas) escucha()
    },
    sincronizar: vi.fn(async () => undefined),
  }
})

vi.mock('../lib/sync', async (original) => ({
  ...(await original<typeof import('../lib/sync')>()),
  obtenerEstadoSync: sync.obtener,
  suscribirSync: sync.suscribir,
  sincronizar: sync.sincronizar,
}))

let enLinea = true
Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => enLinea })

async function ponerRed(valor: boolean): Promise<void> {
  enLinea = valor
  await act(async () => {
    window.dispatchEvent(new Event(valor ? 'online' : 'offline'))
  })
}

const RUTAS = [
  {
    ruta: '/',
    elemento: (
      <>
        <FranjaEstadoSistema />
        <LineaSincronizacion />
        <p>PANTALLA</p>
      </>
    ),
  },
]

beforeEach(async () => {
  enLinea = true
  sync.sincronizar.mockClear()
  await act(async () => sync.poner({ enCurso: false, cambiosConError: 0, cambiosPendientes: 0 }))
})

afterEach(async () => {
  await desmontarTodo()
})

function franja(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-franja-sistema]')
}

describe('la franja del sistema', () => {
  it('con red y sin errores no hay franja ni línea', async () => {
    await montar(RUTAS, '/')
    await esperar(() => textoPantalla().includes('PANTALLA'), 'la pantalla')
    expect(franja()).toBeNull()
    expect(document.body.querySelector('[data-linea-sincronizacion]')).toBeNull()
  })

  it('sin conexión dice que se trabaja con la copia local, en 38 px, solo en el teléfono y sin bloquear', async () => {
    await montar(RUTAS, '/')
    await ponerRed(false)
    const sinRed = await esperar(franja, 'la franja')
    expect(sinRed.dataset.franjaSistema).toBe('sin-conexion')
    expect(sinRed.getAttribute('role')).toBe('status')
    expect(sinRed.textContent).toBe('Sin conexión. Trabajas con la copia local')
    expect(sinRed.className).toContain('min-h-[38px]')
    expect(sinRed.className).toContain('md:hidden')
    expect(sinRed.className).toContain('bg-noct-precaucion/(--tinte-estado)')
    // No pide nada: ni botón ni nada que tape la pantalla.
    expect(sinRed.querySelector('button')).toBeNull()
    expect(textoPantalla()).toContain('PANTALLA')

    await ponerRed(true)
    await esperar(() => franja() === null, 'la franja se va al volver la red')
  })

  it('con cambios que no se subieron lo dice y "Reintentar" es la sincronización de siempre', async () => {
    await montar(RUTAS, '/')
    await act(async () => sync.poner({ cambiosConError: 2 }))
    const error = await esperar(franja, 'la franja de error')
    expect(error.dataset.franjaSistema).toBe('error')
    expect(error.textContent).toContain('2 cambios no se subieron')
    const reintentar = control('Reintentar') as HTMLElement
    // El verbo a 14 y 44 de toque (`toque-amplio`).
    expect(reintentar.className).toContain('text-[14px]')
    expect(reintentar.className).toContain('toque-amplio')
    await tocar(reintentar)
    expect(sync.sincronizar).toHaveBeenCalledTimes(1)

    // Mientras se sincroniza, no se pide otra y la línea dice que está en ello.
    await act(async () => sync.poner({ enCurso: true }))
    expect((control('Reintentar') as HTMLButtonElement).disabled).toBe(true)
    expect(document.body.querySelector('[data-linea-sincronizacion]')).not.toBeNull()

    await act(async () => sync.poner({ cambiosConError: 1, enCurso: false }))
    expect(franja()?.textContent).toContain('1 cambio no se subió')
  })

  it('sin conexión manda sobre el error: lo que falta es la red', async () => {
    await montar(RUTAS, '/')
    await act(async () => sync.poner({ cambiosConError: 3 }))
    await ponerRed(false)
    await esperar(() => franja()?.dataset.franjaSistema === 'sin-conexion', 'la franja de sin conexión')
    expect(control('Reintentar')).toBeNull()
  })
})

describe('la línea de sincronización', () => {
  it('2 px arriba mientras se sincroniza, solo en el teléfono, y quieta si se pide menos movimiento', async () => {
    await montar(RUTAS, '/')
    await act(async () => sync.poner({ enCurso: true }))
    const linea = await esperar(
      () => document.body.querySelector<HTMLElement>('[data-linea-sincronizacion]'),
      'la línea',
    )
    expect(linea.getAttribute('aria-hidden')).toBe('true')
    expect(linea.className).toContain('h-[2px]')
    expect(linea.className).toContain('fixed')
    expect(linea.className).toContain('md:hidden')
    const tramo = linea.firstElementChild as HTMLElement
    expect(tramo.className).toContain('motion-safe:animate-[avance_1.1s_ease-in-out_infinite]')
    expect(tramo.className.split(/\s+/).filter((c) => c.startsWith('animate-'))).toEqual([])

    await act(async () => sync.poner({ enCurso: false }))
    await pausa()
    expect(document.body.querySelector('[data-linea-sincronizacion]')).toBeNull()
  })

  it('sin red no hay línea aunque quede una sincronización a medias', async () => {
    await montar(RUTAS, '/')
    await act(async () => sync.poner({ enCurso: true }))
    await ponerRed(false)
    await pausa()
    expect(document.body.querySelector('[data-linea-sincronizacion]')).toBeNull()
  })
})

describe('los esqueletos', () => {
  const FORMAS = [
    { nombre: 'la ficha', Forma: EsqueletoFicha, etiqueta: 'Cargando la ficha del equipo', texto: 'Leyendo la copia local…' },
    { nombre: 'el mantenimiento', Forma: EsqueletoMantenimiento, etiqueta: 'Cargando el mantenimiento', texto: '' },
    { nombre: 'la autorización', Forma: EsqueletoAutorizacion, etiqueta: 'Cargando la autorización', texto: '' },
    { nombre: 'el índice de búsqueda', Forma: EsqueletoBusqueda, etiqueta: 'Preparando el índice de búsqueda', texto: 'Preparando el índice de búsqueda…' },
  ]

  for (const { nombre, Forma, etiqueta, texto } of FORMAS) {
    it(`${nombre}: se anuncia como estado, tiene forma y su brillo respeta "reducir movimiento"`, async () => {
      await montar([{ ruta: '/', elemento: <Forma /> }], '/')
      const esqueleto = await esperar(() => document.body.querySelector<HTMLElement>('[data-esqueleto]'), 'el esqueleto')
      expect(esqueleto.getAttribute('role')).toBe('status')
      expect(esqueleto.getAttribute('aria-label')).toBe(etiqueta)
      expect(esqueleto.querySelectorAll('span[aria-hidden]').length).toBeGreaterThan(2)
      const brillo = esqueleto.firstElementChild as HTMLElement
      expect(brillo.className).toContain('motion-safe:animate-[brillo_1.2s_ease-in-out_infinite]')
      expect(brillo.className.split(/\s+/).filter((c) => c.startsWith('animate-'))).toEqual([])
      if (texto) expect(esqueleto.textContent).toBe(texto)
      else expect(esqueleto.textContent).toBe('')
      // Ni un spinner ni el "Cargando..." de antes.
      expect(textoPantalla()).not.toContain('Cargando...')
    })
  }
})
