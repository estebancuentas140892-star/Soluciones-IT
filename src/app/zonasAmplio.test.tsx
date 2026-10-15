// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../lib/db'
import { DispositivoPage } from '../features/dispositivos/DispositivoPage'
import { AgendaPage } from '../features/inicio/AgendaPage'
import {
  control,
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
} from '../pruebas/montaje'

// LAS ZONAS DE 1680 (tarea 339, T10; tarea 199): la ficha de un equipo entre
// la lista de Equipos y su índice, y la Agenda en tres columnas de lectura.
// Por debajo de 1680, nada de esto se monta.
//
// Todo lo sembrado es inventado.

type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
const ventana = window as unknown as VentanaDePrueba

const AMPLIO = { width: 1680, height: 1050 }
const ESCRITORIO = { width: 1280, height: 832 }

/** "YYYY-MM-DD" a N días de hoy (la agenda mira el día real del aparato). */
function fechaRelativa(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

async function sembrarAcceso(id: string, titulo: string, dias: number): Promise<void> {
  await db.credenciales.put({
    id,
    titulo,
    categoria: 'Pruebas',
    tipo: 'cuenta',
    datosCifrados: '',
    venceEn: fechaRelativa(dias),
    dispositivos: [],
    archivo: null,
    updatedAt: '2026-10-14T12:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
  })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
  ventana.happyDOM.setViewport({ width: 375, height: 812 })
})

describe('la ficha de un equipo a 1680 px', () => {
  const RUTAS = [{ ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> }]

  async function sembrarDos(): Promise<void> {
    await sembrarEquipo({ id: 'pc-1', nombre: 'PC de prueba uno', estado: 'Operativo' })
    await sembrarEquipo({ id: 'pc-2', nombre: 'PC de prueba dos', estado: 'Operativo' })
  }

  it('entre la lista de Equipos y su índice, con el equipo abierto marcado', async () => {
    ventana.happyDOM.setViewport(AMPLIO)
    await sembrarDos()
    await montar(RUTAS, '/dispositivos/pc-1')

    const lista = await esperar(() => document.body.querySelector<HTMLElement>('aside[aria-label="Lista"]'), 'la zona de la lista')
    await esperar(() => (lista.textContent ?? '').includes('PC de prueba dos'), 'la lista de equipos')
    expect(lista.querySelector('a[aria-current="page"]')?.textContent).toContain('PC de prueba uno')
    // Un solo buscador en la ventana: el de la lista.
    expect(document.body.querySelectorAll('input[type="search"]')).toHaveLength(1)

    // El índice va en su zona, una sola vez.
    const contexto = document.body.querySelector<HTMLElement>('aside[aria-label="Contexto"]')
    expect(contexto?.querySelector('#mas-del-equipo')).not.toBeNull()
    expect(document.body.querySelectorAll('#mas-del-equipo')).toHaveLength(1)
  })

  it('a 1280 px no hay zonas y el índice sigue en la ficha', async () => {
    ventana.happyDOM.setViewport(ESCRITORIO)
    await sembrarDos()
    await montar(RUTAS, '/dispositivos/pc-1')
    await esperar(() => document.body.querySelector('#mas-del-equipo'), 'el índice')
    expect(document.body.querySelector('aside[aria-label="Lista"]')).toBeNull()
    expect(document.body.querySelector('#mas-del-equipo')?.closest('main')).not.toBeNull()
  })
})

describe('la Agenda a 1680 px', () => {
  const RUTAS = [{ ruta: '/agenda', elemento: <AgendaPage /> }]

  it('tres columnas: los próximos se ven todos, sin "Ver los otros"', async () => {
    ventana.happyDOM.setViewport(AMPLIO)
    for (const [i, dias] of [2, 4, 6, 8, 10].entries()) await sembrarAcceso(`c${i}`, `Acceso próximo ${i + 1}`, dias)
    await montar(RUTAS, '/agenda')

    await esperar(() => textoPantalla().includes('Acceso próximo 5'), 'el quinto próximo')
    expect(control(/^Ver los otros/)).toBeNull()
  })

  it('a 1280 px, dos columnas: los próximos esperan tras "Ver los otros N"', async () => {
    ventana.happyDOM.setViewport(ESCRITORIO)
    for (const [i, dias] of [2, 4, 6, 8, 10].entries()) await sembrarAcceso(`c${i}`, `Acceso próximo ${i + 1}`, dias)
    await montar(RUTAS, '/agenda')

    await esperar(() => textoPantalla().includes('Acceso próximo 1'), 'los próximos')
    expect(textoPantalla()).not.toContain('Acceso próximo 5')
    expect(control(/^Ver los otros/)).not.toBeNull()
  })
})
