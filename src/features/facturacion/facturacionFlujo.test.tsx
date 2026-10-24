// @vitest-environment happy-dom
import { act } from 'react'
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
  pausa,
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
//   - en la ficha de un POS, el índice "Más del equipo" > "Facturación" (su hoja desde la tarea 329) dice qué
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

/** Un adjunto inventado colgado de un equipo. */
async function sembrarAdjunto(id: string, entidadId: string, nombre: string): Promise<void> {
  await db.adjuntos.put({
    id,
    entidadTipo: 'dispositivo',
    entidadId,
    nombre,
    tipo: 'application/pdf',
    referencia: `pruebas/${id}.pdf`,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
}

function casilla(nombre: string): HTMLElement {
  const encontrada = Array.from(document.body.querySelectorAll<HTMLElement>('[role="checkbox"]')).find((c) =>
    (c.textContent ?? '').includes(nombre),
  )
  if (!encontrada) throw new Error(`No está la casilla "${nombre}".`)
  return encontrada
}

function selectorDocumento(): HTMLSelectElement | null {
  const rotulo = Array.from(document.body.querySelectorAll('label')).find((l) =>
    (l.textContent ?? '').trim().startsWith('Documento adjunto'),
  )
  return rotulo?.querySelector('select') ?? null
}

async function elegir(selector: HTMLSelectElement, valor: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(selector, valor)
    selector.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await pausa()
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
  it('"Facturación" dice "Sin autorización" y registra una autorización documentada con ese POS ya marcado', async () => {
    await sembrarBase()
    await montar(RUTAS, '/dispositivos/pos-a')
    const seccion = await esperar(() => control(/^Facturación/), 'la fila Facturación')
    expect(seccion.textContent).toContain('Sin autorización')
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
    await esperar(() => control(/^Mantenimiento/), 'la sección de mantenimiento')
    expect(control(/^Facturación/)).toBeNull()
  })

  it('la fila del índice dice el estado útil y su hoja, prefijo, rango, estado, vencimiento y si pide revisión', async () => {
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
    const seccion = await esperar(() => control(/^Facturación/), 'la fila Facturación')
    // Una confirmada y otra por validar: manda lo que pide atención (tarea 342).
    await esperar(() => (seccion.textContent ?? '').includes('Por validar'), 'el estado útil')
    expect(seccion.querySelector('.text-noct-precaucion')?.textContent).toBe('Por validar')
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

// EL DOCUMENTO ES DE UNO DE SUS POS (revisión del 2026-10-10). El
// formulario solo ofrece los adjuntos de los POS marcados, pero un id
// elegido antes podía quedarse al desmarcar su POS.
describe('el documento adjunto', () => {
  it('desmarcar el POS del documento elegido lo quita, lo dice y no se guarda', async () => {
    await sembrarBase()
    await sembrarAdjunto('adj-a', 'pos-a', 'acta-prueba-a.pdf')
    await montar(RUTAS, '/facturacion/nueva?equipo=pos-a')
    await esperar(() => textoPantalla().includes('Lo que dice el documento'), 'el formulario')
    await llenarLoDocumentado()
    const selector = await esperar(() => selectorDocumento(), 'el selector de documento')
    await elegir(selector, 'adj-a')
    expect(selectorDocumento()?.value).toBe('adj-a')

    await tocar(casilla('POS de prueba B'))
    await tocar(casilla('POS de prueba A'))
    await esperar(
      () => textoPantalla().includes('Se quitó el documento «acta-prueba-a.pdf»: es de POS de prueba A, que ya no está marcado.'),
      'el aviso visible',
    )
    // POS B no tiene adjuntos: ya no hay documento que elegir.
    expect(selectorDocumento()).toBeNull()

    await tocar(control('Guardar autorización') as HTMLElement)
    await esperarQue(async () => (await db.autorizaciones_facturacion.count()) === 1, 'se guarda')
    const [guardada] = await db.autorizaciones_facturacion.toArray()
    expect(guardada).toMatchObject({ dispositivoIds: ['pos-b'], evidenciaAdjuntoId: null })
  })

  it('con su POS marcado, el documento elegido se guarda', async () => {
    await sembrarBase()
    await sembrarAdjunto('adj-a', 'pos-a', 'acta-prueba-a.pdf')
    await montar(RUTAS, '/facturacion/nueva?equipo=pos-a')
    await esperar(() => textoPantalla().includes('Lo que dice el documento'), 'el formulario')
    await llenarLoDocumentado()
    await elegir(await esperar(() => selectorDocumento(), 'el selector de documento'), 'adj-a')
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperarQue(async () => (await db.autorizaciones_facturacion.count()) === 1, 'se guarda')
    expect((await db.autorizaciones_facturacion.toArray())[0].evidenciaAdjuntoId).toBe('adj-a')
  })

  it('al guardar, el documento de un POS que no está asociado no queda como referencia huérfana', async () => {
    await sembrarBase()
    // Como podría llegar de una carga directa: el documento es de POS B
    // y la autorización solo usa POS A.
    await sembrarAdjunto('adj-b', 'pos-b', 'acta-prueba-b.pdf')
    await sembrarAutorizacion({ id: 'huerfana', evidenciaAdjuntoId: 'adj-b' })

    await montar(RUTAS, '/facturacion/huerfana')
    await esperar(() => textoPantalla().includes('Lo documentado'), 'la ficha')
    await pausa(100)
    expect(textoPantalla()).not.toContain('acta-prueba-b.pdf')

    await navegarA('/facturacion/huerfana/editar')
    await esperar(() => campoDe('Prefijo').value === 'PRB', 'el formulario')
    await tocar(control('Guardar autorización') as HTMLElement)
    await esperarQue(
      async () => (await db.autorizaciones_facturacion.get('huerfana'))?.evidenciaAdjuntoId === null,
      'el documento ajeno se suelta',
    )
    expect((await db.autorizaciones_facturacion.get('huerfana'))?.dispositivoIds).toEqual(['pos-a'])
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

describe('la ficha en tres formas (tarea 331)', () => {
  it('lo documentado punteado y según su fuente, lo confirmado con su vencimiento y el dato actual como lectura; Eliminar en el menú', async () => {
    await sembrarBase()
    await sembrarAutorizacion({
      id: 'conf',
      prefijo: 'CNF',
      estado: 'confirmada',
      verificadoEn: '2026-10-09',
      verificacionFuente: 'Consulta de prueba',
      vencimientoConfirmado: '2028-05-14',
      consecutivoActual: 5500,
      consecutivoLeidoEn: '2026-10-09',
      consecutivoFuente: 'Caja de prueba',
    })
    await montar(RUTAS, '/facturacion/conf')

    await esperar(() => textoPantalla().includes('1 · Lo documentado'), 'la ficha')
    const texto = textoPantalla()
    expect(texto).toContain('Según Documento de prueba')
    expect(texto).toContain('2 · Lo confirmado')
    expect(texto).toContain('Vence14 may 2028')
    expect(texto).toContain('3 · Dato actual')
    expect(texto).toContain('5.500')
    expect(texto).toContain('Quedan 2.500 números según esa lectura.')
    expect(texto).toContain('Leído el 9 oct 2026 en Caja de prueba')
    // El prefijo, en grande y en monoespaciada.
    const prefijo = document.body.querySelector('main h1')
    expect(prefijo?.textContent).toBe('CNF')
    expect(prefijo?.classList.contains('font-mono')).toBe(true)
    // Eliminar no va junto a Editar: vive en el menú, que en el teléfono es
    // una hoja (tarea 343), con editar, marcar como reemplazada y, aparte y
    // en rojo, eliminar.
    expect(control('Editar')).not.toBeNull()
    expect(control('Eliminar')).toBeNull()
    const menu = await esperar(() => control(/^Acciones de la autorización/), 'el menú')
    expect(menu.getAttribute('aria-haspopup')).toBe('dialog')
    await tocar(menu)
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja del menú')
    const eliminar = control('Eliminar') as HTMLElement
    expect(hoja.contains(eliminar)).toBe(true)
    expect(eliminar.className).toContain('text-noct-error')
    expect(eliminar.parentElement?.className).toContain('border-t')
    // "Marcar como reemplazada" es el formulario de siempre, donde se elige ese estado.
    expect(control('Editar autorización')?.getAttribute('href')).toBe('/facturacion/conf/editar')
    expect(control(/^Marcar como reemplazada/)?.getAttribute('href')).toBe('/facturacion/conf/editar')
  })

  it('sin verificar ni lectura lo dice, con sus dos accesos, y una reemplazada se lee atenuada', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'vieja', prefijo: 'OLD', estado: 'reemplazada' })
    await montar(RUTAS, '/facturacion/vieja')
    await esperar(() => textoPantalla().includes('Sin verificar con una fuente actual.'), 'la ficha')
    expect(textoPantalla()).toContain('Sin lectura. No se estima por fechas ni por consumo.')
    expect(control('Registrar verificación')?.getAttribute('href')).toBe('/facturacion/vieja/editar')
    // Con rango, la lectura se registra en su hoja (RP-2, tarea 335).
    expect(control('Registrar lectura')?.tagName).toBe('BUTTON')
    let capa = document.getElementById('aut-documentado')?.parentElement ?? null
    while (capa && !capa.className.includes('opacity-[.62]')) capa = capa.parentElement
    expect(capa).not.toBeNull()
  })
})

// RP-2 (tarea 335): la lectura del consecutivo, en una hoja con sus tres
// campos, con las mismas validaciones y el mismo historial que el formulario.
describe('registrar una lectura sin abrir el formulario', () => {
  function hoja(): HTMLElement {
    const dialogo = document.body.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialogo) throw new Error('Sin hoja abierta')
    return dialogo
  }

  it('propone hoy y el sitio de la última, valida en la hoja y guarda con su historial', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'lec', consecutivoActual: 3500, consecutivoLeidoEn: '2026-10-01', consecutivoFuente: 'Caja de prueba' })
    await montar(RUTAS, '/facturacion/lec')
    await esperar(() => textoPantalla().includes('Quedan 4.500 números'), 'la ficha con su lectura')

    await tocar(control('Registrar lectura') as HTMLElement)
    await esperar(() => document.body.querySelector('[role="dialog"]'), 'la hoja')
    expect(hoja().textContent).toContain('Última lectura: 3.500, el 1 oct 2026 en Caja de prueba.')
    expect(campoDe('Último consecutivo emitido').value).toBe('')
    expect(campoDe('Leído el').value).toBe(fechaRelativa(0))
    expect(campoDe('Dónde se leyó').value).toBe('Caja de prueba')
    // Sin formulario completo: solo los tres campos de la lectura.
    expect(hoja().querySelectorAll('input')).toHaveLength(3)

    // Las reglas de siempre: sin número no guarda y fuera del rango lo dice.
    await tocar(control('Guardar lectura') as HTMLElement)
    await esperar(() => hoja().textContent?.includes('pide el número'), 'el aviso de los tres')
    await escribir(campoDe('Último consecutivo emitido'), '9000')
    await tocar(control('Guardar lectura') as HTMLElement)
    await esperar(() => hoja().textContent?.includes('dentro del rango (3.000 a 8.000)'), 'el aviso del rango')
    expect((await db.autorizaciones_facturacion.get('lec'))?.consecutivoActual).toBe(3500)

    await escribir(campoDe('Último consecutivo emitido'), '4.200')
    await tocar(control('Guardar lectura') as HTMLElement)
    await esperarQue(async () => (await db.autorizaciones_facturacion.get('lec'))?.consecutivoActual === 4200, 'se guarda')
    await esperar(() => !document.body.querySelector('[role="dialog"]'), 'la hoja se cierra')
    await esperar(() => textoPantalla().includes('Quedan 3.800 números según esa lectura.'), 'la ficha con la nueva')
    const guardada = await db.autorizaciones_facturacion.get('lec')
    expect(guardada).toMatchObject({ consecutivoLeidoEn: fechaRelativa(0), consecutivoFuente: 'Caja de prueba', prefijo: 'PRB', rangoHasta: 8000 })
    const entrada = (await db.historial.toArray()).find((e) => e.campo === 'autorizacion_facturacion')
    expect(entrada).toMatchObject({ entidadId: 'pos-a' })
    expect(ubicacionActual().pathname).toBe('/facturacion/lec')
  })

  it('sin rango no hay lectura posible: lleva al formulario', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'sinrango', rangoDesde: null, rangoHasta: null })
    await montar(RUTAS, '/facturacion/sinrango')
    await esperar(() => textoPantalla().includes('Sin lectura.'), 'la ficha')
    expect(control('Registrar lectura')?.getAttribute('href')).toBe('/facturacion/sinrango/editar')
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

// TAREA 343: LA AUTORIZACIÓN EN EL TELÉFONO, FIEL AL HANDOFF "1b Pulgar".
// Solo presentación: las tres capas no se mezclan y nada se estima. Todo
// inventado.
describe('la autorización en el teléfono (tarea 343)', () => {
  it('el carnet: el prefijo una sola vez a la vista, la pastilla con punto y cada capa dice qué es', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'doc', prefijo: 'DOC' })
    await montar(RUTAS, '/facturacion/doc')
    await esperar(() => textoPantalla().includes('Lo que dice cada fuente. Nadie lo ha comprobado.'), 'la ficha')
    // Mientras el carnet está a la vista, la cabecera no repite el prefijo.
    const cabecera = Array.from(document.body.querySelectorAll('h1')).find((h) => !h.closest('main'))
    expect(cabecera?.className).toContain('opacity-0')
    const carnet = document.body.querySelector('main h1')
    expect(carnet?.textContent).toBe('DOC')
    const pastilla = carnet?.parentElement?.querySelector('[data-punto-estado]')
    expect(pastilla?.parentElement?.textContent).toBe('Documentada, por validar')
    // Las tres capas, en su orden, cada una con lo que representa.
    const textos = ['Lo que dice cada fuente. Nadie lo ha comprobado.', 'Comprobado con una fuente actual.', 'El consecutivo leído en el POS.']
    const pantalla = textoPantalla()
    expect(textos.map((t) => pantalla.indexOf(t))).toEqual([...textos.map((t) => pantalla.indexOf(t))].sort((a, b) => a - b))
    for (const t of textos) expect(pantalla).toContain(t)
    // La fuente de cada capa en la suya.
    expect(document.getElementById('aut-documentado')?.closest('section')?.textContent).toContain('Según Documento de prueba')
  })

  it('sin lectura, el instrumento vacío: su rótulo, el marcador y el carril, sin ningún número', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'sin', prefijo: 'SIN' })
    await montar(RUTAS, '/facturacion/sin')
    const vacio = await esperar(() => document.body.querySelector<HTMLElement>('[data-instrumento-vacio]'), 'el instrumento vacío')
    expect(vacio.textContent).toContain('Último emitido')
    expect(vacio.textContent).not.toMatch(/\d/)
    expect(vacio.className).toContain('md:hidden')
    expect(vacio.closest('[data-instrumento]')?.textContent).toContain('Sin lectura. No se estima por fechas ni por consumo.')
  })

  it('la lista: filas de 72 con el prefijo en mono, su estado, el contexto y el galón', async () => {
    await sembrarBase()
    await sembrarAutorizacion({ id: 'fila', prefijo: 'FIL' })
    await montar(RUTAS, '/facturacion')
    const fila = await esperar(() => control(/^FIL/), 'la fila')
    expect(fila.className).toContain('max-md:min-h-[72px]')
    expect(fila.className).toContain('max-md:active:bg-noct-presionado')
    const prefijo = Array.from(fila.querySelectorAll('span')).find((s) => s.textContent === 'FIL')
    expect(prefijo?.className).toContain('max-md:font-mono')
    // A 18 · 700 desde la tarea 352 (las piezas de «Ventana»).
    expect(prefijo?.className).toContain('max-md:text-[18px]')
    expect(fila.textContent).toContain('Documentada, por validar')
    expect(fila.textContent).toContain('Rango 3.000 a 8.000')
    // El galón de pantalla en el teléfono (desde 768, el "Ver" de siempre).
    expect(Array.from(fila.querySelectorAll('svg')).some((icono) => (icono.getAttribute('class') ?? '').includes('md:hidden'))).toBe(true)
  })
})
