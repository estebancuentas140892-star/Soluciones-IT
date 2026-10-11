// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type AutorizacionFacturacion } from '../../lib/db'
import { conOrigen, leerOrigen } from '../../lib/origenNavegacion'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarQue,
  limpiarBase,
  montar,
  navegarA,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { DispositivoPage } from '../dispositivos/DispositivoPage'
import { AgendaPage } from '../inicio/AgendaPage'
import { AutorizacionForm } from './AutorizacionForm'
import { AutorizacionPage } from './AutorizacionPage'
import { AutorizacionesPage } from './AutorizacionesPage'

// AUTORIZACIONES DE FACTURACIÓN, DE PUNTA A PUNTA (tarea 321, encargo del
// 2026-10-10, fase C). Lo que solo se ve montando las pantallas:
//
//   - en la ficha de un POS, "Más del equipo" > "Facturación" dice qué
//     autorización tiene, su prefijo, su rango, su estado, el
//     vencimiento si está confirmado y si pide revisión, y registra una
//     nueva con ese POS ya marcado;
//   - el formulario separa lo documentado, la confirmación y el dato
//     medido, y no deja confirmar sin verificación ni guardar un
//     consecutivo fuera del rango;
//   - la lista enseña la que no tiene POS ("Sin POS asociado");
//   - la Agenda avisa del vencimiento confirmado y nunca del documental.
//
// Todo lo que se siembra es INVENTADO. La base es la local (IndexedDB):
// sin red, todo queda en la cola para subir.

const RUTAS = [
  { ruta: '/agenda', elemento: <AgendaPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> },
  { ruta: '/facturacion', elemento: <AutorizacionesPage /> },
  { ruta: '/facturacion/nueva', elemento: <AutorizacionForm /> },
  { ruta: '/facturacion/:autorizacionId', elemento: <AutorizacionPage /> },
  { ruta: '/facturacion/:autorizacionId/editar', elemento: <AutorizacionForm /> },
]

const AHORA = '2026-10-10T12:00:00.000Z'

/** "YYYY-MM-DD" a N días de hoy (la agenda mira el día real del aparato). */
function fechaRelativa(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

async function sembrarBase(): Promise<void> {
  await sembrarPerfil(false)
  for (const [id, nombre] of [
    ['cat-pos', 'POS'],
    ['cat-equipos', 'Computadores'],
  ]) {
    await db.categorias.put({ id, nombre, icono: '', orden: 1, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null })
  }
  await sembrarEquipo({ id: 'pos-a', nombre: 'POS de prueba A', categoriaId: 'cat-pos', estado: 'Operativo' })
  await sembrarEquipo({ id: 'pos-b', nombre: 'POS de prueba B', categoriaId: 'cat-pos', estado: 'Operativo' })
  await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba', categoriaId: 'cat-equipos', estado: 'Operativo' })
}

async function sembrarAutorizacion(datos: Partial<AutorizacionFacturacion> & { id: string }): Promise<void> {
  await db.autorizaciones_facturacion.put({
    dispositivoIds: ['pos-a'],
    prefijo: 'PRB',
    formulario: '',
    rangoDesde: 3000,
    rangoHasta: 8000,
    fechaFormalizacion: null,
    vigenciaReportada: '',
    vencimientoDocumentado: null,
    vencimientoConfirmado: null,
    consecutivoActual: null,
    consecutivoLeidoEn: null,
    consecutivoFuente: '',
    estado: 'documentada',
    fuente: 'Documento de prueba',
    verificadoEn: null,
    verificacionFuente: '',
    observaciones: '',
    evidenciaAdjuntoId: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  })
}

/** El campo cuyo rótulo empieza por `etiqueta`. */
function campoDe(etiqueta: string): HTMLInputElement {
  const rotulo = Array.from(document.body.querySelectorAll('label')).find((l) =>
    (l.textContent ?? '').trim().startsWith(etiqueta),
  )
  const campo = rotulo?.querySelector<HTMLInputElement>('input')
  if (!campo) throw new Error(`No está el campo "${etiqueta}".`)
  return campo
}

function opcion(inicio: string): HTMLElement {
  const encontrada = Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]')).find((el) =>
    (el.textContent ?? '').trim().startsWith(inicio),
  )
  if (!encontrada) throw new Error(`No está la opción "${inicio}".`)
  return encontrada
}

