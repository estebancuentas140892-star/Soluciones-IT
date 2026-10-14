// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Sin servidor: el bucket se simula (quitar el último vínculo borra el
// archivo) y la URL del documento sale de su referencia.
const { remove } = vi.hoisted(() => ({ remove: vi.fn(async () => ({ data: [], error: null })) }))
vi.mock('../../lib/supabase', async (original) => ({
  ...(await original<typeof import('../../lib/supabase')>()),
  supabase: { storage: { from: () => ({ remove }) }, auth: { getSession: async () => ({ data: { session: null } }) } },
  supabaseConfigured: true,
}))
vi.mock('../../lib/sync', async (original) => ({
  ...(await original<typeof import('../../lib/sync')>()),
  programarSync: () => {},
}))
vi.mock('../../components/useUrlAdjunto', () => ({
  useUrlAdjunto: (referencia: string | null) => (referencia ? `blob:prueba/${referencia}` : null),
}))

import { db, type Adjunto } from '../../lib/db'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarQue,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { DispositivoPage } from '../dispositivos/DispositivoPage'
import { DocumentoDelEquipoPage } from './DocumentoDelEquipoPage'

// UN DOCUMENTO, VARIOS EQUIPOS, DE PUNTA A PUNTA (tarea 322, encargo del
// 2026-10-10, fase D). Lo que solo se ve montando las pantallas:
//
//   - "Más del equipo" > "Adjuntos": tocar un adjunto abre su pantalla;
//   - "Vincular a otro equipo" lo pone en otro equipo con su página, sin
//     subir nada, y la pantalla lo lista en "También en";
//   - editar guarda el origen y la fecha en los dos equipos y la nota solo
//     en este; sin confirmar, la pantalla lo dice;
//   - quitarlo de un equipo lo deja en el otro, y el archivo sigue.
//
// Todo lo sembrado es INVENTADO. La base es la local (IndexedDB).

const RUTAS = [
  { ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> },
  { ruta: '/dispositivos/:dispositivoId/adjuntos/:adjuntoId', elemento: <DocumentoDelEquipoPage /> },
]

const AHORA = '2026-10-10T12:00:00.000Z'
const REFERENCIA = 'compartidos/hash-acta-inventada'

