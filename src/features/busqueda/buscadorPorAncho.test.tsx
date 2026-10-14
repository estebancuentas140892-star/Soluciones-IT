// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DispositivosPage } from '../dispositivos/DispositivosPage'
import { ResolverPage } from '../inicio/ResolverPage'
import { BuscadorGlobal } from './BuscadorGlobal'
import {
  campoBuscador,
  control,
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  sembrarPerfil,
  textoPantalla,
} from '../../pruebas/montaje'

// EL BUSCADOR EN EL DOCK ES SOLO DEL TELÉFONO (tarea 338, AD-087, regla 31).
//
// El rediseño "1b Pulgar" bajó el buscador de las raíces a un dock, al
// pulgar, pero eso vale por debajo de 768 px. Desde 768 el MISMO campo vuelve
// a su sitio de antes (arriba) y nunca hay dos buscadores en la pantalla
// (regla M-R8). Las pruebas miran un teléfono por defecto
// (src/pruebas/setup.ts); aquí se pide además el escritorio.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

const enDock = (campo: HTMLElement | null) => campo?.closest('[data-dock-busqueda]') ?? null
const campos = (alcance: string) => document.body.querySelectorAll(`input[aria-label="Buscar en ${alcance}"]`)

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
})

describe('Resolver', () => {
  const RUTAS = [
    { ruta: '/', elemento: <ResolverPage /> },
    { ruta: '/soluciones', elemento: <p>Catálogo de guías</p> },
  ]
  const listo = () => esperar(() => control('Todas las guías'), 'aparece "Todas las guías"')

  it('en el teléfono el buscador va en el dock, sin la pregunta de arriba', async () => {
    await montar(RUTAS, '/')
    await listo()
    expect(campos('Soluciones IT')).toHaveLength(1)
    expect(enDock(campoBuscador())).not.toBeNull()
    expect(textoPantalla()).not.toContain('¿Qué necesitas resolver?')
  })

  it('desde 768 px vuelve arriba con su pregunta, y sin dock', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await montar(RUTAS, '/')
    await listo()
    expect(campos('Soluciones IT')).toHaveLength(1)
    expect(enDock(campoBuscador())).toBeNull()
    expect(document.body.querySelector('[data-dock-busqueda]')).toBeNull()
    expect(textoPantalla()).toContain('¿Qué necesitas resolver?')
  })
})

describe('Equipos', () => {
  const RUTAS = [{ ruta: '/dispositivos', elemento: <DispositivosPage /> }]
  const campoEquipos = () => document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Equipos"]')

  it('en el teléfono, campo y escáner van en el dock', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(campoEquipos, 'aparece el buscador de equipos')
    expect(campos('Equipos')).toHaveLength(1)
    expect(enDock(campoEquipos())).not.toBeNull()
    expect(enDock(control('Escanear QR'))).not.toBeNull()
  })

  it('desde 1280 px van arriba, como antes del rediseño, una sola vez', async () => {
    ventana.happyDOM.setViewport({ width: 1280, height: 800 })
    await montar(RUTAS, '/dispositivos')
    await esperar(campoEquipos, 'aparece el buscador de equipos')
    expect(campos('Equipos')).toHaveLength(1)
    expect(document.body.querySelector('[data-dock-busqueda]')).toBeNull()
    expect(document.body.querySelectorAll('a[aria-label="Escanear QR"]')).toHaveLength(1)
  })
})

describe('el buscador global', () => {
  const RUTAS = [{ ruta: '/', elemento: <BuscadorGlobal abierto onCerrar={() => undefined} /> }]

  it('en el teléfono el campo va abajo, después de la lista, una sola vez', async () => {
    await montar(RUTAS, '/')
    const campo = await esperar(campoBuscador, 'aparece el campo')
    const lista = document.body.querySelector('[role="dialog"] .overflow-y-auto')
    expect(campos('Soluciones IT')).toHaveLength(1)
    expect(lista && lista.compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('desde 768 px el campo va arriba, antes de la lista, una sola vez', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await montar(RUTAS, '/')
    const campo = await esperar(campoBuscador, 'aparece el campo')
    const lista = document.body.querySelector('[role="dialog"] .overflow-y-auto')
    expect(campos('Soluciones IT')).toHaveLength(1)
    expect(lista && lista.compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })
})
