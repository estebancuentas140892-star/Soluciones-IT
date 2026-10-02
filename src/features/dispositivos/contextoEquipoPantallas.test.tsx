// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { desmontarTodo, esperar, limpiarBase, montar, sembrarEquipo, sembrarPerfil, textoPantalla } from '../../pruebas/montaje'
import { AsignarEquipoPage } from '../personas/AsignarEquipoPage'
import { PersonaPage } from '../personas/PersonaPage'
import { EquiposRedPage } from '../red/EquiposRedPage'
import { DispositivoPage } from './DispositivoPage'
import { DispositivosPage } from './DispositivosPage'

// EL SUBTÍTULO DE UN EQUIPO SOLO DICE LO QUE SU NOMBRE NO DICE YA (tarea
// 277). La regla pura se prueba en `src/lib/contextoEquipo.test.ts`; aquí,
// lo que solo se ve montando las pantallas: que cada una la aplica, que una
// fila sin nada que añadir no deja una línea vacía, que la ubicación
// vinculada se lee con su nombre de hoy y que, donde hay que elegir, dos
// equipos distintos no quedan iguales.
//
// Todo lo que se siembra es INVENTADO.

const AHORA = '2026-09-29T12:00:00.000Z'
const marca = { updatedAt: AHORA, updatedBy: null, eliminadoEn: null }

const RUTAS = [
  { ruta: '/dispositivos', elemento: <DispositivosPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> },
  { ruta: '/red/equipos', elemento: <EquiposRedPage /> },
  { ruta: '/personas/:personaId', elemento: <PersonaPage /> },
  { ruta: '/personas/:personaId/asignar', elemento: <AsignarEquipoPage /> },
]

async function sembrarCategorias() {
  await db.categorias.bulkPut([
    { id: 'cat-imp', nombre: 'Impresoras', icono: '', orden: 1, esRed: false, color: null, ...marca },
    { id: 'cat-equipos', nombre: 'Computadores', icono: '', orden: 2, esRed: false, color: null, ...marca },
    { id: 'cat-sw', nombre: 'Switches', icono: '', orden: 3, esRed: true, color: null, ...marca },
  ])
  // Una ubicación renombrada: los equipos vinculados guardan el texto viejo.
  await db.ubicaciones.put({ id: 'u-taq', nombre: 'Taquilla Principal', padreId: null, notas: '', ...marca })
}

async function sembrarPersonas() {
  const persona = (id: string, nombre: string) => ({
    id,
    nombre,
    notas: '',
    estado: 'activa' as const,
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    ...marca,
  })
  await db.personas.bulkPut([persona('ana', 'Ana de Prueba'), persona('luis', 'Luis de Prueba')])
}

/** La fila de un equipo en una lista: el enlace a su ficha. */
function filaDe(id: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`a[href="/dispositivos/${id}"]`)
}

/** Las líneas de texto de la columna del nombre: nombre y, si la hay, su subtítulo. */
function lineasDeFila(id: string): string[] {
  const fila = filaDe(id)
  const columna = fila?.querySelector('div.min-w-0')
  return Array.from(columna?.querySelectorAll('p') ?? []).map((p) => p.textContent ?? '')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  sessionStorage.clear()
  await sembrarCategorias()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('Equipos', () => {
  beforeEach(async () => {
    await sembrarEquipo({ id: 'imp-taq', nombre: 'Impresora Taquilla', categoriaId: 'cat-imp', ubicacion: 'Taquilla' })
    await sembrarEquipo({ id: 'hp', nombre: 'HP M404', categoriaId: 'cat-imp', ubicacion: 'Taquilla' })
    await sembrarEquipo({ id: 'hp-taq', nombre: 'HP M404 Taquilla', categoriaId: 'cat-imp', ubicacion: 'Taquilla' })
    await sembrarEquipo({ id: 'hp-vinc', nombre: 'HP M405', categoriaId: 'cat-imp', ubicacion: 'taquilla vieja', ubicacionId: 'u-taq' })
  })

  it('cada fila dice solo lo que su nombre no dice, y sin nada que añadir no deja línea vacía', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => filaDe('hp-vinc'), 'la lista')
    expect(lineasDeFila('imp-taq')).toEqual(['Impresora Taquilla'])
    expect(lineasDeFila('hp')).toEqual(['HP M404', 'Impresoras · Taquilla'])
    expect(lineasDeFila('hp-taq')).toEqual(['HP M404 Taquilla', 'Impresoras'])
  })

  it('la ubicación vinculada se lee con el nombre de su ficha, no con el texto viejo', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => filaDe('hp-vinc'), 'la lista')
    expect(lineasDeFila('hp-vinc')).toEqual(['HP M405', 'Impresoras · Taquilla Principal'])
    expect(textoPantalla()).not.toContain('taquilla vieja')
  })
})

