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
import { MantenimientosPage } from './MantenimientosPage'

// MANTENIMIENTO OPERATIVO, DE PUNTA A PUNTA (tarea 320, encargo del
// 2026-10-10, fase B). Lo que solo se ve montando las pantallas:
//
//   - en la ficha, el índice "Más del equipo" > "Mantenimiento" (su hoja desde la tarea 329) programa uno;
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
  { ruta: '/dispositivos/:dispositivoId/mantenimientos', elemento: <MantenimientosPage /> },
  { ruta: '/dispositivos/:dispositivoId/mantenimientos/:mantenimientoId', elemento: <MantenimientoPage /> },
]

/** El botón de enviar de la hoja abierta (el de "Programar mantenimiento" de la hoja, no el de la pantalla). */
function enviarDeLaHoja(): HTMLElement {
  const boton = document.body.querySelector<HTMLElement>('[role="dialog"] button[type="submit"]')
  if (!boton) throw new Error('Sin hoja con formulario')
  return boton
}

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

// Desde la tarea 343 la respuesta del cierre lleva debajo lo que hace ("Se
// hizo" · "Queda en el historial del equipo"): se busca por su palabra.
function opcion(texto: string): HTMLElement {
  const encontrada = Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]')).find(
    (el) => (el.textContent ?? '').trim().startsWith(texto),
  )
  if (!encontrada) throw new Error(`No está la opción "${texto}".`)
  return encontrada
}

// En el teléfono (tarea 345) el registro dice dónde queda, y cuándo y quién
// van en una línea con "Cambiar", que abre sus dos campos.
const GUARDAR = 'Guardar en el historial'

async function cambiarQuienYCuando(): Promise<void> {
  await tocar(await esperar(() => control('Cambiar la fecha o quién lo hizo'), 'Cambiar'))
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
    const seccion = await esperar(() => control(/^Mantenimiento/), 'la fila Mantenimiento')
    // Sin ninguno registrado, en el teléfono "Nada programado" (tarea 344);
    // en el índice de 768 en adelante, "Al día" (tarea 342; antes "Ninguno").
    expect(seccion.textContent).toContain('Nada programado')
    // Mantenimiento se trabaja en su pantalla (tarea 331): la fila la abre.
    expect(seccion.getAttribute('aria-haspopup')).toBeNull()
    await tocar(seccion)
    await esperar(() => textoPantalla().includes('Sin mantenimientos'), 'su pantalla, vacía')
    await tocar(await esperar(() => control('Programar mantenimiento'), 'Programar mantenimiento'))
    await esperar(() => document.body.querySelector('[role="dialog"]'), 'la hoja de programar')

    // Sin fecha no se guarda, y lo dice.
    await tocar(enviarDeLaHoja())
    await esperar(() => textoPantalla().includes('Elige la fecha en que toca.'), 'el aviso')
    expect(await db.mantenimientos.count()).toBe(0)

    await tocar(opcion('Correctivo'))
    await rellenar(campoDe('Fecha en que toca'), fechaRelativa(5))
    await rellenar(campoDe('Observaciones'), 'Revisar ventilador')
    await tocar(enviarDeLaHoja())

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
    // Programado: su tarjeta, con "Cerrar mantenimiento".
    await esperar(() => control(/^Mantenimiento correctivo/), 'la tarjeta del programado')
    expect(control('Cerrar mantenimiento: Mantenimiento correctivo')).not.toBeNull()
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
    const seccion = await esperar(() => control(/^Mantenimiento/), 'la fila Mantenimiento')
    // No es trabajo pendiente: la fila sigue "Al día", sin el verde de un
    // realizado confirmado (tarea 342).
    expect(seccion.textContent).toContain('Al día')
    expect(seccion.querySelector('.text-noct-exito')).toBeNull()
    await tocar(seccion)
    await esperar(() => textoPantalla().includes('Documentado, por validar'), 'el bloque aparte')
    expect(textoPantalla()).toContain('Según Cronograma de prueba 2025')

    await tocar(control(/Cronograma de prueba 2025/) as HTMLElement)
    await esperar(() => textoPantalla().includes('Antecedente por validar'), 'su pantalla')
    expect(control('Cerrar y registrar en el equipo')).toBeNull()
    expect(document.body.querySelector('[role="radio"]')).toBeNull()
  })
})

