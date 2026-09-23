// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Ubicacion } from '../../lib/db'
import {
  control,
  desmontarTodo,
  esperar,
  esperarQue,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { MigracionUbicaciones } from './MigracionUbicaciones'
import { UbicacionesPage } from './UbicacionesPage'
import { UbicacionPage } from './UbicacionPage'

// UBICACIONES VINCULADAS, CON LAS PANTALLAS DE VERDAD (tarea 267,
// secciones 10 a 12 del encargo del 2026-09-23). La lógica pura se
// prueba aparte (`migracion.test.ts`, `contenido.test.ts`); aquí, lo que
// solo se ve montando:
//
//   - la migración une sola lo que difiere en mayúsculas, SEÑALA lo que
//     solo se parece y no lo migra hasta que el técnico decide;
//   - reutiliza la ubicación que ya existe en vez de duplicarla;
//   - la ficha de un lugar responde "¿qué hay aquí?" por categoría.
//
// Todo lo que se siembra es INVENTADO.

const AHORA = '2026-09-23T12:00:00.000Z'

function ubicacion(id: string, nombre: string, padreId: string | null = null): Ubicacion {
  return { id, nombre, padreId, notas: '', updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}

const RUTAS = [
  { ruta: '/ubicaciones', elemento: <UbicacionesPage /> },
  { ruta: '/ubicaciones/migrar', elemento: <MigracionUbicaciones /> },
  { ruta: '/ubicaciones/:ubicacionId', elemento: <UbicacionPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
]

async function sembrar() {
  await db.categorias.bulkPut([
    { id: 'cat-equipos', nombre: 'Computadores', icono: '', orden: 1, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
    { id: 'cat-imp', nombre: 'Impresoras', icono: '', orden: 2, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null },
  ])
  await db.ubicaciones.put(ubicacion('u-sistemas', 'Sistemas de prueba'))
  await sembrarEquipo({ id: 'pc-1', nombre: 'PC-PRUEBA-1', ubicacion: 'Logistica de prueba' })
  await sembrarEquipo({ id: 'pc-2', nombre: 'PC-PRUEBA-2', ubicacion: 'LOGISTICA DE PRUEBA' })
  await sembrarEquipo({ id: 'pc-3', nombre: 'PC-PRUEBA-3', ubicacion: 'Administración Parque de Prueba' })
  await sembrarEquipo({ id: 'pc-4', nombre: 'PC-PRUEBA-4', ubicacion: 'ADMINISTRACION PP' })
  await sembrarEquipo({ id: 'pc-5', nombre: 'PC-PRUEBA-5', ubicacion: 'SISTEMAS DE PRUEBA' })
  await sembrarEquipo({ id: 'imp-1', nombre: 'IMP-PRUEBA-1', categoriaId: 'cat-imp', ubicacion: 'Sistemas de prueba' })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('migración asistida de ubicaciones', () => {
  it('une las variantes de mayúsculas, señala la abreviatura y reutiliza la ubicación existente', async () => {
    await sembrar()
    await montar(RUTAS, '/ubicaciones/migrar')
    await esperar(() => textoPantalla().includes('ADMINISTRACION PP'), 'la lista de textos')

    const texto = textoPantalla()
    expect(texto).toContain('incluye «Logistica de prueba» y «LOGISTICA DE PRUEBA»')
    expect(texto).toContain('Posible coincidencia · por validar.')
    expect(texto).toContain('¿Es el mismo lugar que «Administración Parque de Prueba»?')
    expect(texto).toContain('Se vincula a la ubicación que ya existe: Sistemas de prueba')
    // La abreviatura NO entra hasta que se decida: 3 textos, 5 equipos.
    expect(texto).toContain('Se crearán 2 ubicaciones, se usará 1 que ya existe y se vincularán 5 equipos.')
    expect(texto).toContain('1 texto espera que decidas su posible coincidencia.')
  })

  it('"Es el mismo lugar" une el texto; aplicar no duplica la ubicación existente', async () => {
    await sembrar()
    await montar(RUTAS, '/ubicaciones/migrar')
    await tocar(await esperar(() => control('Es el mismo lugar'), 'la coincidencia'))
    await esperar(
      () => textoPantalla().includes('se vincularán 6 equipos'),
      'el texto se suma a la ubicación elegida',
    )
    await tocar(await esperar(() => control('Crear ubicaciones y vincular equipos'), 'aplicar'))

    await esperarQue(async () => (await db.dispositivos.filter((d) => !d.ubicacionId).count()) === 0, 'todo vinculado')
    const ubicaciones = (await db.ubicaciones.toArray()).map((u) => u.nombre).sort()
    expect(ubicaciones).toEqual(['Administración Parque de Prueba', 'Logistica de prueba', 'Sistemas de prueba'])
    expect((await db.dispositivos.get('pc-4'))?.ubicacion).toBe('Administración Parque de Prueba')
    expect((await db.dispositivos.get('pc-5'))?.ubicacionId).toBe('u-sistemas')
    // El texto anterior queda en el historial del equipo.
    const historial = await db.historial.where('[entidadTipo+entidadId]').equals(['dispositivo', 'pc-4']).toArray()
    expect(historial.some((h) => h.campo === 'ubicacion' && h.valorAnterior === 'ADMINISTRACION PP')).toBe(true)
  })

  it('"Son distintos" deja cada texto como su propio lugar', async () => {
    await sembrar()
    await montar(RUTAS, '/ubicaciones/migrar')
    await tocar(await esperar(() => control('Son distintos'), 'la coincidencia'))
    await esperar(() => textoPantalla().includes('se vincularán 6 equipos'), 'el texto entra por separado')
    expect(textoPantalla()).toContain('Se crearán 3 ubicaciones')
  })
})

describe('la ficha de una ubicación', () => {
  it('responde "¿qué hay aquí?" por categoría y cada equipo abre su ficha', async () => {
    await sembrar()
    await db.dispositivos.bulkPut(
      (await db.dispositivos.toArray()).map((d) => ({ ...d, ubicacionId: 'u-sistemas', ubicacion: 'Sistemas de prueba' })),
    )
    await montar(RUTAS, '/ubicaciones/u-sistemas')
    await esperar(() => textoPantalla().includes('Qué hay aquí'), 'la ficha')
    await esperar(() => textoPantalla().includes('IMP-PRUEBA-1'), 'los equipos')

    const texto = textoPantalla()
    expect(texto).toContain('6 equipos')
    expect(texto.indexOf('Computadores')).toBeLessThan(texto.indexOf('Impresoras'))
    expect(control(/^IMP-PRUEBA-1/)?.getAttribute('href')).toBe('/dispositivos/imp-1')
  })

  it('una sede cuyos equipos están en sus áreas no dice "sin equipos"', async () => {
    await sembrar()
    await db.ubicaciones.bulkPut([ubicacion('u-sede', 'Sede de prueba'), ubicacion('u-area', 'Área de prueba', 'u-sede')])
    await db.dispositivos.update('pc-1', { ubicacionId: 'u-area' })
    await montar(RUTAS, '/ubicaciones/u-sede')
    await esperar(() => textoPantalla().includes('Contiene'), 'la ficha')

    const texto = textoPantalla()
    expect(texto).toContain('1 equipo (0 aquí, el resto en sus sub-ubicaciones)')
    expect(texto).toContain('Sus equipos están en las sub-ubicaciones de arriba.')
  })

  it('la lista cuenta equipos (no textos) en el aviso de migración', async () => {
    await sembrar()
    await montar(RUTAS, '/ubicaciones')
    await esperar(() => textoPantalla().includes('escrita como texto'), 'el aviso')
    // 6 equipos con texto, en 4 lugares distintos (las dos Logística son uno).
    expect(textoPantalla()).toContain('6 equipos tienen la ubicación escrita como texto (4 lugares distintos)')
  })
})