describe('la ficha del equipo', () => {
  // La identidad (propuesta final de Claude Design, 2026-10-01): el nombre
  // a 24 px y, debajo, la línea de identidad.
  function nombreEnIdentidad(nombre: string): HTMLElement | null {
    return (
      Array.from(document.body.querySelectorAll<HTMLElement>('span')).find(
        (s) => s.textContent === nombre && s.className.includes('text-[24px]'),
      ) ?? null
    )
  }
  function lineaBajoElNombre(nombre: string): string | null {
    return nombreEnIdentidad(nombre)?.nextElementSibling?.textContent ?? null
  }
  // Con una persona a cargo, la línea solo dice lo que el nombre no dice.
  async function conResponsable(id: string) {
    await sembrarPersonas()
    await db.dispositivos.update(id, { responsableId: 'ana', responsable: 'Ana de Prueba' })
  }

  it('bajo el nombre calla la categoría que el nombre ya dice y deja la marca y el modelo', async () => {
    await sembrarEquipo({ id: 'imp', nombre: 'Impresora Taquilla', categoriaId: 'cat-imp', marca: 'HP', modelo: 'LaserJet' })
    await conResponsable('imp')
    await montar(RUTAS, '/dispositivos/imp')
    await esperar(() => lineaBajoElNombre('Impresora Taquilla') === 'HP LaserJet', 'la línea de identidad')
  })

  it('si no queda nada que decir, no hay línea', async () => {
    await sembrarEquipo({ id: 'imp', nombre: 'Impresora Taquilla', categoriaId: 'cat-imp' })
    await conResponsable('imp')
    await montar(RUTAS, '/dispositivos/imp')
    // Mientras la categoría carga se ve un instante la fecha (como antes de
    // esta tarea); con la categoría ya leída, "Impresoras" se calla y no
    // queda ninguna línea. Si quedara, la espera vence y la prueba falla.
    const titulo = await esperar(() => {
      const nombre = nombreEnIdentidad('Impresora Taquilla')
      return nombre && nombre.nextElementSibling === null ? nombre : null
    }, 'sin línea bajo el nombre')
    expect(titulo.parentElement?.textContent).toBe('Impresora Taquilla')
  })

  it('sin nadie a cargo lo dice la línea de identidad, con "Asignar", y no una fila de datos', async () => {
    await sembrarEquipo({ id: 'imp', nombre: 'Impresora Taquilla', categoriaId: 'cat-imp', marca: 'HP', modelo: 'LaserJet' })
    await montar(RUTAS, '/dispositivos/imp')
    // "HP LaserJet · sin responsable" (el separador va pegado al primer tramo) y "Asignar".
    await esperar(
      () => lineaBajoElNombre('Impresora Taquilla')?.replace(/\s+/g, ' ').startsWith('HP LaserJet ·sin responsable'),
      'la línea de identidad',
    )
    expect(textoPantalla()).not.toContain('Sin responsable')
    expect(document.body.querySelector('button[aria-label="Asignar un responsable"]')).not.toBeNull()
  })
})

describe('Equipos de red', () => {
  it('bajo cada switch, la categoría y la marca solo si el nombre no las dice; el lugar es el título del grupo', async () => {
    await sembrarEquipo({ id: 'sw-rack', nombre: 'Switch Rack 1', categoriaId: 'cat-sw', ubicacionId: 'u-taq' })
    await sembrarEquipo({ id: 'sw-core', nombre: 'SW-CORE', categoriaId: 'cat-sw', marca: 'Cisco', ubicacionId: 'u-taq' })
    await montar(RUTAS, '/red/equipos')
    await esperar(() => filaDe('sw-core'), 'la lista de red')
    expect(lineasDeFila('sw-rack')).toEqual(['Switch Rack 1'])
    expect(lineasDeFila('sw-core')).toEqual(['SW-CORE', 'Switches · Cisco'])
  })
})

describe('equipos de una persona y asignar', () => {
  beforeEach(async () => {
    await sembrarPersonas()
  })

  it('en la ficha de la persona, cada equipo actual no repite el lugar que su nombre ya dice', async () => {
    await sembrarEquipo({
      id: 'pc-tes',
      nombre: 'PC Tesorería',
      placaInventario: 'EJ-1',
      ubicacion: 'Tesorería',
      responsable: 'Ana de Prueba',
      responsableId: 'ana',
    })
    await montar(RUTAS, '/personas/ana')
    await esperar(() => filaDe('pc-tes'), 'el equipo actual')
    const detalle = Array.from(filaDe('pc-tes')?.querySelectorAll('span.block') ?? []).map((s) => s.textContent)
    expect(detalle).toEqual(['PC Tesorería', 'Placa EJ-1'])
  })

  it('al asignar, callar nunca deja iguales dos equipos distintos: esos dos dicen su lugar', async () => {
    await sembrarEquipo({ id: 'pc-a', nombre: 'PC Caja Norte', ubicacion: 'Caja', estado: 'Disponible' })
    await sembrarEquipo({ id: 'pc-b', nombre: 'PC Caja Norte', ubicacion: 'Caja Norte', estado: 'Disponible' })
    await sembrarEquipo({ id: 'pc-tes', nombre: 'PC Tesorería', ubicacion: 'Tesorería', estado: 'Disponible' })
    await montar(RUTAS, '/personas/luis/asignar')
    const opcion = (texto: string) =>
      Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]')).filter((b) => b.textContent?.includes(texto))
    await esperar(() => opcion('PC Tesorería').length === 1, 'la lista de candidatos')
    const cajas = opcion('PC Caja Norte').map((b) => b.textContent)
    expect(cajas).toHaveLength(2)
    expect(cajas.some((t) => t?.includes('PC Caja NorteCaja') && !t.includes('Caja NorteCaja Norte'))).toBe(true)
    expect(cajas.some((t) => t?.includes('Caja NorteCaja Norte'))).toBe(true)
    // El que no se confunde con ninguno no repite su lugar.
    expect(opcion('PC Tesorería')[0].textContent).not.toContain('PC TesoreríaTesorería')
  })
})
