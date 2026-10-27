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
    ubicacion: 'Rack de prueba',
    responsable: 'Esteban Cardona Rendón',
    responsableId: 'esteban',
  })

  // Con ubicación (ampliación de la 317). Una ficha de Ubicación vinculada
  // manda sobre el texto heredado del equipo, que aquí quedó viejo.
  await db.ubicaciones.put({ id: 'u-caja', nombre: 'Caja Parque de Prueba', padreId: null, notas: '', updatedAt: AHORA, updatedBy: null, eliminadoEn: null })
  await db.personas.put(persona('sis', 'Esteban Cardona Rendón', { area: 'Sistemas' }))
  await sembrarEquipo({
    id: 'metro-ubicada',
    nombre: 'metro-ubicada',
    ...enUso,
    ubicacionId: 'u-caja',
    ubicacion: 'Texto viejo de prueba',
    responsable: 'Esteban Cardona Rendón',
    responsableId: 'esteban',
  })
  await sembrarEquipo({ id: 'metro-sistemas', nombre: 'metro-62', ...enUso, ubicacion: 'Sistemas', responsable: 'Esteban', responsableId: 'sis' })
  await sembrarEquipo({ id: 'metro-luis-lugar', nombre: 'metro-luis-lugar', ...enUso, ubicacion: 'Bodega de prueba', responsable: 'Luis', responsableId: 'luis' })
  await sembrarEquipo({ id: 'metro-archivo-lugar', nombre: 'metro-archivo-lugar', ...enUso, ubicacion: 'Bodega de prueba', responsable: 'Archivo' })
}

/** La línea bajo el equipo: el segundo párrafo de su fila (el primero es el título). */
function subtituloDe(id: string): HTMLElement | null {
  return document.body.querySelectorAll<HTMLElement>(`a[href="/dispositivos/${id}"] p`)[1] ?? null
}

/**
 * LA PERSONA PRIMERO (tarea 364, D4): con responsable vinculado, el título de
 * la fila es quien tiene el equipo, y el nombre del equipo va debajo.
 */
function tituloDe(id: string): string | null {
  return document.body.querySelector(`a[href="/dispositivos/${id}"] [data-nombre-principal]`)?.textContent ?? null
}