describe('la pantalla de mantenimiento del equipo (tarea 331)', () => {
  it('enseña las tres formas, y "Cerrar mantenimiento" lo cierra en su hoja sin salir de la pantalla', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'm-abierto', tipo: 'correctivo' })
    await sembrarMantenimiento({
      id: 'm-hecho',
      estado: 'realizado',
      fechaRealizada: fechaRelativa(-30),
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza de prueba',
      historialId: 'h-prueba',
    })
    await sembrarMantenimiento({ id: 'ant', fechaProgramada: '2025-03-12', validacion: 'documentado_por_validar', fuente: 'Cronograma de prueba' })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos')

    await esperar(() => textoPantalla().includes('Realizado y confirmado'), 'la pantalla')
    const texto = textoPantalla()
    expect(texto.indexOf('Programado')).toBeLessThan(texto.indexOf('Realizado y confirmado'))
    expect(texto.indexOf('Realizado y confirmado')).toBeLessThan(texto.indexOf('Documentado, por validar'))
    expect(texto).toContain('Limpieza de prueba')
    expect(texto).toContain('Técnico de prueba')
    expect(texto).toContain('Según Cronograma de prueba')

    await tocar(await esperar(() => control('Cerrar mantenimiento: Mantenimiento correctivo'), 'Cerrar mantenimiento'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    expect(hoja.querySelector('[role="radiogroup"]')).not.toBeNull()
    await cambiarQuienYCuando()
    await rellenar(campoDe('Quién lo hizo'), 'Técnico de prueba')
    // Sin decir qué se hizo no se cierra, y lo dice en línea.
    await tocar(hoja.querySelector<HTMLElement>('button[type="submit"]') as HTMLElement)
    await esperar(() => hoja.querySelector('[role="alert"]'), 'el error en línea')
    expect((await db.mantenimientos.get('m-abierto'))?.estado).toBe('programado')

    await rellenar(campoDe('Qué se hizo y cómo quedó'), 'Cambio de prueba')
    await tocar(hoja.querySelector<HTMLElement>('button[type="submit"]') as HTMLElement)
    await esperarQue(async () => (await db.mantenimientos.get('m-abierto'))?.estado === 'realizado', 'se cierra')
    await esperar(() => !document.body.querySelector('[role="dialog"]'), 'la hoja cerrada')
    // Sigue en la misma pantalla, ya entre lo realizado.
    expect(ubicacionActual().pathname).toBe('/dispositivos/pc/mantenimientos')
    await esperar(() => textoPantalla().includes('Cambio de prueba'), 'el realizado nuevo')
    expect(control(/^Cerrar mantenimiento/)).toBeNull()
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

    // En el teléfono, "Según" su fuente real, con su pastilla "Por validar" (tarea 343).
    expect(textoPantalla()).toContain('Según Acta de prueba 2025')
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
    // En el teléfono, "Según" su fuente real, con su pastilla "Por validar" (tarea 343).
    expect(textoPantalla()).toContain('Según Acta de prueba 2025')
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
    await tocar(await esperar(() => control(/^Mantenimiento/), 'la fila Mantenimiento'))
    await esperar(() => textoPantalla().includes('Documentado, por validar'), 'el bloque aparte')
    expect(textoPantalla()).toContain('Según Acta de prueba 2025')
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

    // "Se hizo" viene elegido; propone hoy y el nombre de quien tiene la
    // sesión: en el teléfono lo dice en una línea, y "Cambiar" abre los campos.
    await esperar(() => control(GUARDAR), 'el cierre')
    expect(opcion('Se hizo').getAttribute('aria-checked')).toBe('true')
    const linea = await esperar(() => {
      const nodo = document.body.querySelector<HTMLElement>('[data-quien-y-cuando]')
      return nodo && (nodo.textContent ?? '').includes('lo hiciste tú') ? nodo : null
    }, 'cuándo y quién')
    expect(linea.textContent).toContain('Se hizo hoy')
    await cambiarQuienYCuando()
    expect(campoDe('Fecha en que se hizo').value).toBe(fechaRelativa(0))
    await esperarQue(async () => campoDe('Quién lo hizo').value === PERFIL_PRUEBA.nombre, 'el técnico propuesto')

    // Sin decir qué se hizo no cierra.
    await tocar(control(GUARDAR) as HTMLElement)
    await esperar(() => textoPantalla().includes('Di qué se hizo y cómo quedó.'), 'el aviso')
    expect((await db.mantenimientos.get('m1'))?.estado).toBe('programado')

    await rellenar(campoDe('Fecha en que se hizo'), fechaRelativa(-1))
    await rellenar(campoDe('Quién lo hizo'), 'Técnico de prueba')
    await rellenar(campoDe('Qué se hizo y cómo quedó'), 'Limpieza interna; queda operativo.')
    await tocar(control(GUARDAR) as HTMLElement)

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
    await esperar(() => control(GUARDAR), 'la pantalla')

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

// POR ANCHO (tarea 339, T8): desde 1024 lo hecho se lee en una lista tabular
// (fecha, qué se hizo y quién) y lo documentado por validar va aparte, en su
// columna. Las tres formas del dato y lo que abre cada fila no cambian.
describe('el mantenimiento de un equipo por ancho', () => {
  type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
  const ventana = window as unknown as VentanaDePrueba

  afterEach(() => {
    ventana.happyDOM.setViewport({ width: 375, height: 812 })
  })

  async function sembrarLosTres(): Promise<void> {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'm-prog', fechaProgramada: fechaRelativa(3) })
    await sembrarMantenimiento({
      id: 'm-hecho',
      estado: 'realizado',
      fechaProgramada: fechaRelativa(-20),
      fechaRealizada: fechaRelativa(-20),
      tecnico: 'Técnico de prueba',
      resultado: 'Se limpió el equipo de prueba',
    })
    await sembrarMantenimiento({
      id: 'm-ante',
      fechaProgramada: '2025-03-12',
      estado: 'realizado',
      validacion: 'documentado_por_validar',
      fuente: 'Cronograma de prueba',
    })
  }

  it('a 1280 px lo hecho va en una tabla y lo documentado en su columna', async () => {
    ventana.happyDOM.setViewport({ width: 1280, height: 832 })
    await sembrarLosTres()
    await montar(RUTAS, '/dispositivos/pc/mantenimientos')

    const tabla = await esperar(
      () => document.body.querySelector<HTMLElement>('[role="table"][aria-label="Mantenimientos realizados y confirmados"]'),
      'la tabla de lo hecho',
    )
    const filas = tabla.querySelectorAll('a[role="row"]')
    expect(filas).toHaveLength(1)
    expect(filas[0].textContent).toContain('Se limpió el equipo de prueba')
    expect(filas[0].textContent).toContain('Técnico de prueba')
    expect(filas[0].getAttribute('href')).toBe('/dispositivos/pc/mantenimientos/m-hecho')
    // Lo documentado no está en la columna de lo programado y lo hecho.
    const programado = document.body.querySelector('#mant-programado')?.closest('section')
    const columnaIzquierda = programado?.parentElement
    expect(columnaIzquierda?.contains(tabla)).toBe(true)
    expect(columnaIzquierda?.textContent).not.toContain('Según Cronograma de prueba')
    expect(textoPantalla()).toContain('Según Cronograma de prueba')
  })

  it('a 768 px, una columna con las tarjetas de siempre', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await sembrarLosTres()
    await montar(RUTAS, '/dispositivos/pc/mantenimientos')
    await esperar(() => textoPantalla().includes('Se limpió el equipo de prueba'), 'lo hecho')
    expect(document.body.querySelector('[role="table"]')).toBeNull()
  })
})