async function llenarLoDocumentado(): Promise<void> {
  await escribir(campoDe('Prefijo'), 'PRB')
  await escribir(campoDe('Rango desde'), '3000')
  await escribir(campoDe('Rango hasta'), '8.000')
  await escribir(campoDe('Fuente'), 'Documento de prueba')
}

beforeEach(async () => {
  await limpiarBase()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('desde la ficha del POS', () => {
  it('"Facturación" dice "Ninguna" y registra una autorización documentada con ese POS ya marcado', async () => {
    await sembrarBase()
    await montar(RUTAS, '/dispositivos/pos-a')
    await tocar(await esperar(() => control(/^Más del equipo/), 'Más del equipo'))
    const seccion = await esperar(() => control(/^Facturación/), 'la fila Facturación')
    expect(seccion.textContent).toContain('Ninguna')
    await tocar(seccion)
    await tocar(await esperar(() => control('Registrar autorización'), 'Registrar autorización'))

    await esperar(() => textoPantalla().includes('Lo que dice el documento'), 'el formulario')
    // Tres grupos que no se mezclan.
    for (const grupo of ['Lo que dice el documento', 'Confirmación', 'Dato actual: el consecutivo']) {
      expect(textoPantalla()).toContain(grupo)
    }
    expect(textoPantalla()).toContain('Las claves de ICG o HKA van en la Bóveda.')
    const casilla = Array.from(document.body.querySelectorAll('[role="checkbox"]')).find((c) =>
      (c.textContent ?? '').includes('POS de prueba A'),
    )
    expect(casilla?.getAttribute('aria-checked')).toBe('true')
    // Un equipo que no es POS no se ofrece.
    expect(textoPantalla()).not.toContain('PC de prueba')

    await llenarLoDocumentado()
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperarQue(async () => (await db.autorizaciones_facturacion.count()) === 1, 'se guarda')

    const [guardada] = await db.autorizaciones_facturacion.toArray()
    expect(guardada).toMatchObject({
      dispositivoIds: ['pos-a'],
      prefijo: 'PRB',
      rangoDesde: 3000,
      rangoHasta: 8000,
      estado: 'documentada',
      vencimientoConfirmado: null,
      consecutivoActual: null,
    })
    await esperar(() => ubicacionActual()?.pathname === `/facturacion/${guardada.id}`, 'su ficha')
    await esperar(() => textoPantalla().includes('Lo documentado'), 'la ficha pintada')
    expect(textoPantalla()).toContain('Documentada, por validar')
    expect(textoPantalla()).toContain('Sin verificar con una fuente actual.')
    expect(textoPantalla()).toContain('Sin lectura. No se estima por fechas ni por consumo.')
    const cola = await db.cambiosPendientes.toArray()
    expect(cola.map((c) => c.tabla).sort()).toEqual(['autorizaciones_facturacion', 'historial'])
  })

  it('un equipo que no es POS y no tiene autorizaciones no enseña "Facturación"', async () => {
    await sembrarBase()
    await montar(RUTAS, '/dispositivos/pc')
    await tocar(await esperar(() => control(/^Más del equipo/), 'Más del equipo'))
    await esperar(() => control(/^Mantenimiento/), 'la sección de mantenimiento')
    expect(control(/^Facturación/)).toBeNull()
  })

  it('la fila dice prefijo, rango, estado, el vencimiento confirmado y si pide revisión', async () => {
    await sembrarBase()
    await sembrarAutorizacion({
      id: 'conf',
      prefijo: 'CNF',
      estado: 'confirmada',
      verificadoEn: '2026-10-09',
      verificacionFuente: 'Consulta de prueba',
      vencimientoConfirmado: '2028-05-14',
    })
    await sembrarAutorizacion({ id: 'doc', prefijo: 'DOC', rangoDesde: 4100, rangoHasta: 90000 })
    await montar(RUTAS, '/dispositivos/pos-a')
    await tocar(await esperar(() => control(/^Más del equipo/), 'Más del equipo'))
    const seccion = await esperar(() => control(/^Facturación/), 'la fila Facturación')
    expect(seccion.textContent).toContain('2 en uso')
    await tocar(seccion)
    await esperar(() => textoPantalla().includes('Rango 4.100 a 90.000'), 'las filas')
    expect(textoPantalla()).toContain('Rango 3.000 a 8.000')
    expect(textoPantalla()).toContain('Confirmada')
    expect(textoPantalla()).toContain('Vence el 14 may 2028')
    expect(textoPantalla()).toContain('Documentada, por validar')
    expect(textoPantalla()).toContain('Por validar: falta comprobarla con una fuente actual')
  })
})

describe('el formulario', () => {
  it('confirmar sin decir cuándo ni con qué fuente actual no se guarda; con ello, sí', async () => {
    await sembrarBase()
    await montar(RUTAS, '/facturacion/nueva?equipo=pos-a')
    await esperar(() => textoPantalla().includes('Lo que dice el documento'), 'el formulario')
    await llenarLoDocumentado()
    await tocar(opcion('Confirmada'))
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperar(() => textoPantalla().includes('Para confirmarla, di cuándo y con qué fuente actual se comprobó.'), 'el aviso')
    expect(await db.autorizaciones_facturacion.count()).toBe(0)

    await escribir(campoDe('Verificada el'), fechaRelativa(-1))
    await escribir(campoDe('Con qué fuente actual'), 'Consulta de prueba')
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperarQue(async () => (await db.autorizaciones_facturacion.count()) === 1, 'se guarda')
    const [guardada] = await db.autorizaciones_facturacion.toArray()
    expect(guardada).toMatchObject({ estado: 'confirmada', verificacionFuente: 'Consulta de prueba' })
  })

  it('un consecutivo fuera del rango no se guarda y dice cuál es el rango', async () => {
    await sembrarBase()
    await montar(RUTAS, '/facturacion/nueva?equipo=pos-a')
    await esperar(() => textoPantalla().includes('Lo que dice el documento'), 'el formulario')
    await llenarLoDocumentado()
    await escribir(campoDe('Último consecutivo emitido'), '25000')
    await escribir(campoDe('Leído el'), fechaRelativa(-1))
    await escribir(campoDe('Dónde se leyó'), 'Lectura de prueba')
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperar(
      () => textoPantalla().includes('El consecutivo tiene que estar dentro del rango (3.000 a 8.000).'),
      'el aviso',
    )
    expect(await db.autorizaciones_facturacion.count()).toBe(0)
  })

  it('pasar de registrar a editar otra sin desmontar abre la que se pidió, no lo que se escribía', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'ed' })
    await montar(RUTAS, '/facturacion/nueva?equipo=pos-a')
    await esperar(() => textoPantalla().includes('Lo que dice el documento'), 'el formulario')
    await escribir(campoDe('Prefijo'), 'OTRO')
    await navegarA('/facturacion/ed/editar')
    await esperar(() => campoDe('Prefijo').value === 'PRB', 'la autorización pedida')
    await escribir(campoDe('Vigencia reportada'), '24 meses')
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperarQue(async () => (await db.autorizaciones_facturacion.get('ed'))?.vigenciaReportada === '24 meses', 'se edita')
    expect(await db.autorizaciones_facturacion.count()).toBe(1)
  })

  it('desde la ficha, Editar y guardar vuelve a la ficha, que sigue sabiendo de dónde se vino', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'ed' })
    await montar(RUTAS, { pathname: '/facturacion/ed', state: conOrigen('/dispositivos/pos-a', 'POS de prueba A') })
    await tocar(await esperar(() => control('Editar'), 'Editar'))
    await esperar(() => ubicacionActual().pathname === '/facturacion/ed/editar', 'el formulario')
    await esperar(() => campoDe('Prefijo').value === 'PRB', 'lo guardado')
    await escribir(campoDe('Vigencia reportada'), '24 meses')
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperar(() => ubicacionActual().pathname === '/facturacion/ed', 'de vuelta en la ficha')
    expect(leerOrigen(ubicacionActual().state)?.to).toBe('/dispositivos/pos-a')
    expect((await db.autorizaciones_facturacion.get('ed'))?.vigenciaReportada).toBe('24 meses')
  })

  it('editar conserva lo guardado y deja el cambio en el historial del POS', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'ed' })
    await montar(RUTAS, '/facturacion/ed/editar')
    await esperar(() => campoDe('Prefijo').value === 'PRB', 'lo guardado en el formulario')
    expect(campoDe('Rango hasta').value).toBe('8000')
    await escribir(campoDe('Último consecutivo emitido'), '3.500')
    await escribir(campoDe('Leído el'), fechaRelativa(-1))
    await escribir(campoDe('Dónde se leyó'), 'Lectura de prueba')
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperarQue(async () => (await db.autorizaciones_facturacion.get('ed'))?.consecutivoActual === 3500, 'se guarda')
    await esperar(() => textoPantalla().includes('Quedan 4.500 números según esa lectura.'), 'la ficha con la lectura')
    const entrada = (await db.historial.toArray()).find((e) => e.campo === 'autorizacion_facturacion')
    expect(entrada).toMatchObject({ entidadId: 'pos-a' })
  })
})

