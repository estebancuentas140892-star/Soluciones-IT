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
import { bloquear } from '../boveda/sesionBoveda'
import { GuiaPage } from './GuiaPage'

// LOS REMATES DE LA EJECUCIÓN EN EL TELÉFONO (tarea 343, handoff móvil "1b
// Pulgar"). Solo presentación: el contador en su caja de 40, el índice
// "Pasos" con el número en IBM Plex Mono en filas de 58, "Tengo un problema"
// en la hoja de siempre con las mismas salidas, y la hoja de la credencial con
// "Sin salir de la guía" y "Desbloquear" como la acción rellena. La
// navegación, las salidas y la Bóveda no cambian. Todo es inventado.

const RUTAS = [{ ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> }]
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

describe('el contador y el índice "Pasos"', () => {
  it('el contador mide 40 en el teléfono y el índice tiene la anatomía del handoff, sin cambiar a dónde lleva', async () => {
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    const contador = await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/)
    expect(contador.firstElementChild?.className).toContain('max-md:min-h-10')
    expect(contador.textContent).toContain('1/2')

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
  it('su hoja dice "Sin salir de la guía" y "Desbloquear" es la rellena a todo el ancho, sin enseñar nada protegido', async () => {
    await montar(RUTAS, RUTA)
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