// TAREA 343: EL MANTENIMIENTO EN EL TELÉFONO, FIEL AL HANDOFF "1b Pulgar".
// Solo presentación: los mismos estados, las mismas tres respuestas y la
// misma regla de "Qué se hizo". Todo inventado.
describe('el mantenimiento en el teléfono (tarea 343)', () => {
  it('lo atrasado va en su pastilla de error y lo pospuesto en la de precaución, las dos con punto', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'atrasado', fechaProgramada: fechaRelativa(-3) })
    await sembrarMantenimiento({ id: 'pospuesto', tipo: 'correctivo', estado: 'pospuesto', fechaProgramada: fechaRelativa(4) })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos')
    const atrasado = await esperar(
      () => Array.from(document.body.querySelectorAll('span')).find((s) => s.textContent === 'Atrasado 3 días'),
      'lo atrasado',
    )
    // Desde la tarea 345, en su pastilla con punto (DESPUÉS de Claude Design).
    expect(atrasado.className).toContain('text-noct-error')
    expect(atrasado.querySelector('[data-punto-estado]')).not.toBeNull()
    const pastilla = await esperar(
      () => Array.from(document.body.querySelectorAll<HTMLElement>('span')).find((s) => s.textContent === 'Pospuesto · sigue pendiente'),
      'la pastilla de pospuesto',
    )
    expect(pastilla.querySelector('[data-punto-estado]')).not.toBeNull()
    expect(pastilla.className).toContain('text-noct-precaucion')
  })

  it('lo realizado dice su evidencia y "En el historial" en éxito; sin evidencia no la inventa', async () => {
    await sembrarBase()
    await sembrarMantenimiento({
      id: 'hecho',
      estado: 'realizado',
      fechaRealizada: fechaRelativa(-1),
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza de prueba',
      historialId: 'int-hecho',
    })
    await sembrarMantenimiento({
      id: 'sin-evidencia',
      tipo: 'correctivo',
      estado: 'realizado',
      fechaRealizada: fechaRelativa(-5),
      tecnico: 'Técnico de prueba',
      resultado: 'Cambio de prueba',
      historialId: 'int-sin',
    })
    await db.adjuntos.put({
      id: 'foto-hecho',
      entidadTipo: 'historial',
      entidadId: 'int-hecho',
      nombre: 'foto-de-prueba.jpg',
      tipo: 'image/jpeg',
      referencia: 'adjuntos/foto-de-prueba.jpg',
      updatedAt: AHORA,
      updatedBy: null,
      eliminadoEn: null,
    })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos')
    const hecho = await esperar(() => control(/^Mantenimiento preventivo/), 'el realizado')
    await esperar(() => (hecho.textContent ?? '').includes('1 adjunto'), 'su evidencia')
    const historial = Array.from(hecho.querySelectorAll('span')).find((s) => s.textContent === 'En el historial')
    expect(historial?.className).toContain('text-noct-exito')
    const sin = control(/^Mantenimiento correctivo/) as HTMLElement
    expect(sin.textContent).not.toContain('adjunto')
    expect(sin.textContent).toContain('En el historial')

    // Su pantalla lo dice igual, bajo lo hecho.
    await tocar(hecho)
    const meta = await esperar(() => {
      const nodo = document.body.querySelector<HTMLElement>('[data-meta-realizado]')
      return nodo && (nodo.textContent ?? '').includes('1 adjunto') ? nodo : null
    }, 'la evidencia en su pantalla')
    expect(meta.textContent).toContain('En el historial')
    expect(textoPantalla()).toContain('Evidencia · 1 adjunto')
  })

  it('un antecedente dice "Según su fuente: marca …" y "Ver fuente", sin darlo por confirmado', async () => {
    await sembrarBase()
    await db.mantenimientos.put({
      ...antecedenteDesdeCronograma('ant-343', {
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
    await montar(RUTAS, '/dispositivos/pc/mantenimientos')
    await esperar(() => textoPantalla().includes('Según Cronograma de prueba 2025, hoja Marzo: marca REALIZADO'), 'la marca de la fuente')
    const tarjeta = control(/Cronograma de prueba 2025/) as HTMLElement
    expect(tarjeta.textContent).toContain('Por validar')
    expect(tarjeta.textContent).toContain('Ver fuente')
    expect(tarjeta.textContent).not.toContain('Realizado y confirmado')
  })

  it('el cierre: tres segmentos, lo que hace el elegido debajo y el aviso de "Qué se hizo" junto a su campo', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'abierto' })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos/abierto')
    await esperar(() => document.body.querySelector('[role="radiogroup"]'), 'las respuestas')
    const respuestas = Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]'))
    // Desde la tarea 345, segmentos sin círculo (DESPUÉS de Claude Design); desde
    // la tarea 352, de 52 y con la forma de una respuesta de la ventana.
    expect(respuestas.map((r) => r.textContent)).toEqual(['Se hizo', 'Se pospone', 'Se cancela'])
    for (const respuesta of respuestas) expect(respuesta.className).toContain('max-md:min-h-[52px]')
    expect(textoPantalla()).toContain('Queda en el historial del equipo')
    await tocar(opcion('Se pospone'))
    expect(textoPantalla()).toContain('Sigue pendiente, con otra fecha')
    expect(textoPantalla()).not.toContain('Queda en el historial del equipo')
    await tocar(opcion('Se hizo'))

    const queSeHizo = campoDe('Qué se hizo y cómo quedó')
    expect(queSeHizo.getAttribute('placeholder')).toBe('Ej.: limpieza interna, cambio de cable de red')
    await tocar(control(GUARDAR) as HTMLElement)
    const aviso = await esperar(
      () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="alert"]')).find((a) => a.textContent === 'Di qué se hizo y cómo quedó.'),
      'el aviso en línea',
    )
    // Junto a su campo, con su borde en rojo, y una sola vez.
    expect(queSeHizo.getAttribute('aria-invalid')).toBe('true')
    expect(queSeHizo.getAttribute('aria-describedby')).toBe(aviso.id)
    expect(queSeHizo.className).toContain('max-md:border-noct-error')
    expect(document.body.querySelectorAll('[role="alert"]').length).toBe(1)
    expect(await db.mantenimientos.get('abierto')).toMatchObject({ estado: 'programado' })
  })
})

