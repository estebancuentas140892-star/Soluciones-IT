// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PasoProcedimiento } from '../../lib/db'
import {
  abrirCredencial,
  anclarMaestra,
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarCredencial,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { CredencialEnHoja } from '../boveda/CredencialEnHoja'
import { bloquear } from '../boveda/sesionBoveda'
import { GuiaPage } from './GuiaPage'

// LOS REMATES DE LA EJECUCIÓN EN EL TELÉFONO (tarea 343, handoff móvil "1b
// Pulgar"). Solo presentación: el contador en su caja de 40, el índice
// "Pasos" con el número en IBM Plex Mono en filas de 58, "Tengo un problema"
// en la hoja de siempre con las mismas salidas, y la hoja de la credencial con
// "Sin salir de la guía" y "Desbloquear" como la acción rellena. La
// navegación, las salidas y la Bóveda no cambian. Todo es inventado.

const RUTAS = [{ ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> }]
// La hoja de la credencial, sola: en el teléfono ya no la abre la acción a la
// vez (tarea 355), pero sigue en el paso entero de la ventana.
const RUTAS_HOJA = [
  {
    ruta: '/hoja',
    elemento: (
      <>
        <p>LO QUE HABÍA DEBAJO</p>
        <CredencialEnHoja vinculo={{ tipo: 'credencial', id: 'cred-remate', titulo: 'Copia de referencia del panel' }} />
      </>
    ),
  },
]
const RUTA = '/soluciones/cat-pruebas/guia-remate'
const ACCION = 'Abre el panel de prueba'

function pasoConCredencial(): PasoProcedimiento {
  const paso = pasoPrueba('rm-p1', 'Abrir el panel de prueba', [ACCION, 'Revisa el panel de prueba'])
  paso.bloques[0] = {
    ...paso.bloques[0],
    vinculoProtegido: { tipo: 'credencial', id: 'cred-remate', titulo: 'Copia de referencia del panel' },
  }
  return paso
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await anclarMaestra()
  await sembrarCredencial({
    id: 'cred-remate',
    titulo: 'Acceso de prueba al panel',
    tipo: 'cuenta',
    usuario: 'usuario.falso.remate',
    contrasena: 'Clave-Falsa-Remate-1',
  })
  bloquear()
  await sembrarGuia({
    id: 'guia-remate',
    titulo: 'Revisar un panel de prueba',
    pasos: [pasoConCredencial(), pasoPrueba('rm-p2', 'Cerrar el panel de prueba', ['Cierra el panel de prueba'])],
  })
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

describe('el contador y el índice', () => {
  it('en el teléfono el contador dice "Índice", el paso y la acción van en la cabecera y el índice tiene la anatomía del handoff', async () => {
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    // Desde la tarea 350 (prototipo de Claude Design; «Pasos» desde la 345):
    // «Índice» sobre la superficie 2 abre el mismo índice, con el mismo
    // nombre accesible. La fila dice la guía y, debajo, el paso.
    const contador = await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/)
    expect(contador.textContent).toBe('Índice')
    expect(contador.className).toContain('h-11')
    expect(contador.className).toContain('bg-noct-neutral-900')
    expect(Array.from(document.body.querySelectorAll('h1')).some((h) => h.textContent === 'Revisar un panel de prueba')).toBe(true)
    // Desde la tarea 355, «Paso 1 de 2 · acción 1 de 2»: baja de línea solo
    // entre sus partes (sus espacios de dentro no parten la línea).
    const enCabecera = document.body.querySelector<HTMLElement>('[data-paso-en-cabecera]')
    expect(enCabecera?.textContent?.replace(/\u00a0/g, ' ')).toBe('Paso 1 de 2 · acción 1 de 2')

    await tocar(contador)
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'el índice')
    const filas = Array.from(hoja.querySelectorAll<HTMLElement>('ol button'))
    expect(filas).toHaveLength(2)
    for (const fila of filas) expect(fila.className).toContain('max-md:min-h-[58px]')
    // El número en su caja mono de 28; el paso de trabajo lo dice con su palabra.
    const numero = filas[0].firstElementChild as HTMLElement
    expect(numero.className).toContain('max-md:font-mono')
    expect(numero.className).toContain('max-md:h-7')
    expect(numero.textContent).toBe('1')
    expect(filas[0].getAttribute('aria-current')).toBe('step')
    expect(filas[0].textContent).toContain('Aquí vas')

    // Ir a un paso sigue siendo lo mismo.
    await tocar(filas[1])
    await esperar(() => textoPantalla().includes('Cierra el panel de prueba'), 'el paso 2')
  })
})

