// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
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
  ubicacionActual,
} from '../../pruebas/montaje'
import { CuentaPage } from '../autenticacion/CuentaPage'
import { EstadosPorUnificarPage } from './EstadosPorUnificarPage'
import { HerramientasInventarioPage } from './HerramientasInventarioPage'

// HERRAMIENTAS DE INVENTARIO, ESTADOS Y AJUSTES, CON LAS PANTALLAS DE
// VERDAD (tarea 268, secciones 9, 18 a 20 del encargo del 2026-09-23).
// La lógica pura de los estados se prueba aparte
// (`estadosEscritos.test.ts`); aquí, lo que solo se ve montando:
//
//   - la puerta de inventario enseña "Por ordenar" solo si hay algo, y
//     cada fila dice cuántos equipos son;
//   - la unificación propone SOLO las equivalencias seguras, no cambia
//     nada sin confirmar y deja el estado anterior en el historial;
//   - Ajustes reúne la cuenta, el bloqueo, el trabajo sin conexión y la
//     actualización, con el cambio de contraseña plegado.
//
// Todo lo que se siembra es INVENTADO.

const RUTAS = [
  { ruta: '/inventario', elemento: <HerramientasInventarioPage /> },
  { ruta: '/inventario/estados', elemento: <EstadosPorUnificarPage /> },
  { ruta: '/cuenta', elemento: <CuentaPage /> },
  { ruta: '/cuenta/seguridad', elemento: <p>SEGURIDAD</p> },
  { ruta: '/ubicaciones/migrar', elemento: <p>MIGRAR UBICACIONES</p> },
  { ruta: '/personas', elemento: <p>PERSONAS</p> },
]

// La fila (enlace) de una pantalla índice cuyo título coincide.
function fila(titulo: string): HTMLElement | null {
  return (
    Array.from(document.body.querySelectorAll<HTMLElement>('main a')).find(
      (enlace) => (enlace.querySelector('.text-\\[15px\\]')?.textContent ?? '').trim() === titulo,
    ) ?? null
  )
}

function titulosDeGrupo(): string[] {
  return Array.from(document.body.querySelectorAll('main h2')).map((h) => (h.textContent ?? '').trim())
}

// El grupo de opciones de un texto de estado.
function opcionesDe(texto: string): HTMLElement {
  const grupo = document.body.querySelector<HTMLElement>(`[role=radiogroup][aria-label="Estado para «${texto}»"]`)
  if (!grupo) throw new Error(`No está el texto «${texto}».`)
  return grupo
}

function opcion(texto: string, estado: string): HTMLElement {
  const boton = Array.from(opcionesDe(texto).querySelectorAll<HTMLElement>('[role=radio]')).find(
    (b) => (b.textContent ?? '').trim() === estado,
  )
  if (!boton) throw new Error(`No está la opción ${estado} de «${texto}».`)
  return boton
}

function elegida(texto: string): string {
  return (opcionesDe(texto).querySelector('[aria-checked=true]')?.textContent ?? '').trim()
}