// TAREA 345: EL MANTENIMIENTO EN EL TELÉFONO, FIEL AL DESPUÉS DE CLAUDE
// DESIGN. Solo presentación: lo que se guarda y cómo no cambia. Todo inventado.
describe('el mantenimiento en el teléfono (tarea 345)', () => {
  type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
  const ventana = window as unknown as VentanaDePrueba

  afterEach(() => {
    ventana.happyDOM.setViewport({ width: 375, height: 812 })
  })

  it('dice qué hay que hacer, la última vez (confirmada) y lo que anota una fuente (por validar)', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'abierto', fechaProgramada: fechaRelativa(-2), observaciones: 'Limpiar el equipo de prueba' })
    await sembrarMantenimiento({
      id: 'antes',
      estado: 'realizado',
      fechaRealizada: '2026-07-15',
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza general de prueba',
    })
    await sembrarMantenimiento({
      id: 'ant',
      fechaProgramada: '2026-03-10',
      validacion: 'documentado_por_validar',
      fuente: 'Planilla de prueba',
      observaciones: 'Estado marcado en la fuente: REALIZADO.',
    })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos/abierto')
    const contexto = await esperar(
      () => document.body.querySelector<HTMLElement>('[data-contexto-mantenimiento]'),
      'la tarjeta de contexto',
    )
    const texto = contexto.textContent ?? ''
    expect(texto).toContain('Qué hay que hacer')
    expect(texto).toContain('Limpiar el equipo de prueba')
    expect(texto).toContain('La última vez')
    expect(texto).toContain('Confirmado')
    expect(texto).toContain('15 jul 2026, Técnico de prueba. Limpieza general de prueba')
    const documentado = contexto.querySelector<HTMLElement>('[data-documentado]')
    expect(documentado?.textContent).toContain('Por validar')
    expect(documentado?.textContent).toContain('Según Planilla de prueba: marca REALIZADO el 10 mar 2026. No cuenta como hecho.')
    expect(documentado?.querySelector('a')?.getAttribute('href')).toBe('/dispositivos/pc/mantenimientos/ant')
    // El estado, en su pastilla de error con el día que tocaba.
    const atrasado = Array.from(document.body.querySelectorAll<HTMLElement>('span')).find((s) =>
      (s.textContent ?? '').startsWith('Atrasado 2 días · tocaba el'),
    )
    expect(atrasado?.querySelector('[data-punto-estado]')).not.toBeNull()
    expect(atrasado?.className).toContain('text-noct-error')
  })

  it('sin un cierre anterior lo dice, sin inventar ninguno', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'abierto' })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos/abierto')
    const contexto = await esperar(
      () => document.body.querySelector<HTMLElement>('[data-contexto-mantenimiento]'),
      'la tarjeta de contexto',
    )
    expect(contexto.textContent).toContain('Todavía no hay uno cerrado en la app para este equipo.')
    expect(contexto.textContent).not.toContain('Confirmado')
    expect(contexto.querySelector('[data-documentado]')).toBeNull()
  })

  it('el registro va fijo abajo, dice la evidencia como es y guarda lo de siempre', async () => {
    await sembrarBase()
    await sembrarMantenimiento({ id: 'abierto' })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos/abierto')
    const guardar = await esperar(() => control(GUARDAR), 'el registro')
    expect(guardar.parentElement?.className).toContain('sticky')
    expect(document.body.querySelector('[data-evidencia-al-guardar]')?.textContent).toContain('se adjuntan después de guardar')
    // Sin "Cambiar", no hay campos de fecha ni de quién.
    await esperar(() => (document.body.querySelector('[data-quien-y-cuando]')?.textContent ?? '').includes('lo hiciste tú'), 'cuándo y quién')
    expect(() => campoDe('Fecha en que se hizo')).toThrow()
    await rellenar(campoDe('Qué se hizo y cómo quedó'), 'Limpieza de prueba')
    await tocar(guardar)
    await esperarQue(async () => (await db.mantenimientos.get('abierto'))?.estado === 'realizado', 'se cierra')
    expect(await db.mantenimientos.get('abierto')).toMatchObject({
      fechaRealizada: fechaRelativa(0),
      tecnico: PERFIL_PRUEBA.nombre,
      resultado: 'Limpieza de prueba',
    })
  })

  it('a 768 px, el cierre de siempre: opciones con su círculo, los campos a la vista y "Cerrar y registrar en el equipo"', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await sembrarBase()
    await sembrarMantenimiento({ id: 'abierto', observaciones: 'Limpiar el equipo de prueba' })
    await montar(RUTAS, '/dispositivos/pc/mantenimientos/abierto')
    await esperar(() => control('Cerrar y registrar en el equipo'), 'el cierre de siempre')
    expect(control(GUARDAR)).toBeNull()
    expect(document.body.querySelector('[data-contexto-mantenimiento]')).toBeNull()
    expect(document.body.querySelector('[data-quien-y-cuando]')).toBeNull()
    expect(document.body.querySelector('[data-evidencia-al-guardar]')).toBeNull()
    expect(campoDe('Fecha en que se hizo').value).toBe(fechaRelativa(0))
    for (const respuesta of document.body.querySelectorAll<HTMLElement>('[role="radio"]')) {
      expect(respuesta.className).not.toContain('max-md:min-h-12')
      expect(respuesta.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
    }
    expect(textoPantalla()).toContain('Limpiar el equipo de prueba')
  })
})
