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

/** La línea bajo el nombre de un equipo: el segundo párrafo de su fila. */
function subtituloDe(id: string): HTMLElement | null {
  return document.body.querySelectorAll<HTMLElement>(`a[href="/dispositivos/${id}"] p`)[1] ?? null
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
    // El párrafo no dibuja caja: sus partes fluyen en la franja de abajo.
    expect(linea.classList.contains('contents')).toBe(true)
    expect(linea.parentElement?.classList.contains('flex-wrap')).toBe(true)
    // Sin persona, la línea de siempre: un solo texto de hasta dos líneas.
    expect(subtituloDe('metro-libre')?.children).toHaveLength(0)
    expect(subtituloDe('metro-libre')?.classList.contains('line-clamp-2')).toBe(true)
  })

  it('el estado y la IP no le quitan ancho a la persona: el estado va arriba y la IP al final de su línea', async () => {
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
    const estado = Array.from(fila.querySelectorAll('span')).find((s) => s.textContent === 'En mantenimiento')!
    const ip = Array.from(fila.querySelectorAll('span')).find((s) => s.textContent === '10.31.7.29')!

    // Arriba: el nombre y el estado, en la misma franja.
    expect(estado.parentElement).toBe(nombre.parentElement)
    // Abajo: la persona, el área y la IP, en una franja de todo el ancho.
    const abajo = linea.parentElement!
    expect(abajo.classList.contains('col-span-2')).toBe(true)
    expect(abajo.contains(ip)).toBe(true)
    expect(abajo.contains(estado)).toBe(false)
    // La IP va después del texto, empujada a la derecha.
    expect(abajo.lastElementChild).toBe(ip)
    expect(ip.classList.contains('ml-auto')).toBe(true)
    expect(linea.textContent).toBe('María Fernanda Restrepo Echeverri · Gestión Administrativa y Financiera')
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
    // El equipo de red conserva su categoría y su lugar en su bloque, aunque
    // alguien lo tenga: ahí no cambia nada.
    expect(textoPantalla()).toContain('Equipos de red')
    expect(subtituloDe('sw-piso')?.textContent).toBe('Switches · Rack de prueba')
    expect(subtituloDe('sw-piso')?.children).toHaveLength(0)
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

describe('la lista de Equipos dice también dónde está el equipo (ampliación de la 317)', () => {
  it('persona, área y ubicación, con la ficha de Ubicación vinculada como fuente de verdad', async () => {
    await montar(RUTAS, '/dispositivos')
    const linea = await esperar(() => subtituloDe('metro-ubicada'), 'la fila con ubicación')

    expect(linea.textContent).toBe('Esteban Cardona Rendón · Control Interno · Caja Parque de Prueba')
    expect(linea.textContent).not.toContain('Texto viejo de prueba')
    // Tres partes: cada una entera en su línea si cabe, en el teléfono.
    expect(Array.from(linea.children).map((p) => p.textContent)).toEqual([
      'Esteban Cardona Rendón ·',
      'Control Interno ·',
      'Caja Parque de Prueba',
    ])
  })

  it('si el área y la ubicación son la misma, se dice una vez', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metro-sistemas'), 'la fila de Sistemas')

    expect(subtituloDe('metro-sistemas')?.textContent).toBe('Esteban Cardona Rendón · Sistemas')
  })

  it('una persona sin área dice su nombre y la ubicación; sin ubicación, nombre y área como antes', async () => {
    await montar(RUTAS, '/dispositivos')
    await esperar(() => subtituloDe('metro-luis-lugar'), 'la fila sin área')

    expect(subtituloDe('metro-luis-lugar')?.textContent).toBe('Luis Pérez de Prueba · Bodega de prueba')
    expect(subtituloDe('metrojp19')?.textContent).toBe('Esteban Cardona Rendón · Control Interno')
    expect(subtituloDe('metro-luis')?.textContent).toBe('Luis Pérez de Prueba')
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
