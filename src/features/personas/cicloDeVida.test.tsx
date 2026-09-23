// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Persona } from '../../lib/db'
import {
  control,
  desmontarTodo,
  esperar,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { AsignarEquipoPage } from './AsignarEquipoPage'
import { asignarEquipo } from './operaciones'
import { PersonaPage } from './PersonaPage'
import { PersonasPage } from './PersonasPage'
import { RetirarPersonaPage } from './RetirarPersonaPage'

// EL CICLO DE VIDA DE UNA PERSONA, CON LAS PANTALLAS DE VERDAD (tarea 266,
// secciones 3 a 8 del encargo del 2026-09-23). La lógica pura y las
// escrituras ya se prueban aparte (`cicloPersona.test.ts`,
// `historialAsignaciones.test.ts`, `operaciones.test.ts`); aquí, lo que
// solo se ve montando:
//
//   - la ficha dice el estado, el equipo actual (con placa y lugar) y
//     ofrece "Configurar el computador" con la guía maestra existente;
//   - "Asignar equipo" ofrece primero los Disponibles y, al confirmar,
//     vuelve a la ficha con el equipo y el siguiente paso;
//   - "Retirar persona" decide por equipo, conserva la ficha, y la ficha
//     pasa a "Retirada" con el equipo en "Equipos anteriores";
//   - la lista separa activas y retiradas y deja a la vista lo que está
//     "por validar", sin resolverlo.
//
// Todo lo que se siembra es INVENTADO.

const AHORA = '2026-09-23T12:00:00.000Z'

function persona(id: string, nombre: string, datos: Partial<Persona> = {}): Persona {
  return {
    id,
    nombre,
    notas: '',
    estado: 'activa',
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  }
}

const RUTAS = [
  { ruta: '/personas', elemento: <PersonasPage /> },
  { ruta: '/personas/:personaId', elemento: <PersonaPage /> },
  { ruta: '/personas/:personaId/asignar', elemento: <AsignarEquipoPage /> },
  { ruta: '/personas/:personaId/retirar', elemento: <RetirarPersonaPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>GUÍA EN EJECUCIÓN</p> },
]

async function sembrar() {
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
  await db.personas.bulkPut([
    persona('ana', 'Ana de Prueba', { fechaIngreso: '2025-02-03' }),
    persona('luis', 'Luis de Prueba'),
  ])
  await sembrarEquipo({
    id: 'pc-ana',
    nombre: 'PC-PRUEBA-62',
    placaInventario: 'EJ-10561',
    ubicacion: 'Sistemas de prueba',
    responsable: 'Ana de Prueba',
    responsableId: 'ana',
    estado: 'Operativo',
  })
  await sembrarEquipo({ id: 'pc-libre', nombre: 'PC-PRUEBA-41', estado: 'Disponible' })
  await sembrarEquipo({ id: 'pc-sin', nombre: 'PC-PRUEBA-07', estado: '' })
  await sembrarEquipo({ id: 'pc-archivo', nombre: 'PC-PRUEBA-ARCHIVO', responsable: 'Archivo' })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('ficha de una persona', () => {
  it('dice su estado, su ingreso y su equipo actual con placa y lugar', async () => {
    await sembrar()
    await montar(RUTAS, '/personas/ana')
    await esperar(() => textoPantalla().includes('PC-PRUEBA-62'), 'el equipo actual')

    const texto = textoPantalla()
    expect(texto).toContain('Activa')
    expect(texto).toContain('Ingresó el 3 feb 2025')
    expect(texto).toContain('Equipo actual')
    expect(texto).toContain('Placa EJ-10561 · Sistemas de prueba')
    // Sin historial de asignaciones no hay "equipos anteriores" que decir.
    expect(texto).not.toContain('Equipos anteriores')
  })

  it('"Configurar el computador" abre la guía maestra existente, sin copiarla', async () => {
    await sembrar()
    await sembrarGuia({
      id: 'guia-usuario-nuevo',
      titulo: 'Configurar equipo para usuario nuevo',
      pasos: [pasoPrueba('p1', 'Crear el usuario', ['Abrir la consola de ejemplo'])],
    })
    await montar(RUTAS, '/personas/ana')
    const enlace = await esperar(() => control(/^Configurar el computador para Ana de Prueba/), 'la guía')

    expect(enlace.getAttribute('href')).toMatch(/\/guia-usuario-nuevo$/)
    // Los pasos viven en la guía: la ficha no los repite.
    expect(textoPantalla()).not.toContain('Abrir la consola de ejemplo')
  })

  it('"Eliminar" queda al final y aclara que es para un registro creado por error', async () => {
    await sembrar()
    await montar(RUTAS, '/personas/ana')
    const eliminar = await esperar(() => control('Eliminar (registro creado por error)'), 'eliminar')
    await tocar(eliminar)
    expect(textoPantalla()).toContain('usa "Retirar persona": conserva su ficha y su historial')
  })
})

describe('asignar un equipo', () => {
  it('ofrece primero los Disponibles y al confirmar vuelve a la ficha con el siguiente paso', async () => {
    await sembrar()
    await montar(RUTAS, '/personas/luis/asignar')
    await esperar(() => textoPantalla().includes('PC-PRUEBA-41'), 'la lista')

    const texto = textoPantalla()
    expect(texto.indexOf('Disponibles')).toBeLessThan(texto.indexOf('Sin responsable'))
    expect(texto.indexOf('Sin responsable')).toBeLessThan(texto.indexOf('Asignados a otra persona'))
    // El responsable escrito "por validar" se ve como anotación, no como persona.
    expect(texto).toContain('Anotado: Archivo')

    const opcion = await esperar(
      () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]')).find((b) => b.textContent?.includes('PC-PRUEBA-41')),
      'la opción del equipo disponible',
    )
    await tocar(opcion)
    await tocar(await esperar(() => control('Asignar equipo'), 'confirmar'))

    await esperar(() => ubicacionActual().pathname === '/personas/luis', 'la vuelta a la ficha')
    await esperar(() => textoPantalla().includes('quedó asignado'), 'la confirmación')
    const pc = await db.dispositivos.get('pc-libre')
    expect(pc).toMatchObject({ responsableId: 'luis', responsable: 'Luis de Prueba', estado: 'Operativo' })
  })
})

describe('retirar a una persona', () => {
  it('decide por equipo, conserva la ficha y la deja retirada con su equipo en "anteriores"', async () => {
    await sembrar()
    // Una asignación hecha con la app deja su comienzo en el historial.
    await asignarEquipo('pc-sin', 'ana')
    await montar(RUTAS, '/personas/ana/retirar')
    await esperar(() => textoPantalla().includes('Sus equipos (2)'), 'sus equipos')

    // Por defecto, sin responsable; Disponible solo marcado si funcionaba.
    // En orden de nombre: PC-PRUEBA-07 (sin estado) y PC-PRUEBA-62 (Operativo).
    const casillas = Array.from(document.body.querySelectorAll<HTMLElement>('[role="checkbox"]'))
    expect(casillas.map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    expect(textoPantalla()).toContain('Su estado no dice si funciona')

    await tocar(await esperar(() => control('Renuncia'), 'el motivo sugerido'))
    await tocar(await esperar(() => control('Confirmar retiro'), 'confirmar'))

    await esperar(() => ubicacionActual().pathname === '/personas/ana', 'la vuelta a la ficha')
    await esperar(() => textoPantalla().includes('Retirada'), 'el estado retirada')
    await esperar(() => textoPantalla().includes('Equipos anteriores'), 'los equipos anteriores')
    const texto = textoPantalla()
    expect(texto).toContain('Se retiró el')
    expect(texto).toContain('Renuncia')
    expect(texto).toContain('No tiene equipos a su nombre.')
    // El del inventario: solo consta cuándo se soltó. El asignado con la
    // app: su comienzo y su final.
    expect(texto).toMatch(/PC-PRUEBA-62\s*Hasta el/)
    expect(texto).toMatch(/PC-PRUEBA-07\s*\d+ \w+\.? \d{4} →/)

    expect(await db.personas.get('ana')).toMatchObject({ estado: 'retirada', motivoRetiro: 'Renuncia', eliminadoEn: null })
    expect(await db.dispositivos.get('pc-ana')).toMatchObject({ responsableId: null, responsable: '', estado: 'Disponible' })
    // Sin estado conocido y sin marcar "Disponible": conserva su estado.
    expect(await db.dispositivos.get('pc-sin')).toMatchObject({ responsableId: null, estado: '' })
  })

  it('una persona retirada se puede reactivar desde su ficha', async () => {
    await sembrar()
    await db.personas.put(persona('ana', 'Ana de Prueba', { estado: 'retirada', fechaRetiro: '2026-09-01' }))
    await montar(RUTAS, '/personas/ana')
    await tocar(await esperar(() => control('Reactivar'), 'reactivar'))
    await esperarQue(async () => (await db.personas.get('ana'))?.estado === 'activa', 'la reactivación')
    expect(await db.personas.get('ana')).toMatchObject({ fechaRetiro: null, motivoRetiro: '' })
  })
})

describe('la lista de personas', () => {
  it('separa activas y retiradas y cuenta solo los equipos de hoy', async () => {
    await sembrar()
    await db.personas.put(persona('rita', 'Rita de Prueba', { estado: 'retirada' }))
    await sembrarEquipo({ id: 'pc-baja', nombre: 'PC-PRUEBA-BAJA', responsableId: 'luis', estado: 'De baja' })
    await montar(RUTAS, '/personas')
    await esperar(() => textoPantalla().includes('Ana de Prueba'), 'la lista')

    const texto = textoPantalla()
    expect(texto).toContain('Activas · 2')
    expect(texto).toContain('Retiradas · 1')
    expect(texto).not.toContain('Rita de Prueba')
    // Luis solo tiene un equipo de baja: ya no cuenta como suyo.
    expect(texto).toMatch(/Luis de Prueba\s*Sin equipo/)

    await tocar(await esperar(() => control('Retiradas · 1'), 'el filtro de retiradas'))
    await esperar(() => textoPantalla().includes('Rita de Prueba'), 'la retirada')
  })

  it('deja a la vista lo que está por validar, sin convertirlo en persona', async () => {
    await sembrar()
    await montar(RUTAS, '/personas')
    const plegado = await esperar(() => control(/^Responsable por validar · 1/), 'por validar')
    await tocar(plegado)
    await esperar(() => textoPantalla().includes('PC-PRUEBA-ARCHIVO'), 'el equipo por validar')
    expect(textoPantalla()).toContain('Anotado: Archivo')
    expect(await db.personas.count()).toBe(2)
  })
})
