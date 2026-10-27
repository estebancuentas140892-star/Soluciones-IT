// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AvisoFlotante } from '../../components/AvisoFlotante'
import { retirarAviso } from '../../components/avisosFlotantes'
import { db } from '../../lib/db'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { AgendaPage } from './AgendaPage'
import { ResolverPage } from './ResolverPage'

// LAS TAREAS PROPIAS, DE PUNTA A PUNTA (tarea 365, D5 a D7 de la auditoría
// del 2026-10-27): «Nueva» en «Tu trabajo de hoy», la hoja, marcar hecha con
// «Deshacer» y el camino «Es un mantenimiento». Todo lo sembrado es inventado.

const RUTAS = [
  {
    ruta: '/',
    elemento: (
      <>
        <ResolverPage />
        <AvisoFlotante />
      </>
    ),
  },
  {
    ruta: '/agenda',
    elemento: (
      <>
        <AgendaPage />
        <AvisoFlotante />
      </>
    ),
  },
]

/** Escribe en un campo controlado de React como lo haría el teclado. */
async function teclear(campo: HTMLInputElement, texto: string): Promise<void> {
  await act(async () => {
    const asignar = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    asignar?.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function campoQueHacer(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[placeholder="Ej.: Instalar la impresora de Mercadeo"]')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  retirarAviso()
  await desmontarTodo()
})

describe('una tarea propia desde «Tu trabajo de hoy» (teléfono)', () => {
  it('«Nueva» abre la hoja; guardada para hoy, sale en la tarjeta con su razón', async () => {
    await montar(RUTAS, '/')
    await tocar(await esperarControl('Nueva tarea'))
    const campo = await esperar(campoQueHacer, 'la hoja «Nueva tarea»')
    expect(textoPantalla()).toContain('¿Cuándo?')
    expect(control('Hoy')?.getAttribute('aria-pressed')).toBe('true')

    // Sin «qué», no se guarda y lo dice.
    await tocar(await esperarControl('Guardar tarea'))
    expect(textoPantalla()).toContain('Escribe qué hay que hacer.')
    expect(await db.tareas.count()).toBe(0)

    await teclear(campo, 'Cambiar el cable de red de prueba')
    await tocar(await esperarControl('Guardar tarea'))
    await esperar(() => textoPantalla().includes('Tarea guardada · Para hoy'), 'el aviso')
    const [guardada] = await db.tareas.toArray()
    expect(guardada).toMatchObject({ titulo: 'Cambiar el cable de red de prueba', hechaEn: null, dispositivoId: null })
    expect(guardada.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(guardada.creadaPor).not.toBeNull()

    await esperar(() => document.body.querySelector(`[data-fila-tarea="${guardada.id}"]`), 'la fila de la tarea')
    expect(textoPantalla()).toContain('1 para hoy')
    expect(textoPantalla()).toContain('Para hoy')
  })

  it('el círculo la marca hecha; «Deshacer» la devuelve', async () => {
    await db.tareas.put({
      id: 't-1',
      titulo: 'Revisar el computador de prueba',
      fecha: new Date().toISOString().slice(0, 10),
      dispositivoId: null,
      nota: '',
      hechaEn: null,
      creadaPor: null,
      updatedAt: '2026-10-27T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })
    await montar(RUTAS, '/')
    await tocar(await esperarControl('Marcar como hecha: Revisar el computador de prueba'))
    await esperar(() => textoPantalla().includes('Hecha: Revisar el computador de prueba'), 'el aviso')
    expect((await db.tareas.get('t-1'))?.hechaEn).not.toBeNull()
    await esperar(() => !document.body.querySelector('[data-fila-tarea="t-1"]'), 'sale de la lista')

    await tocar(await esperarControl('Deshacer'))
    await esperar(() => document.body.querySelector('[data-fila-tarea="t-1"]'), 'vuelve a la lista')
    expect((await db.tareas.get('t-1'))?.hechaEn).toBeNull()
  })

  it('con un equipo y «Es un mantenimiento», se programa el mantenimiento y no una tarea', async () => {
    await sembrarEquipo({ id: 'pc-prueba', nombre: 'PC-PRUEBA-04' })
    await montar(RUTAS, '/')
    await tocar(await esperarControl('Nueva tarea'))
    await esperar(campoQueHacer, 'la hoja')
    await tocar(await esperarControl('Elegir equipo'))
    await tocar(await esperarControl(/^PC-PRUEBA-04/))
    const casilla = await esperar(
      () => document.body.querySelector<HTMLInputElement>('input[type="checkbox"]'),
      'la casilla del mantenimiento',
    )
    await tocar(casilla)
    // La hoja pasa a llamarse así, y sin «Sin fecha» ni «¿Qué hay que hacer?».
    await esperar(() => textoPantalla().includes('Se guarda en su Mantenimiento, como hoy.'), 'la opción')
    expect(campoQueHacer()).toBeNull()
    expect(control('Sin fecha')).toBeNull()
    await tocar(await esperarControl('Programar mantenimiento'))

    await esperar(() => textoPantalla().includes('Mantenimiento programado: toca hoy'), 'el aviso')
    const mantenimientos = await db.mantenimientos.toArray()
    expect(mantenimientos).toHaveLength(1)
    expect(mantenimientos[0]).toMatchObject({ dispositivoId: 'pc-prueba', tipo: 'preventivo', estado: 'programado' })
    expect(await db.tareas.count()).toBe(0)
  })
})

describe('la Agenda con tareas (tarea 365)', () => {
  it('«Nueva tarea» al pulgar; una tarea sin fecha va en «Sin fecha» y se edita al tocarla', async () => {
    await db.tareas.put({
      id: 't-sin',
      titulo: 'Cambiar el cable de la taquilla de prueba',
      fecha: null,
      dispositivoId: null,
      nota: '',
      hechaEn: null,
      creadaPor: null,
      updatedAt: '2026-10-27T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })
    await montar(RUTAS, '/agenda')
    const texto = await esperar(() => (textoPantalla().includes('Cambiar el cable') ? textoPantalla() : null), 'la tarea')
    expect(texto.indexOf('Sin fecha')).toBeLessThan(texto.indexOf('Cambiar el cable'))
    expect(control('Nueva tarea')).not.toBeNull()

    await tocar(await esperarControl(/^Editar Cambiar el cable de la taquilla de prueba/))
    const campo = await esperar(campoQueHacer, 'la hoja de edición')
    expect(campo.value).toBe('Cambiar el cable de la taquilla de prueba')
    expect(textoPantalla()).toContain('Editar tarea')
    expect(control('Sin fecha')?.getAttribute('aria-pressed')).toBe('true')
    await teclear(campo, 'Cambiar el cable de la taquilla 2 de prueba')
    await tocar(await esperarControl('Guardar tarea'))
    await esperarQue(
      async () => (await db.tareas.get('t-sin'))?.titulo === 'Cambiar el cable de la taquilla 2 de prueba',
      'la tarea editada',
    )
    expect(ubicacionActual().pathname).toBe('/agenda')
  })
})