describe('la lista y la ficha', () => {
  it('la que no tiene POS sale como "Sin POS asociado", entre las que piden revisión', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'sin-pos', prefijo: 'SINPOS', dispositivoIds: [], rangoDesde: null, rangoHasta: null })
    await sembrarAutorizacion({
      id: 'conf',
      prefijo: 'CNF',
      estado: 'confirmada',
      verificadoEn: '2026-10-09',
      verificacionFuente: 'Consulta de prueba',
    })
    await montar(RUTAS, '/facturacion')
    await esperar(() => textoPantalla().includes('SINPOS'), 'la lista')
    expect(textoPantalla()).toContain('Piden revisión')
    expect(textoPantalla()).toContain('Sin POS asociado')
    expect(textoPantalla()).toContain('Sin rango documentado')
    expect(textoPantalla()).toContain('Confirmadas')
    expect(textoPantalla()).toContain('POS de prueba A')
  })

  it('la ficha separa lo documentado de lo confirmado: el vencimiento de la fuente dice "sin confirmar"', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'doc', vencimientoDocumentado: '2026-12-03', vigenciaReportada: '24 meses' })
    await montar(RUTAS, '/facturacion/doc')
    await esperar(() => textoPantalla().includes('Lo documentado'), 'la ficha')
    expect(textoPantalla()).toContain('Vence según la fuente (sin confirmar)')
    expect(textoPantalla()).toContain('3 dic 2026')
    expect(textoPantalla()).toContain('Lo confirmado')
    expect(textoPantalla()).toContain('Sin verificar con una fuente actual.')
    expect(textoPantalla()).not.toContain('Vencimiento confirmado')
    await esperar(() => textoPantalla().includes('POS de prueba A'), 'su POS, que se lee vivo de los equipos')
  })
})

describe('la Agenda', () => {
  it('avisa del vencimiento confirmado y nunca del que solo da la fuente', async () => {
    await sembrarBase()
    await sembrarAutorizacion({
      id: 'conf',
      prefijo: 'CNF',
      estado: 'confirmada',
      verificadoEn: '2026-10-09',
      verificacionFuente: 'Consulta de prueba',
      vencimientoConfirmado: fechaRelativa(5),
    })
    await sembrarAutorizacion({ id: 'doc', prefijo: 'DOC', dispositivoIds: ['pos-b'], vencimientoDocumentado: fechaRelativa(2) })
    await montar(RUTAS, '/agenda')
    await esperar(() => textoPantalla().includes('POS de prueba A'), 'el aviso del confirmado')
    expect(textoPantalla()).toContain('Autorización CNF')
    expect(textoPantalla()).not.toContain('POS de prueba B')
    expect(textoPantalla()).not.toContain('Autorización DOC')
  })
})
