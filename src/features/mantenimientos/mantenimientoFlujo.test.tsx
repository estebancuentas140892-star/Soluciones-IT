// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Mantenimiento } from '../../lib/db'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarQue,
  limpiarBase,
  montar,
  pausa,
  PERFIL_PRUEBA,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { DispositivoPage } from '../dispositivos/DispositivoPage'
import { AgendaPage } from '../inicio/AgendaPage'
import { antecedenteDesdeCronograma } from './antecedentes'
import { MantenimientoPage } from './MantenimientoPage'

// MANTENIMIENTO OPERATIVO, DE PUNTA A PUNTA (tarea 320, encargo del
// 2026-10-10, fase B). Lo que solo se ve montando las pantallas:
//
//   - en la ficha, "Más del equipo" > "Mantenimiento" programa uno;
//   - la Agenda lo deriva por su fecha y lleva a su pantalla;
//   - "Se hizo" pide fecha real, quién y qué, y "Cerrar y registrar en el
//     equipo" deja la intervención en el historial del equipo, el
//     mantenimiento realizado y fuera de la Agenda, con la evidencia a
//     mano;
//   - posponer lo deja abierto con la fecha nueva; cancelar pide motivo;
//   - un antecedente por validar se ve aparte y no se cierra.
//
// Todo lo que se siembra es INVENTADO. La base es la local (IndexedDB):
// sin red, todo queda en la cola para subir.

const RUTAS = [
  { ruta: '/agenda', elemento: <AgendaPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> },
  { ruta: '/dispositivos/:dispositivoId/mantenimientos/:mantenimientoId', elemento: <MantenimientoPage /> },
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
  await sembrarEquipo({ id: 'pc', nombre: 'PC de prueba', estado: 'Operativo' })
}

async function sembrarMantenimiento(datos: Partial<Mantenimiento> & { id: string }): Promise<void> {
  await db.mantenimientos.put({
    dispositivoId: 'pc',
    tipo: 'preventivo',
    fechaProgramada: fechaRelativa(-2),
    estado: 'programado',
    tecnico: '',
    fechaRealizada: null,
    resultado: '',
    observaciones: '',
    historialId: null,
    fuente: '',
    validacion: 'confirmado',
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  })
}

function campoDe(etiqueta: string): HTMLInputElement | HTMLTextAreaElement {
  const rotulo = Array.from(document.body.querySelectorAll('label')).find((l) =>
    (l.textContent ?? '').trim().startsWith(etiqueta),
  )
  const campo = rotulo?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  if (!campo) throw new Error(`No está el campo "${etiqueta}".`)
  return campo
}

/** Escribe también en un textarea (el ayudante común solo cubre <input>). */
async function rellenar(campo: HTMLInputElement | HTMLTextAreaElement, texto: string): Promise<void> {
  if (campo instanceof HTMLInputElement) return escribir(campo, texto)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await pausa()
}

function opcion(texto: string): HTMLElement {
  const encontrada = Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]')).find(
    (el) => (el.textContent ?? '').trim() === texto,
  )
  if (!encontrada) throw new Error(`No está la opción "${texto}".`)
  return encontrada
}

