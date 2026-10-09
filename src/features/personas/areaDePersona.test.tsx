// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Persona } from '../../lib/db'
import { aFilaRemota } from '../../lib/tablas'
import {
  desmontarTodo,
  enviarFormulario,
  escribir,
  esperar,
  limpiarBase,
  montar,
  sembrarPerfil,
  textoPantalla,
  ubicacionActual,
} from '../../pruebas/montaje'
import { PersonaForm } from './PersonaForm'
import { PersonaPage } from './PersonaPage'

// EL ÁREA DE UNA PERSONA ES UN DATO PROPIO (tarea 317): se escribe en su
// formulario, separada de las notas; se conserva al editar; se puede
// vaciar; viaja a la cola de sincronización como cualquier otro campo, y
// nunca se deduce de las notas. Todo lo sembrado es inventado.

const AHORA = '2026-10-09T12:00:00.000Z'

const RUTAS = [
  { ruta: '/personas', elemento: <p>LISTA DE PERSONAS</p> },
  { ruta: '/personas/nueva', elemento: <PersonaForm /> },
  { ruta: '/personas/:personaId', elemento: <PersonaPage /> },
  { ruta: '/personas/:personaId/editar', elemento: <PersonaForm /> },
]

function persona(id: string, nombre: string, cambios: Partial<Persona> = {}): Persona {
  return {
    id,
    nombre,
    area: '',
    notas: '',
    estado: 'activa',
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

/** Los rótulos de los campos del formulario, en su orden. */
function rotulos(): string[] {
  return Array.from(document.body.querySelectorAll('form label')).map(
    (l) => l.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  )
}

/** El campo cuyo rótulo empieza así. */
function campo(rotulo: string): HTMLInputElement | HTMLTextAreaElement | null {
  const label = Array.from(document.body.querySelectorAll('form label')).find((l) =>
    l.querySelector('span')?.textContent?.trim().startsWith(rotulo),
  )
  return label?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ?? null
}

async function guardar(): Promise<void> {
  await enviarFormulario(campo('Nombre')!)
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('el área en el formulario de la persona (tarea 317)', () => {
  it('va entre el nombre y la fecha de ingreso, separada de las notas', async () => {
    await montar(RUTAS, '/personas/nueva')
    await esperar(() => campo('Área'), 'el campo Área')

    expect(rotulos()).toEqual(['Nombre *', 'Área (opcional)', 'Fecha de ingreso (opcional)', 'Notas (opcional)'])
    expect(campo('Área')?.getAttribute('placeholder')).toBe('Control Interno')
    expect(campo('Notas')?.getAttribute('placeholder')).not.toMatch(/área/i)
  })

  it('al crear guarda el área y la encola para el servidor como cualquier campo', async () => {
    await montar(RUTAS, '/personas/nueva')
    await escribir(await esperar(() => campo('Nombre') as HTMLInputElement, 'Nombre'), 'Esteban Cardona Rendón')
    await escribir(campo('Área') as HTMLInputElement, '  Control Interno  ')
    await guardar()
    await esperar(() => /^\/personas\/[^/]+$/.test(ubicacionActual().pathname), 'la ficha nueva')

    const id = ubicacionActual().pathname.split('/')[2]
    const guardada = await db.personas.get(id)
    expect(guardada?.area).toBe('Control Interno')
    expect(guardada?.notas).toBe('')

    // Sin red el cambio espera en la cola, y al subir lleva su columna.
    const pendiente = (await db.cambiosPendientes.toArray()).find((c) => c.tabla === 'personas' && c.entidadId === id)
    expect(pendiente).toBeDefined()
    expect(aFilaRemota('personas', pendiente!.payload).area).toBe('Control Interno')
  })

  it('al editar carga el área y la conserva si se cambia otra cosa', async () => {
    await db.personas.put(persona('esteban', 'Esteban Cardona', { area: 'Control Interno', notas: 'Ext. 000' }))
    await montar(RUTAS, '/personas/esteban/editar')
    const area = await esperar(() => (campo('Área')?.value === 'Control Interno' ? campo('Área') : null), 'el área cargada')

    expect(area.value).toBe('Control Interno')
    await escribir(campo('Nombre') as HTMLInputElement, 'Esteban Cardona Rendón')
    await guardar()
    await esperar(() => ubicacionActual().pathname === '/personas/esteban', 'la ficha')

    const guardada = await db.personas.get('esteban')
    expect(guardada?.nombre).toBe('Esteban Cardona Rendón')
    expect(guardada?.area).toBe('Control Interno')
    expect(guardada?.notas).toBe('Ext. 000')
  })

  it('el área se puede vaciar, y vacía viaja como texto vacío', async () => {
    await db.personas.put(persona('ana', 'Ana Gil', { area: 'TI' }))
    await montar(RUTAS, '/personas/ana/editar')
    await esperar(() => (campo('Área')?.value === 'TI' ? campo('Área') : null), 'el área cargada')
    await escribir(campo('Área') as HTMLInputElement, '')
    await guardar()
    await esperar(() => ubicacionActual().pathname === '/personas/ana', 'la ficha')

    const guardada = await db.personas.get('ana')
    expect(guardada?.area).toBe('')
    const pendiente = (await db.cambiosPendientes.toArray()).find((c) => c.entidadId === 'ana')
    expect(aFilaRemota('personas', pendiente!.payload).area).toBe('')
  })

  it('nunca deduce el área de las notas: una persona antigua sin área la sigue teniendo vacía', async () => {
    // Guardada antes de la tarea 317: sin la propiedad `area`, y con el
    // área escrita en las notas, como se hacía entonces.
    const { area: _sinArea, ...vieja } = persona('vieja', 'Nora Antigua', { notas: 'Control Interno, ext. 000' })
    await db.personas.put(vieja as Persona)
    await montar(RUTAS, '/personas/vieja/editar')
    await esperar(() => (campo('Nombre')?.value === 'Nora Antigua' ? campo('Área') : null), 'el formulario cargado')

    expect(campo('Área')?.value).toBe('')
    expect(campo('Notas')?.value).toBe('Control Interno, ext. 000')
    // Se cambia el nombre para que el guardado escriba de verdad (sin
    // cambios, `guardarRegistro` no escribe nada).
    await escribir(campo('Nombre') as HTMLInputElement, 'Nora Antigua Pérez')
    await guardar()
    await esperar(() => ubicacionActual().pathname === '/personas/vieja', 'la ficha')

    const guardada = await db.personas.get('vieja')
    expect(guardada?.nombre).toBe('Nora Antigua Pérez')
    expect(guardada?.area).toBe('')
    expect(guardada?.notas).toBe('Control Interno, ext. 000')
  })
})

describe('el área en la ficha de la persona (tarea 317)', () => {
  it('se lee bajo el nombre, antes de la fecha de ingreso', async () => {
    await db.personas.put(persona('esteban', 'Esteban Cardona Rendón', { area: 'Control Interno', fechaIngreso: '2025-03-12' }))
    await montar(RUTAS, '/personas/esteban')
    await esperar(() => textoPantalla().includes('Control Interno · Ingresó el'), 'la línea de datos')
  })

  it('una persona antigua sin área abre igual, sin línea vacía ni separador', async () => {
    const { area: _sinArea, ...vieja } = persona('vieja', 'Nora Antigua')
    await db.personas.put(vieja as Persona)
    await montar(RUTAS, '/personas/vieja')
    await esperar(() => textoPantalla().includes('Nora Antigua'), 'la ficha')

    expect(textoPantalla()).not.toContain('undefined')
    expect(textoPantalla()).not.toMatch(/·\s*Ingresó/)
  })
})