async function sembrarEstados() {
  await sembrarEquipo({ id: 'caja-1', nombre: 'CAJA-PRUEBA-1', estado: 'OPERATIVO' })
  await sembrarEquipo({ id: 'caja-2', nombre: 'CAJA-PRUEBA-2', estado: 'operativo ' })
  await sembrarEquipo({ id: 'cam-1', nombre: 'CAM-PRUEBA-1', estado: 'Activo' })
  await sembrarEquipo({ id: 'tel-1', nombre: 'TEL-PRUEBA-1', estado: 'Prestado' })
  await sembrarEquipo({ id: 'imp-1', nombre: 'IMP-PRUEBA-1', estado: 'Dado de baja' })
  // Ya en la lista o sin estado: no hay nada que unificar.
  await sembrarEquipo({ id: 'pc-1', nombre: 'PC-PRUEBA-1', estado: 'Operativo' })
  await sembrarEquipo({ id: 'pc-2', nombre: 'PC-PRUEBA-2', estado: '' })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('Herramientas de inventario', () => {
  it('sin nada por ordenar, solo enseña Cargar y etiquetar', async () => {
    await sembrarEquipo({ id: 'pc-1', nombre: 'PC-PRUEBA-1', estado: 'Operativo' })
    await montar(RUTAS, '/inventario')
    await esperar(() => fila('Etiquetas QR'), 'la puerta de inventario')

    expect(titulosDeGrupo()).toEqual(['Cargar y etiquetar'])
    expect(fila('Importar equipos')?.getAttribute('href')).toBe('/dispositivos/importar')
    expect(fila('Etiquetas QR')?.getAttribute('href')).toBe('/dispositivos/etiquetas')
    expect(fila('Estados escritos a mano')).toBeNull()
  })

  it('con datos por ordenar, cada fila dice cuántos equipos son y abre su tarea', async () => {
    await sembrarEquipo({ id: 'pc-1', nombre: 'PC-PRUEBA-1', ubicacion: 'Bodega de prueba' })
    await sembrarEquipo({ id: 'pc-2', nombre: 'PC-PRUEBA-2', estado: 'OPERATIVO' })
    await sembrarEquipo({ id: 'pc-3', nombre: 'PC-PRUEBA-3', estado: 'Activo' })
    await sembrarEquipo({ id: 'pc-4', nombre: 'PC-PRUEBA-4', responsable: 'Area de prueba' })
    await montar(RUTAS, '/inventario')
    const estados = await esperar(() => fila('Estados escritos a mano'), 'la fila de estados')

    expect(titulosDeGrupo()).toEqual(['Cargar y etiquetar', 'Por ordenar'])
    expect(fila('Ubicaciones escritas como texto')?.textContent).toContain('1 lugar por convertir en fichas')
    expect(estados.textContent).toMatch(/2$/)
    expect(fila('Responsables por validar')?.getAttribute('href')).toBe('/personas?porValidar=1')

    await tocar(estados)
    expect(ubicacionActual().pathname).toBe('/inventario/estados')
  })
})

describe('estados escritos a mano', () => {
  it('propone solo las equivalencias seguras; lo demás, dejarlo como está', async () => {
    await sembrarEstados()
    await montar(RUTAS, '/inventario/estados')
    await esperar(() => textoPantalla().includes('«Prestado»'), 'la lista de textos')

    const texto = textoPantalla()
    // Mayúsculas y espacios: un solo grupo, con sus dos formas.
    expect(texto).toContain('2 equipos · incluye «OPERATIVO» y «operativo»')
    expect(texto).toContain('Es «Operativo» escrito de otra forma.')
    expect(texto).toContain('Es «De baja» escrito de otra forma.')
    // Lo que solo PARECE un estado se dice, pero no se elige solo.
    expect(texto).toContain('Por validar: ¿qué estado es? Parece «Operativo».')
    expect(elegida('OPERATIVO')).toBe('Operativo')
    expect(elegida('Dado de baja')).toBe('De baja')
    expect(elegida('Activo')).toBe('Dejar como está')
    expect(elegida('Prestado')).toBe('Dejar como está')
    // Ni el que ya está en la lista ni el vacío entran.
    expect(document.body.querySelectorAll('[role=radiogroup]')).toHaveLength(4)
    expect(texto).toContain('Se cambiarán 3 equipos. El estado anterior queda en su historial.')
  })

  it('unifica lo elegido, deja el resto y guarda el estado anterior en el historial', async () => {
    await sembrarEstados()
    await montar(RUTAS, '/inventario/estados')
    await esperar(() => textoPantalla().includes('«Activo»'), 'la lista de textos')

    // "Activo" pasa a Operativo porque el técnico lo elige; "Dado de baja"
    // se deja como está aunque viniera propuesto.
    await tocar(opcion('Activo', 'Operativo'))
    await esperar(() => textoPantalla().includes('Se cambiarán 4 equipos'), 'el plan suma lo elegido')
    await tocar(opcion('Dado de baja', 'Dejar como está'))
    await esperar(() => textoPantalla().includes('Se cambiarán 3 equipos'), 'el plan resta lo que se deja')
    await tocar(await esperar(() => control('Unificar estados'), 'el botón de unificar'))
    await esperar(() => textoPantalla().includes('Se unificaron 3 equipos.'), 'el aviso de lo hecho')

    const estado = async (id: string) => (await db.dispositivos.get(id))?.estado
    expect(await estado('caja-1')).toBe('Operativo')
    expect(await estado('caja-2')).toBe('Operativo')
    expect(await estado('cam-1')).toBe('Operativo')
    expect(await estado('imp-1')).toBe('Dado de baja')
    expect(await estado('tel-1')).toBe('Prestado')
    expect(await estado('pc-2')).toBe('')

    const historial = await db.historial.where('[entidadTipo+entidadId]').equals(['dispositivo', 'caja-2']).toArray()
    expect(historial).toEqual([
      expect.objectContaining({ campo: 'estado', valorAnterior: 'operativo ', valorNuevo: 'Operativo', motivo: 'Unificación de estados' }),
    ])
    // Cada cambio entra a la cola de sincronización, uno por equipo.
    const cola = await db.cambiosPendientes.where('tabla').equals('dispositivos').toArray()
    expect(cola.map((c) => c.entidadId).sort()).toEqual(['caja-1', 'caja-2', 'cam-1'])
    // Lo que queda sigue en la lista, como se dejó: lo marcado "Dejar como
    // está" no vuelve a salir propuesto.
    expect(elegida('Dado de baja')).toBe('Dejar como está')
    expect(elegida('Prestado')).toBe('Dejar como está')
    expect(textoPantalla()).toContain('Nada que cambiar con lo elegido.')
    expect(document.body.querySelector('[role=radiogroup][aria-label="Estado para «Activo»"]')).toBeNull()
  })

  it('sin nada que unificar, vuelve a Herramientas de inventario', async () => {
    await sembrarEquipo({ id: 'pc-1', nombre: 'PC-PRUEBA-1', estado: 'Operativo' })
    await montar(RUTAS, '/inventario/estados')
    await esperarQue(async () => ubicacionActual().pathname === '/inventario', 'vuelve a la puerta')
  })
})

describe('Ajustes', () => {
  it('reúne cuenta, bloqueo, sin conexión y actualización, con la contraseña plegada', async () => {
    await montar(RUTAS, '/cuenta')
    await esperar(() => textoPantalla().includes('Bloqueo y seguridad'), 'la pantalla de Ajustes')

    expect(document.body.querySelector('h1')?.textContent).toBe('Ajustes')
    const texto = textoPantalla()
    for (const parte of ['Cuenta', 'Este teléfono', 'Aplicación']) {
      expect(texto.toUpperCase()).toContain(parte.toUpperCase())
    }
    expect(texto).toContain('Descargar todo para offline')
    expect(texto).toContain('Buscar actualización')
    expect(texto).toContain('Sin bloqueo: cualquiera que tome el teléfono entra a la app.')
    expect(control('Cerrar sesión')).not.toBeNull()

    // El formulario de la contraseña no está hasta que se pide.
    expect(document.body.querySelector('form')).toBeNull()
    const plegado = await esperar(() => control('Cambiar contraseña de inicio de sesión'), 'el plegado')
    expect(plegado.getAttribute('aria-expanded')).toBe('false')
    await tocar(plegado)
    expect(plegado.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.querySelectorAll('form input')).toHaveLength(3)

    await tocar(await esperar(() => fila('Bloqueo y seguridad') ?? control(/^Bloqueo y seguridad/), 'la fila de bloqueo'))
    expect(ubicacionActual().pathname).toBe('/cuenta/seguridad')
  })
})