function equipoDe(id: string): string | null {
  return document.body.querySelector(`a[href="/dispositivos/${id}"] [data-equipo-de-persona]`)?.textContent ?? null
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

describe('la lista de Equipos con persona y área (tarea 317; la persona primero desde la 364)', () => {
  it('la persona es el título, el equipo va debajo y la línea dice su área en lugar de la categoría', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19')?.textContent === 'Control Interno', 'el área')

    expect(tituloDe('metrojp19')).toBe('Esteban Cardona Rendón')
    expect(equipoDe('metrojp19')).toBe('metrojp19')
    expect(tituloDe('metro-ana')).toBe('Ana Gil')
    expect(subtituloDe('metro-ana')?.textContent).toBe('TI')
    expect(tituloDe('metro-maria')).toBe('María Fernanda Restrepo Echeverri')
    expect(subtituloDe('metro-maria')?.textContent).toBe('Gestión Administrativa y Financiera')
    // La categoría no se repite cuando alguien tiene el equipo.
    expect(subtituloDe('metrojp19')?.textContent).not.toContain('Computadores')
  })

  it('sin área no hay línea de contexto, también con una persona guardada antes del área', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => tituloDe('metro-luis') === 'Luis Pérez de Prueba', 'persona sin área')

    expect(subtituloDe('metro-luis')).toBeNull()
    expect(tituloDe('metro-vieja')).toBe('Nora Antigua de Prueba')
    expect(subtituloDe('metro-vieja')).toBeNull()
    expect(textoPantalla()).not.toMatch(/sin área/i)
  })

  it('un responsable escrito sin ficha se dice anotado, sin área; sin responsable, el contexto de siempre', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metro-libre')?.textContent === 'Computadores · Administración de prueba', 'el contexto')

    // Lo anotado nunca se presenta como una persona: el equipo sigue de título.
    expect(tituloDe('metro-archivo')).toBe('metro-archivo')
    expect(subtituloDe('metro-archivo')?.textContent).toBe('Anotado: «Archivo» · por validar')
    // Una persona eliminada no se presenta como quien lo tiene.
    expect(tituloDe('metro-eliminada')).toBe('metro-eliminada')
    expect(subtituloDe('metro-eliminada')?.textContent).toBe('Computadores · Bodega de prueba')
  })

  it('el área y el sitio son partes aparte, de hasta dos líneas cada una: ninguna se recorta a una', async () => {
    await montar(RUTAS, '/dispositivos')
    const linea = await esperar(() => subtituloDe('metro-ubicada'), 'la línea con dos partes')

    // Así el sitio no se parte por la mitad ni desaparece en un teléfono: si
    // no cabe junto al área, baja entero a su línea.
    const partes = Array.from(linea.children) as HTMLElement[]
    expect(partes.map((p) => p.textContent)).toEqual(['Control Interno ·', 'Caja Parque de Prueba'])
    for (const parte of [linea, ...partes]) expect(parte.classList.contains('truncate')).toBe(false)
    for (const parte of partes) {
      expect(parte.classList.contains('line-clamp-2')).toBe(true)
      expect(parte.classList.contains('break-words')).toBe(true)
    }
    // Las partes fluyen en su línea: en la tarjeta del teléfono (tarea 350)
    // el párrafo es la fila que se parte, con todo el ancho de la tarjeta.
    expect(linea.classList.contains('flex-wrap')).toBe(true)
    // Sin persona, la línea de siempre: un solo texto de hasta dos líneas.
    expect(subtituloDe('metro-libre')?.children).toHaveLength(0)
    expect(subtituloDe('metro-libre')?.classList.contains('line-clamp-2')).toBe(true)
  })

  it('el estado y la IP no le quitan ancho a la persona: cada cosa en su línea', async () => {
    await sembrarEquipo({
      id: 'metro-mant',
      nombre: 'metro-mant',
      categoriaId: 'cat-equipos',
      estado: 'En mantenimiento',
      ip: '10.31.7.29',
      responsable: 'María Fernanda Restrepo Echeverri',
      responsableId: 'maria',
    })
    await montar(RUTAS, '/dispositivos')
    const linea = await esperar(() => subtituloDe('metro-mant'), 'la fila en mantenimiento')
    const fila = document.body.querySelector<HTMLElement>('a[href="/dispositivos/metro-mant"]')!
    const nombre = fila.querySelector('p')!
    const equipo = fila.querySelector<HTMLElement>('[data-equipo-de-persona]')!
    const estado = Array.from(fila.querySelectorAll('span')).find((s) => s.textContent === 'En mantenimiento')!
    const ip = Array.from(fila.querySelectorAll('span')).find((s) => s.textContent === '10.31.7.29')!

    // EN LA TARJETA DEL TELÉFONO (tareas 350 y 364): la persona, debajo el
    // equipo con su IP en la misma línea (la IP baja si no cabe), el área y la
    // pastilla del estado al final. Ninguna le quita ancho a otra.
    expect(nombre.textContent).toBe('María Fernanda Restrepo Echeverri')
    expect(nombre.nextElementSibling).toBe(equipo.parentElement)
    expect(equipo.parentElement?.contains(ip)).toBe(true)
    expect(equipo.parentElement?.nextElementSibling).toBe(linea)
    expect(linea.nextElementSibling).toBe(estado)
    expect(linea.contains(ip)).toBe(false)
    expect(linea.contains(estado)).toBe(false)
    expect(linea.textContent).toBe('Gestión Administrativa y Financiera')
  })

  it('el área se lee de la persona: si cambia, la lista lo dice sin reescribir el equipo', async () => {
    const antes = await db.dispositivos.get('metrojp19')
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19')?.textContent === 'Control Interno', 'el área de antes')

    await db.personas.update('esteban', { area: 'Tesorería' })
    await esperar(() => subtituloDe('metrojp19')?.textContent === 'Tesorería', 'el área nueva')

    const despues = await db.dispositivos.get('metrojp19')
    expect(despues).toEqual(antes)
    expect(Object.keys(despues ?? {})).not.toContain('area')
  })

  it('buscar un área encuentra los equipos de esa área, juntos bajo su persona; el de red sale aparte con su categoría', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19'), 'la lista')
    await escribir(campoEquipos()!, 'control interno')
    await esperar(() => document.body.querySelector('[data-grupo-persona="esteban"]'), 'la persona con sus dos equipos')

    // Esteban tiene dos equipos de Control Interno: una tarjeta, su área una vez.
    const grupo = document.body.querySelector<HTMLElement>('[data-grupo-persona="esteban"]')!
    expect(grupo.textContent).toContain('Esteban Cardona Rendón')
    expect(grupo.textContent).toContain('Control Interno')
    expect(grupo.textContent).toContain('2 equipos')
    expect(grupo.querySelector('a[href="/dispositivos/metrojp19"]')).not.toBeNull()
    expect(grupo.querySelector('a[href="/dispositivos/metro-ubicada"]')).not.toBeNull()
    expect(grupo.querySelector('a[href="/personas/esteban"]')).not.toBeNull()
    expect(document.body.querySelector('a[href="/dispositivos/metro-ana"]')).toBeNull()
    // El equipo de red conserva su categoría y su lugar en su bloque, aunque
    // alguien lo tenga: ahí no cambia nada.
    expect(textoPantalla()).toContain('Equipos de red')
    expect(tituloDe('sw-piso')).toBe('SW-PISO-4')
    expect(subtituloDe('sw-piso')?.textContent).toBe('Switches · Rack de prueba')
    expect(subtituloDe('sw-piso')?.children).toHaveLength(0)
    // La persona eliminada no aporta su área.
    expect(document.body.querySelector('a[href="/dispositivos/metro-eliminada"]')).toBeNull()
  })

  it('la búsqueda por persona de la 314 sigue igual', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19'), 'la lista')
    await escribir(campoEquipos()!, 'cardona')
    await esperar(() => !document.body.querySelector('a[href="/dispositivos/metro-ana"]'), 'la lista filtrada')

    expect(document.body.querySelector('a[href="/dispositivos/metrojp19"]')).not.toBeNull()
  })
})