describe('"Tengo un problema"', () => {
  it('en el teléfono abre la hoja de siempre con las mismas salidas, en filas de 62', async () => {
    await montar(RUTAS, RUTA)
    await tocar(await esperarControl('Tengo un problema con esta acción: ver las salidas'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    expect(hoja.querySelector('h2')?.textContent).toBe('Tengo un problema')
    expect(hoja.textContent).toContain('Algo va mal en el paso 1')
    expect(hoja.textContent).toContain(`En «${ACCION}».`)
    const detenerse = control('Detenerme aquí y dejarlo anotadoNo avanza ni marca nada. Vuelves a este mismo paso con la falla señalada')
    expect(detenerse?.className).toContain('min-h-[62px]')
    expect(control(/^Seguir con el paso siguiente/)).not.toBeNull()
    expect(control('Cancelar')).not.toBeNull()
    // La X de la hoja la cierra, como Cancelar.
    await tocar(control('Cerrar') as HTMLElement)
    await esperar(() => document.body.querySelector('[role="dialog"]') === null, 'la hoja cerrada')
  })
})

describe('la credencial en la guía', () => {
  // Desde la tarea 355 la acción a la vez del teléfono la lleva en línea (regla
  // 29); la hoja sigue en tableta y escritorio, y dentro del paso entero de la
  // ventana. Aquí se monta sola, en el teléfono.
  it('en la acción a la vez del teléfono va en línea: con su rótulo, sin hoja y sin enseñar nada protegido', async () => {
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    expect(control(/^Ver la credencial: /)).toBeNull()
    expect(textoPantalla()).toContain('Credencial necesaria')
    expect(control('Dato protegido: Acceso de prueba al panel')).not.toBeNull()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.innerHTML).not.toContain('usuario.falso.remate')
  })

  it('su hoja dice "Sin salir de la guía" y "Desbloquear" es la rellena a todo el ancho, sin enseñar nada protegido', async () => {
    await montar(RUTAS_HOJA, '/hoja')
    await abrirCredencial('Acceso de prueba al panel')
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    expect(hoja.textContent).toContain('Sin salir de la guía')
    await tocar(await esperarControl('Dato protegido: Acceso de prueba al panel'))
    await esperar(() => document.body.querySelector('input[placeholder="Contraseña maestra"]'), 'el desbloqueo')
    const desbloquear = control('Desbloquear') as HTMLElement
    expect(desbloquear.className).toContain('bg-noct-accent')
    expect(desbloquear.className).toContain('min-h-[54px]')
    expect(desbloquear.className).toContain('w-full')
    expect(desbloquear.parentElement?.className).toContain('max-md:flex-col')
    expect(document.body.innerHTML).not.toContain('usuario.falso.remate')
  })
})

// TAREA 345: LA EJECUCIÓN EN EL TELÉFONO, FIEL AL DESPUÉS DE CLAUDE DESIGN.
// Solo presentación: la cabecera con "Salir" y el paso entero, "Pasos", el
// botón que dice a dónde lleva y la hoja de la credencial que lo dice en voz
// alta. Lo que hace cada control no cambia. Desde 768, como estaba.
describe('la guía en el teléfono (tarea 345)', () => {
  type VentanaDePrueba = { happyDOM: { setViewport: (vista: { width: number; height: number }) => void } }
  const ventana = window as unknown as VentanaDePrueba

  afterEach(() => {
    ventana.happyDOM.setViewport({ width: 375, height: 812 })
  })

  it('la cabecera lleva la X y el nombre de la guía a la vista, y el botón dice a dónde lleva', async () => {
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    // Desde la tarea 350 (prototipo de Claude Design): la X sola, con su
    // nombre accesible, y el nombre de la guía a la vista, que sigue siendo
    // el encabezado de la página; con su texto entero en el título.
    expect(control('Salir de la guía')).not.toBeNull()
    expect(textoPantalla()).not.toContain('Tu avance se guarda solo')
    const encabezado = Array.from(document.body.querySelectorAll('h1')).find((h) => h.textContent === 'Revisar un panel de prueba')
    expect(encabezado?.className).not.toContain('sr-only')
    expect(encabezado?.getAttribute('title')).toBe('Revisar un panel de prueba')
    // Desde la tarea 355, «Listo · Siguiente» en cada acción y, en la última de
    // la guía, «Listo · Terminar guía». La cabecera dice el paso y la acción.
    await tocar(await esperarControl('Listo · Siguiente'))
    await esperar(() => textoPantalla().includes('Revisa el panel de prueba'), 'la segunda acción')
    await tocar(await esperarControl('Listo · Siguiente'))
    await esperar(() => textoPantalla().includes('Cierra el panel de prueba'), 'el paso 2')
    expect(document.body.querySelector('[data-paso-en-cabecera]')?.textContent?.replace(/\u00a0/g, ' ')).toBe('Paso 2 de 2')
    expect(control('Listo · Terminar guía')).not.toBeNull()
  })

  it('la hoja de la credencial dice que no se sale de la guía y "Volver a la guía" la cierra donde estaba', async () => {
    await montar(RUTAS_HOJA, '/hoja')
    await abrirCredencial('Acceso de prueba al panel')
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'la hoja')
    expect(hoja.querySelector('[data-sin-salir-de-la-guia]')?.textContent).toContain('Tu paso sigue debajo, como lo dejaste.')
    await tocar(control('Volver a la guía') as HTMLElement)
    await esperar(() => document.body.querySelector('[role="dialog"]') === null, 'la hoja cerrada')
    expect(textoPantalla()).toContain('LO QUE HABÍA DEBAJO')
    expect(document.body.innerHTML).not.toContain('usuario.falso.remate')
  })

  it('desde 768, la cabecera, el contador y el botón de siempre', async () => {
    ventana.happyDOM.setViewport({ width: 768, height: 1024 })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    const contador = await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/)
    expect(contador.textContent).toContain('1/2')
    expect(document.body.querySelector('[data-paso-en-cabecera]')).toBeNull()
    expect(textoPantalla()).not.toContain('Tu avance se guarda solo')
    expect(control('Completar y seguir')).not.toBeNull()
    expect(control('Hecho, siguiente acción')).toBeNull()
  })
})
