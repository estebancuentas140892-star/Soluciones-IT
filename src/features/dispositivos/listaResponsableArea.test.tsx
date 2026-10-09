// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Persona } from '../../lib/db'
import {
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
} from '../../pruebas/montaje'
import { DispositivosPage } from './DispositivosPage'

// LA LISTA DE EQUIPOS DICE QUIÉN TIENE CADA EQUIPO Y DE QUÉ ÁREA ES
// (tarea 317). Montando la pantalla de verdad: el subtítulo que recibe
// `FilaDispositivo`, la búsqueda por área, el bloque de red sin cambios y
// que el área se lee de la persona (cambiarla cambia la lista sin
// reescribir ningún equipo). Las reglas puras se prueban aparte, en
// `responsableEnLista.test.ts`. Todo lo sembrado es inventado.

const AHORA = '2026-10-09T12:00:00.000Z'

const RUTAS = [
  { ruta: '/dispositivos', elemento: <DispositivosPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
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

async function sembrar() {
  await db.categorias.bulkPut([
    { id: 'cat-equipos', nombre: 'Computadores', icono: '', orden: 1, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
    { id: 'cat-red', nombre: 'Switches', icono: '', orden: 2, esRed: true, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
  ])
  await db.personas.bulkPut([
    persona('esteban', 'Esteban Cardona Rendón', { area: 'Control Interno' }),
    persona('ana', 'Ana Gil', { area: 'TI' }),
    persona('maria', 'María Fernanda Restrepo Echeverri', { area: 'Gestión Administrativa y Financiera' }),
    persona('luis', 'Luis Pérez de Prueba'),
    persona('eliminada', 'Persona eliminada de prueba', { area: 'Control Interno', eliminadoEn: AHORA }),
  ])
  // Una persona guardada antes de la tarea 317: sin la propiedad `area`.
  const { area: _sinArea, ...vieja } = persona('vieja', 'Nora Antigua de Prueba')
  await db.personas.put(vieja as Persona)

  const enUso = { categoriaId: 'cat-equipos', estado: 'operativo', ip: '10.31.7.10' }
  await sembrarEquipo({ id: 'metrojp19', nombre: 'metrojp19', ...enUso, responsable: 'Esteban Cardona Rendón', responsableId: 'esteban' })
  await sembrarEquipo({ id: 'metro-ana', nombre: 'metro-ana', ...enUso, responsable: 'Ana Gil', responsableId: 'ana' })
  await sembrarEquipo({ id: 'metro-maria', nombre: 'metro-maria', ...enUso, responsable: 'María', responsableId: 'maria' })
  await sembrarEquipo({ id: 'metro-luis', nombre: 'metro-luis', ...enUso, responsable: 'Luis Pérez de Prueba', responsableId: 'luis' })
  await sembrarEquipo({ id: 'metro-vieja', nombre: 'metro-vieja', ...enUso, responsable: 'Nora Antigua de Prueba', responsableId: 'vieja' })
  await sembrarEquipo({ id: 'metro-archivo', nombre: 'metro-archivo', ...enUso, responsable: 'Archivo' })
  await sembrarEquipo({ id: 'metro-libre', nombre: 'metro-libre', ...enUso, ubicacion: 'Administración de prueba' })
  await sembrarEquipo({
    id: 'metro-eliminada',
    nombre: 'metro-eliminada',
    ...enUso,
    ubicacion: 'Bodega de prueba',
    responsable: 'Persona eliminada de prueba',
    responsableId: 'eliminada',
  })
  await sembrarEquipo({
    id: 'sw-piso',
    nombre: 'SW-PISO-4',
    categoriaId: 'cat-red',
    ip: '10.31.7.2',
    responsable: 'Esteban Cardona Rendón',
    responsableId: 'esteban',
  })
}

/** La línea bajo el nombre de un equipo, tal como la dibuja `FilaDispositivo`. */
function subtituloDe(id: string): HTMLElement | null {
  const nombre = document.body.querySelector<HTMLElement>(`a[href="/dispositivos/${id}"] p`)
  return (nombre?.nextElementSibling as HTMLElement | null) ?? null
}

function campoEquipos(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Equipos"]')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  sessionStorage.clear()
  await sembrar()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('la lista de Equipos con persona y área (tarea 317)', () => {
  it('dice quién tiene cada equipo y su área en lugar de la categoría', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19')?.textContent === 'Esteban Cardona Rendón · Control Interno', 'persona y área')

    expect(subtituloDe('metro-ana')?.textContent).toBe('Ana Gil · TI')
    expect(subtituloDe('metro-maria')?.textContent).toBe(
      'María Fernanda Restrepo Echeverri · Gestión Administrativa y Financiera',
    )
    // La categoría no se repite cuando alguien tiene el equipo.
    expect(subtituloDe('metrojp19')?.textContent).not.toContain('Computadores')
  })

  it('sin área dice solo el nombre, también con una persona guardada antes del área', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metro-luis')?.textContent === 'Luis Pérez de Prueba', 'persona sin área')

    expect(subtituloDe('metro-vieja')?.textContent).toBe('Nora Antigua de Prueba')
    expect(textoPantalla()).not.toMatch(/sin área/i)
  })

  it('un responsable escrito sin ficha se dice anotado, sin área; sin responsable, el contexto de siempre', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metro-libre')?.textContent === 'Computadores · Administración de prueba', 'el contexto')

    expect(subtituloDe('metro-archivo')?.textContent).toBe('Anotado: «Archivo» · por validar')
    // Una persona eliminada no se presenta como quien lo tiene.
    expect(subtituloDe('metro-eliminada')?.textContent).toBe('Computadores · Bodega de prueba')
  })

  it('la persona y el área son partes aparte, de hasta dos líneas cada una: ninguna se recorta a una', async () => {
    await montar(RUTAS, '/dispositivos')
    const linea = await esperar(() => subtituloDe('metro-maria'), 'la línea larga')

    // Así el área no se parte por la mitad ni desaparece en un teléfono:
    // si no cabe junto al nombre, baja entera a su línea.
    const partes = Array.from(linea.children) as HTMLElement[]
    expect(partes.map((p) => p.textContent)).toEqual([
      'María Fernanda Restrepo Echeverri ·',
      'Gestión Administrativa y Financiera',
    ])
    for (const parte of [linea, ...partes]) expect(parte.classList.contains('truncate')).toBe(false)
    for (const parte of partes) {
      expect(parte.classList.contains('line-clamp-2')).toBe(true)
      expect(parte.classList.contains('break-words')).toBe(true)
    }
    expect(linea.classList.contains('flex-wrap')).toBe(true)
    // Sin persona, la línea de siempre: un solo texto de hasta dos líneas.
    expect(subtituloDe('metro-libre')?.children).toHaveLength(0)
    expect(subtituloDe('metro-libre')?.classList.contains('line-clamp-2')).toBe(true)
  })

  it('el área se lee de la persona: si cambia, la lista lo dice sin reescribir el equipo', async () => {
    const antes = await db.dispositivos.get('metrojp19')
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19')?.textContent === 'Esteban Cardona Rendón · Control Interno', 'el área de antes')

    await db.personas.update('esteban', { area: 'Tesorería' })
    await esperar(() => subtituloDe('metrojp19')?.textContent === 'Esteban Cardona Rendón · Tesorería', 'el área nueva')

    const despues = await db.dispositivos.get('metrojp19')
    expect(despues).toEqual(antes)
    expect(Object.keys(despues ?? {})).not.toContain('area')
  })

  it('buscar un área encuentra los equipos de esa área; el de red sale aparte con su categoría', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19'), 'la lista')
    await escribir(campoEquipos()!, 'control interno')
    await esperar(() => !subtituloDe('metro-ana'), 'la lista filtrada')

    expect(subtituloDe('metrojp19')?.textContent).toBe('Esteban Cardona Rendón · Control Interno')
    // El equipo de red conserva su categoría en su bloque (no cambia).
    expect(textoPantalla()).toContain('Equipos de red')
    expect(subtituloDe('sw-piso')?.textContent).toBe('Switches')
    // La persona eliminada no aporta su área.
    expect(subtituloDe('metro-eliminada')).toBeNull()
  })

  it('la búsqueda por persona de la 314 sigue igual', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19'), 'la lista')
    await escribir(campoEquipos()!, 'cardona')
    await esperar(() => !subtituloDe('metro-ana'), 'la lista filtrada')

    expect(subtituloDe('metrojp19')).not.toBeNull()
  })
})