describe('la lista de Equipos dice también dónde está el equipo (ampliación de la 317)', () => {
  it('el área y la ubicación, con la ficha de Ubicación vinculada como fuente de verdad', async () => {
    await montar(RUTAS, '/dispositivos')
    const linea = await esperar(() => subtituloDe('metro-ubicada'), 'la fila con ubicación')

    expect(tituloDe('metro-ubicada')).toBe('Esteban Cardona Rendón')
    expect(linea.textContent).toBe('Control Interno · Caja Parque de Prueba')
    expect(linea.textContent).not.toContain('Texto viejo de prueba')
  })

  it('si el área y la ubicación son la misma, se dice una vez', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metro-sistemas'), 'la fila de Sistemas')

    expect(subtituloDe('metro-sistemas')?.textContent).toBe('Sistemas')
  })

  it('una persona sin área dice la ubicación; sin ubicación, el área como antes', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metro-luis-lugar'), 'la fila sin área')

    expect(tituloDe('metro-luis-lugar')).toBe('Luis Pérez de Prueba')
    expect(subtituloDe('metro-luis-lugar')?.textContent).toBe('Bodega de prueba')
    expect(subtituloDe('metrojp19')?.textContent).toBe('Control Interno')
    expect(subtituloDe('metro-luis')).toBeNull()
  })

  it('un responsable por validar conserva su aviso y suma la ubicación, en partes', async () => {
    await montar(RUTAS, '/dispositivos')
    const linea = await esperar(() => subtituloDe('metro-archivo-lugar'), 'la fila anotada')

    expect(linea.textContent).toBe('Anotado: «Archivo» · por validar · Bodega de prueba')
    expect(Array.from(linea.children).map((p) => p.textContent)).toEqual([
      'Anotado: «Archivo» · por validar ·',
      'Bodega de prueba',
    ])
  })

  it('sin responsable conserva categoría y ubicación en un solo texto, como antes', async () => {
    await montar(RUTAS, '/dispositivos')
    const linea = await esperar(() => subtituloDe('metro-libre'), 'la fila libre')

    expect(linea.textContent).toBe('Computadores · Administración de prueba')
    expect(linea.children).toHaveLength(0)
  })
})

describe('la lista va por lo que se lee primero (tarea 364)', () => {
  it('sin buscar, los equipos de una misma persona quedan seguidos, por el nombre de la persona', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metrojp19'), 'la lista')
    const titulos = Array.from(document.body.querySelectorAll('[data-nombre-principal]')).map((t) => t.textContent)
    const deEsteban = titulos.flatMap((t, i) => (t === 'Esteban Cardona Rendón' ? [i] : []))
    // metrojp19 y metro-ubicada (Esteban) y metro-62 (otra ficha con el mismo
    // nombre): seguidos.
    expect(deEsteban.length).toBeGreaterThanOrEqual(2)
    expect(deEsteban.at(-1)! - deEsteban[0]).toBe(deEsteban.length - 1)
    // Ana va antes que Esteban, y los equipos sin nadie se leen por su nombre.
    expect(titulos.indexOf('Ana Gil')).toBeLessThan(deEsteban[0])
  })
})