beforeEach(async () => {
  await limpiarBase()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('programar desde la ficha del equipo', () => {
  it('"Mantenimiento" programa uno y lo enseña con cuándo toca', async () => {
    await sembrarBase()
    await montar(RUTAS, '/dispositivos/pc')
    await tocar(await esperar(() => control(/^Más del equipo/), 'Más del equipo'))
    const seccion = await esperar(() => control(/^Mantenimiento/), 'la fila Mantenimiento')
    expect(seccion.textContent).toContain('Ninguno')
    await tocar(seccion)
    await tocar(await esperar(() => control('Programar'), 'Programar'))

    // Sin fecha no se guarda, y lo dice.
    await tocar(control('Programar mantenimiento') as HTMLElement)
    await esperar(() => textoPantalla().includes('Elige la fecha en que toca.'), 'el aviso')
    expect(await db.mantenimientos.count()).toBe(0)

    await tocar(opcion('Correctivo'))
    await rellenar(campoDe('Fecha en que toca'), fechaRelativa(5))
    await rellenar(campoDe('Observaciones'), 'Revisar ventilador')
    await tocar(control('Programar mantenimiento') as HTMLElement)

    await esperarQue(async () => (await db.mantenimientos.count()) === 1, 'se guarda')
    const [guardado] = await db.mantenimientos.toArray()
    expect(guardado).toMatchObject({
      dispositivoId: 'pc',
      tipo: 'correctivo',
      fechaProgramada: fechaRelativa(5),
      estado: 'programado',
      validacion: 'confirmado',
      observaciones: 'Revisar ventilador',
    })
    await esperar(() => control(/^Mantenimiento correctivo/), 'la fila del programado')
    // Queda en la cola para subir, con su constancia en el historial del equipo.
    const cola = await db.cambiosPendientes.toArray()
    expect(cola.map((c) => c.tabla).sort()).toEqual(['historial', 'mantenimientos'])
  })

  it('un antecedente por validar sale aparte, dice su fuente y no se cierra', async () => {
    await sembrarBase()
    await sembrarMantenimiento({
      id: 'ant',
      fechaProgramada: '2025-03-12',
      validacion: 'documentado_por_validar',
      fuente: 'Cronograma de prueba 2025',
    })
    await montar(RUTAS, '/dispositivos/pc')
    await tocar(await esperar(() => control(/^Más del equipo/), 'Más del equipo'))
    const seccion = await esperar(() => control(/^Mantenimiento/), 'la fila Mantenimiento')
    // No es trabajo pendiente: la fila sigue diciendo "Ninguno".
    expect(seccion.textContent).toContain('Ninguno')
    await tocar(seccion)
    await esperar(() => textoPantalla().includes('Antecedentes por validar'), 'el bloque aparte')
    expect(textoPantalla()).toContain('Por validar · Cronograma de prueba 2025')

    await tocar(control(/Cronograma de prueba 2025/) as HTMLElement)
    await esperar(() => textoPantalla().includes('Antecedente por validar'), 'su pantalla')
    expect(control('Cerrar y registrar en el equipo')).toBeNull()
    expect(document.body.querySelector('[role="radio"]')).toBeNull()
  })
})

// LO QUE LA FUENTE DE UN ANTECEDENTE DICE (revisión del 2026-10-10). La
// pantalla del antecedente solo enseñaba la fuente aunque la fila trajera
// fecha real, técnico o resultado sacados de ella. Ahora los enseña, como
// documentados y por validar, nunca como un desenlace confirmado.
describe('la pantalla de un antecedente por validar', () => {
  const RUTA = '/dispositivos/pc/mantenimientos/ant'

  async function sembrarAntecedente(datos: Partial<Mantenimiento> = {}): Promise<void> {
    await sembrarBase()
    await sembrarMantenimiento({
      id: 'ant',
      fechaProgramada: '2025-03-12',
      validacion: 'documentado_por_validar',
      fuente: 'Acta de prueba 2025',
      ...datos,
    })
  }

  /** El recuadro de lo documentado en la fuente, si está. */
  function recuadroDocumentado(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>('[aria-label="Documentado en la fuente, por validar"]')
  }

  it('solo con fuente: no inventa fecha real, técnico ni resultado', async () => {
    await sembrarAntecedente()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Antecedente por validar'), 'su pantalla')

    expect(textoPantalla()).toContain('Fuente: Acta de prueba 2025')
    expect(recuadroDocumentado()).toBeNull()
    for (const etiqueta of ['Fecha real documentada', 'Técnico documentado', 'Resultado documentado', 'Lo hizo', 'Se hizo el']) {
      expect(textoPantalla()).not.toContain(etiqueta)
    }
  })

  // Segunda revisión del 2026-10-10: la marca REALIZADO del cronograma se
  // ve como lo que la fuente marca, nunca como un cierre confirmado.
  it('una marca REALIZADO del cronograma enseña el estado marcado, sin banda de realizado ni evidencia', async () => {
    await sembrarBase()
    await db.mantenimientos.put({
      ...antecedenteDesdeCronograma('ant', {
        dispositivoId: 'pc',
        tipo: 'preventivo',
        estadoMarcado: 'REALIZADO',
        anio: 2025,
        hoja: 'Marzo',
        tituloHoja: 'Cronograma de mantenimiento marzo 2025',
        dia: 12,
        fuente: 'Cronograma de prueba 2025, hoja Marzo',
      }),
      updatedAt: AHORA,
      updatedBy: null,
      eliminadoEn: null,
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Antecedente por validar'), 'su pantalla')

    expect(textoPantalla()).toContain('Estado marcado en la fuente: REALIZADO.')
    expect(textoPantalla()).toContain('No confirma que siga pendiente ni que se hiciera')
    expect(textoPantalla()).not.toContain('Realizado y registrado en el historial del equipo.')
    for (const etiqueta of ['Se hizo el', 'Lo hizo', 'Qué se hizo', 'Evidencia', 'Técnico documentado', 'Resultado documentado']) {
      expect(textoPantalla()).not.toContain(etiqueta)
    }
    expect(recuadroDocumentado()).toBeNull()
    expect(control('Cerrar y registrar en el equipo')).toBeNull()
    expect(document.body.querySelector('[role="radio"]')).toBeNull()
  })

  it('con fecha real, técnico y resultado documentados: los enseña dentro de "documentado en la fuente · por validar"', async () => {
    await sembrarAntecedente({
      estado: 'realizado',
      fechaRealizada: '2025-03-14',
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza de prueba según el acta',
    })
    await montar(RUTAS, RUTA)
    await esperar(() => recuadroDocumentado(), 'el recuadro documentado')

    const recuadro = recuadroDocumentado() as HTMLElement
    const texto = recuadro.textContent ?? ''
    expect(texto).toMatch(/Documentado en la fuente · por validar/i)
    expect(texto).toContain('Fecha real documentada')
    expect(texto).toContain('2025')
    expect(texto).toContain('Técnico documentado')
    expect(texto).toContain('Técnico de prueba')
    expect(texto).toContain('Resultado documentado')
    expect(texto).toContain('Limpieza de prueba según el acta')
    // La fuente sigue a la vista.
    expect(textoPantalla()).toContain('Fuente: Acta de prueba 2025')
  })

  it('con datos documentados sigue siendo "por validar": ni banda de confirmado ni controles de cierre', async () => {
    await sembrarAntecedente({
      estado: 'realizado',
      fechaRealizada: '2025-03-14',
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza de prueba según el acta',
    })
    await montar(RUTAS, RUTA)
    await esperar(() => recuadroDocumentado(), 'el recuadro documentado')

    expect(textoPantalla()).toContain('Antecedente por validar')
    expect(textoPantalla()).not.toContain('Realizado y registrado en el historial del equipo.')
    expect(control('Cerrar y registrar en el equipo')).toBeNull()
    expect(document.body.querySelector('[role="radio"]')).toBeNull()
    expect(document.body.querySelector('input, textarea, select')).toBeNull()
    // Nada se escribió al mirarlo.
    expect(await db.cambiosPendientes.count()).toBe(0)
    expect((await db.mantenimientos.get('ant'))?.validacion).toBe('documentado_por_validar')

    // Y en la lista del equipo sigue en su bloque aparte.
    await montar(RUTAS, '/dispositivos/pc')
    await tocar(await esperar(() => control(/^Más del equipo/), 'Más del equipo'))
    await tocar(await esperar(() => control(/^Mantenimiento/), 'la fila Mantenimiento'))
    await esperar(() => textoPantalla().includes('Antecedentes por validar'), 'el bloque aparte')
    expect(textoPantalla()).toContain('Por validar · Acta de prueba 2025')
  })

  it('nunca entra en la Agenda, aunque traiga fecha, técnico y resultado', async () => {
    await sembrarAntecedente({
      fechaProgramada: fechaRelativa(-2),
      fechaRealizada: fechaRelativa(-1),
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza de prueba según el acta',
    })
    // Uno confirmado al lado, para saber que la Agenda sí está pintando.
    await sembrarMantenimiento({ id: 'm-confirmado', tipo: 'correctivo' })
    await montar(RUTAS, '/agenda')

    await esperar(() => textoPantalla().includes('Mantenimiento correctivo'), 'el confirmado en la Agenda')
    expect(textoPantalla()).not.toContain('Mantenimiento preventivo')
    expect(textoPantalla()).not.toContain('Acta de prueba 2025')
  })
})

describe('desde la Agenda hasta cerrarlo', () => {
  it('la Agenda lo deriva por su fecha; "Se hizo" lo cierra, lo registra en el equipo y lo saca de la Agenda', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'm1' })
    await montar(RUTAS, '/agenda')

    await esperar(() => textoPantalla().includes('PC de prueba'), 'el equipo en la Agenda')
    expect(textoPantalla()).toContain('Atrasado 2 días')
    expect(textoPantalla()).toContain('Mantenimiento preventivo')
    await tocar(control(/PC de prueba/) as HTMLElement)
    await esperar(() => ubicacionActual().pathname === '/dispositivos/pc/mantenimientos/m1', 'su pantalla')

    // "Se hizo" viene elegido; propone hoy y el nombre de quien tiene la sesión.
    await esperar(() => control('Cerrar y registrar en el equipo'), 'el cierre')
    expect(opcion('Se hizo').getAttribute('aria-checked')).toBe('true')
    expect(campoDe('Fecha en que se hizo').value).toBe(fechaRelativa(0))
    await esperarQue(async () => campoDe('Quién lo hizo').value === PERFIL_PRUEBA.nombre, 'el técnico propuesto')

    // Sin decir qué se hizo no cierra.
    await tocar(control('Cerrar y registrar en el equipo') as HTMLElement)
    await esperar(() => textoPantalla().includes('Di qué se hizo y cómo quedó.'), 'el aviso')
    expect((await db.mantenimientos.get('m1'))?.estado).toBe('programado')

    await rellenar(campoDe('Fecha en que se hizo'), fechaRelativa(-1))
    await rellenar(campoDe('Quién lo hizo'), 'Técnico de prueba')
    await rellenar(campoDe('Qué se hizo y cómo quedó'), 'Limpieza interna; queda operativo.')
    await tocar(control('Cerrar y registrar en el equipo') as HTMLElement)

    await esperar(() => textoPantalla().includes('Realizado y registrado en el historial del equipo.'), 'el cierre hecho')
    const cerrado = (await db.mantenimientos.get('m1')) as Mantenimiento
    expect(cerrado).toMatchObject({
      estado: 'realizado',
      fechaRealizada: fechaRelativa(-1),
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza interna; queda operativo.',
    })
    const intervencion = await db.historial.get(cerrado.historialId as string)
    expect(intervencion).toMatchObject({ entidadTipo: 'dispositivo', entidadId: 'pc', campo: 'intervencion' })
    expect(intervencion?.valorNuevo).toContain('por Técnico de prueba: Limpieza interna; queda operativo.')
    // La evidencia se adjunta a esa intervención, aquí mismo.
    expect(textoPantalla()).toContain('Evidencia (opcional)')

    // Y ya no está en la Agenda (otro equipo con uno abierto demuestra
    // que la Agenda cargó: la ausencia no es una pantalla vacía).
    await sembrarEquipo({ id: 'otro', nombre: 'Impresora de prueba', estado: 'Operativo' })
    await sembrarMantenimiento({ id: 'm-otro', dispositivoId: 'otro', fechaProgramada: fechaRelativa(0) })
    await desmontarTodo()
    await montar(RUTAS, '/agenda')
    await esperar(() => textoPantalla().includes('Impresora de prueba'), 'la Agenda cargada')
    expect(textoPantalla()).not.toContain('PC de prueba')
  })

  it('posponer lo deja abierto con la fecha nueva; cancelar pide el motivo y lo deja en el historial', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'm2' })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos/m2')
    await esperar(() => control('Cerrar y registrar en el equipo'), 'la pantalla')

    await tocar(opcion('Se pospone'))
    await rellenar(campoDe('Nueva fecha'), fechaRelativa(7))
    await rellenar(campoDe('Motivo'), 'Sin repuesto')
    await tocar(control('Posponer') as HTMLElement)
    await esperarQue(async () => (await db.mantenimientos.get('m2'))?.estado === 'pospuesto', 'pospuesto')
    expect((await db.mantenimientos.get('m2'))?.fechaProgramada).toBe(fechaRelativa(7))
    const pospuesto = (await db.historial.toArray()).find((e) => e.campo === 'mantenimiento')
    expect(pospuesto?.motivo).toBe('Sin repuesto')

    // Sigue abierto: se puede cancelar, pero no sin motivo.
    await tocar(opcion('Se cancela'))
    await tocar(control('Cancelar mantenimiento') as HTMLElement)
    await esperar(() => textoPantalla().includes('Di por qué se cancela.'), 'el aviso')
    await rellenar(campoDe('Por qué se cancela'), 'El equipo se reemplaza')
    await tocar(control('Cancelar mantenimiento') as HTMLElement)
    await esperarQue(async () => (await db.mantenimientos.get('m2'))?.estado === 'cancelado', 'cancelado')
    await esperar(() => textoPantalla().includes('Cancelado. El motivo está en el historial del equipo.'), 'lo dice')
    const cancelacion = (await db.historial.toArray()).find((e) => e.motivo === 'El equipo se reemplaza')
    expect(cancelacion?.valorNuevo).toContain('cancelado')
  })
})
