// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  control,
  desmontarTodo,
  esperar,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  pausa,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// REGISTRAR LA INTERVENCIÓN AL TERMINAR (recomendación RP-1, tarea 335).
// Una guía ejecutada con un equipo termina ofreciendo dejarlo en su
// historial, con el texto ya escrito; nada se escribe sin que el técnico
// lo guarde, y sin equipo no se ofrece. Todo lo sembrado es inventado.

const RUTA = '/soluciones/cat-pruebas/guia-imp'
const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
]

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await sembrarGuia({ id: 'guia-imp', titulo: 'Limpiar el cabezal de prueba', pasos: [pasoPrueba('imp-p1', 'Limpiar', ['Pasar el paño'])] })
  await sembrarEquipo({ id: 'imp-1', nombre: 'IMPRESORA-PRUEBA-1' })
})

afterEach(async () => {
  await desmontarTodo()
})

async function intervenciones() {
  return (await db.historial.toArray()).filter((e) => e.campo === 'intervencion')
}

async function terminarLaGuia(): Promise<void> {
  await tocar(await esperar(() => control(/^Listo · Terminar guía$/), 'la única acción'))
  await esperar(() => textoPantalla().includes('Guía completada'), 'la guía terminada')
}

/** Escribe en un textarea (el ayudante `escribir` es de inputs). */
async function escribirEn(campo: HTMLTextAreaElement, texto: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await pausa()
}

function campoQueSeHizo(): HTMLTextAreaElement {
  const campo = document.body.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')
  if (!campo) throw new Error('Sin el campo "Qué se hizo"')
  return campo
}

describe('al terminar una guía con un equipo', () => {
  it('ofrece la intervención con el texto escrito y solo escribe al guardar', async () => {
    await montar(RUTAS, `${RUTA}?equipo=imp-1`)
    await terminarLaGuia()

    const registrar = await esperar(() => control('Registrar intervención en IMPRESORA-PRUEBA-1'), 'la oferta')
    // Salir sigue siendo lo principal.
    expect(control('Salir de la guía')).not.toBeNull()
    expect(await intervenciones()).toHaveLength(0)

    await tocar(registrar)
    await esperar(() => document.body.querySelector('[role="dialog"]'), 'la hoja')
    expect(campoQueSeHizo().value).toBe('Se ejecutó la guía «Limpiar el cabezal de prueba».')
    await escribirEn(campoQueSeHizo(), 'Se ejecutó la guía «Limpiar el cabezal de prueba». Queda imprimiendo bien.')
    await tocar(control('Guardar en el historial') as HTMLElement)

    await esperarQue(async () => (await intervenciones()).length === 1, 'la intervención guardada')
    const entrada = (await intervenciones())[0]
    expect(entrada).toMatchObject({
      entidadTipo: 'dispositivo',
      entidadId: 'imp-1',
      valorNuevo: 'Se ejecutó la guía «Limpiar el cabezal de prueba». Queda imprimiendo bien.',
    })
    // Como en la ficha: después, la foto si hace falta, y "Listo".
    await esperar(() => document.body.querySelector('[role="dialog"]')?.textContent?.includes('Quedó en su historial'), 'el aviso')
    const listo = Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"] button')).find(
      (b) => b.textContent?.trim() === 'Listo',
    )
    await tocar(listo as HTMLElement)
    await esperar(() => !document.body.querySelector('[role="dialog"]'), 'la hoja se cierra')
    expect(textoPantalla()).toContain('Registrada en el historial de IMPRESORA-PRUEBA-1')
    expect(control(/^Registrar intervención/)).toBeNull()
  })

  it('sin equipo no se ofrece', async () => {
    await montar(RUTAS, RUTA)
    await terminarLaGuia()
    expect(control('Salir de la guía')).not.toBeNull()
    expect(control(/^Registrar intervención/)).toBeNull()
  })
})