async function sembrarBase(): Promise<void> {
  await sembrarPerfil(false)
  await db.categorias.put({
    id: 'cat-equipos',
    nombre: 'Computadores',
    icono: '',
    orden: 1,
    esRed: false,
    color: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
  await sembrarEquipo({ id: 'pc-a', nombre: 'Equipo de prueba A' })
  await sembrarEquipo({ id: 'pc-b', nombre: 'Equipo de prueba B', ubicacion: 'Taquilla inventada' })
  await sembrarEquipo({ id: 'pc-c', nombre: 'Equipo de prueba C' })
  const acta: Adjunto = {
    id: 'adj-a',
    entidadTipo: 'dispositivo',
    entidadId: 'pc-a',
    nombre: 'acta-inventada.pdf',
    tipo: 'application/pdf',
    referencia: REFERENCIA,
    nota: '',
    origen: '',
    fechaDocumento: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  }
  await db.adjuntos.put(acta)
}

function campoDe(etiqueta: string): HTMLInputElement {
  const rotulo = Array.from(document.body.querySelectorAll('label')).find((l) =>
    (l.textContent ?? '').trim().startsWith(etiqueta),
  )
  const campo = rotulo?.querySelector<HTMLInputElement>('input')
  if (!campo) throw new Error(`No está el campo "${etiqueta}".`)
  return campo
}

function enviarDeLaHoja(): HTMLElement {
  const boton = document.body.querySelector<HTMLElement>('[role="dialog"] button[type="submit"]')
  if (!boton) throw new Error('Sin hoja con formulario')
  return boton
}

async function abrirActaDesdeLaFicha(equipo: string): Promise<void> {
  await montar(RUTAS, `/dispositivos/${equipo}`)
  await tocar(await esperar(() => control(/^Adjuntos/), 'la fila Adjuntos'))
  await tocar(await esperar(() => control(/^acta-inventada\.pdf/), 'la tarjeta del acta'))
}

beforeEach(async () => {
  await limpiarBase()
  remove.mockClear()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('el adjunto de un equipo', () => {
  it('se abre desde "Más del equipo" y dice lo que no está confirmado', async () => {
    await sembrarBase()
    await abrirActaDesdeLaFicha('pc-a')

    await esperar(() => textoPantalla().includes('Del documento'), 'la pantalla del adjunto')
    expect(ubicacionActual().pathname).toBe('/dispositivos/pc-a/adjuntos/adj-a')
    expect(textoPantalla()).toMatch(/Origen\s*Sin confirmar/)
    expect(textoPantalla()).toMatch(/Fecha\s*Sin confirmar/)
    expect(textoPantalla()).toContain('Sin página ni nota.')
    expect(textoPantalla()).toContain('Solo en este equipo.')
    // La acción rellena abre el documento.
    expect(control('Abrir')?.getAttribute('href')).toBe(`blob:prueba/${REFERENCIA}`)
  })

  it('se vincula a otro equipo con su página, sin subir nada, y lo lista en "También en"', async () => {
    await sembrarBase()
    await abrirActaDesdeLaFicha('pc-a')
    await tocar(await esperar(() => control('Vincular a otro equipo'), 'Vincular a otro equipo'))
    await esperar(() => document.body.querySelector('[role="dialog"]'), 'la hoja de vincular')

    // El equipo de esta pantalla no se ofrece: ya lo tiene.
    expect(control(/^Equipo de prueba A/)).toBeNull()
    const buscar = document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar equipo"]')
    if (!buscar) throw new Error('Sin buscador de equipos')
    await escribir(buscar, 'prueba B')
    const filaB = await esperar(() => control(/^Equipo de prueba B/), 'el equipo B en la lista')
    await tocar(filaB)
    // La fila se queda en su sitio, marcada: la página se escribe abajo.
    expect(filaB.isConnected).toBe(true)
    expect(filaB.getAttribute('aria-checked')).toBe('true')
    await escribir(campoDe('Página o nota en Equipo de prueba B'), 'Página 2')
    await tocar(await esperar(() => control('Vincular a 1 equipo'), 'Vincular a 1 equipo'))

    await esperarQue(async () => (await db.adjuntos.where('referencia').equals(REFERENCIA).count()) === 2, 'el vínculo nuevo')
    const deB = (await db.adjuntos.where('referencia').equals(REFERENCIA).toArray()).find((a) => a.entidadId === 'pc-b')
    expect(deB).toMatchObject({ entidadTipo: 'dispositivo', nombre: 'acta-inventada.pdf', nota: 'Página 2' })
    expect(await db.archivosPendientes.count()).toBe(0)
    const enOtro = await esperar(() => control(/^Equipo de prueba B/), 'B en "También en"')
    expect(enOtro.getAttribute('href')).toBe(`/dispositivos/pc-b/adjuntos/${deB?.id}`)
    expect(enOtro.textContent).toContain('Página 2')
    expect(textoPantalla()).not.toContain('Solo en este equipo.')
  })

  it('editar guarda origen y fecha en los dos equipos y la nota solo en este', async () => {
    await sembrarBase()
    await db.adjuntos.put({ ...(await db.adjuntos.get('adj-a'))!, id: 'adj-b', entidadId: 'pc-b', nota: 'Página 2' })
    await abrirActaDesdeLaFicha('pc-a')
    await tocar(await esperar(() => control('Editar'), 'Editar'))
    await esperar(() => textoPantalla().includes('se guardan también en el otro equipo que lo tiene'), 'el aviso de los dos equipos')

    await escribir(campoDe('Origen'), 'Acta de entrega inventada')
    await escribir(campoDe('Fecha del documento'), '2025-03-12')
    await escribir(campoDe('Página o nota en Equipo de prueba A'), 'Página 1')
    await tocar(enviarDeLaHoja())

    await esperarQue(async () => (await db.adjuntos.get('adj-b'))?.origen === 'Acta de entrega inventada', 'el origen en B')
    expect(await db.adjuntos.get('adj-a')).toMatchObject({ origen: 'Acta de entrega inventada', fechaDocumento: '2025-03-12', nota: 'Página 1' })
    expect(await db.adjuntos.get('adj-b')).toMatchObject({ fechaDocumento: '2025-03-12', nota: 'Página 2' })
    await esperar(() => /Origen\s*Acta de entrega inventada/.test(textoPantalla()), 'el origen en la pantalla')
    expect(textoPantalla()).toContain('Página 1')
  })

  it('quitarlo de un equipo lo deja en el otro y no borra el archivo', async () => {
    await sembrarBase()
    await db.adjuntos.put({ ...(await db.adjuntos.get('adj-a'))!, id: 'adj-b', entidadId: 'pc-b', nota: 'Página 2' })
    await abrirActaDesdeLaFicha('pc-a')
    await tocar(await esperar(() => control('Más acciones: quitar de este equipo'), 'el menú'))
    await tocar(await esperar(() => control('Quitar de este equipo'), 'Quitar de este equipo'))
    await esperar(() => textoPantalla().includes('Sale solo de este equipo: sigue en el otro equipo que lo tiene.'), 'la confirmación')
    await tocar(await esperar(() => control('Quitar'), 'Quitar'))

    await esperarQue(async () => Boolean((await db.adjuntos.get('adj-a'))?.eliminadoEn), 'quitado de A')
    expect((await db.adjuntos.get('adj-b'))?.eliminadoEn).toBeNull()
    expect(remove).not.toHaveBeenCalled()
    await esperar(() => ubicacionActual().pathname === '/dispositivos/pc-a', 'de vuelta en la ficha de A')
  })

  it('en la ficha del otro equipo, la tarjeta dice su página y en cuántos equipos más está', async () => {
    await sembrarBase()
    await db.adjuntos.put({ ...(await db.adjuntos.get('adj-a'))!, id: 'adj-b', entidadId: 'pc-b', nota: 'Página 2' })
    await montar(RUTAS, '/dispositivos/pc-b')
    await tocar(await esperar(() => control(/^Adjuntos/), 'la fila Adjuntos'))

    const tarjeta = await esperar(() => control('acta-inventada.pdf, Página 2, En 1 equipo más'), 'la tarjeta con su página')
    await tocar(tarjeta)
    await esperar(() => ubicacionActual().pathname === '/dispositivos/pc-b/adjuntos/adj-b', 'su pantalla desde B')
  })

  it('un enlace con el equipo equivocado no enseña el adjunto de otro', async () => {
    await sembrarBase()
    await montar(RUTAS, '/dispositivos/pc-c/adjuntos/adj-a')
    await esperar(() => ubicacionActual().pathname === '/dispositivos/pc-c', 'de vuelta a la ficha de C')
  })
})
