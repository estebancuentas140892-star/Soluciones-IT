// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BloquePaso, Procedimiento, TonoAviso } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  ponerAncho,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
} from '../../pruebas/montaje'
import { ArticuloPage } from './ArticuloPage'
import { GuiaPage } from './GuiaPage'
import { notasDeLaGuia } from './notasGuia'

// LAS NOTAS Y LOS CONSEJOS, BAJO DEMANDA (tarea 354): se leen en «Detalles»
// del teléfono, por ventana; la ventana sigue sin enseñarlos (tarea 307).
// Todo lo sembrado es inventado.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <ArticuloPage comoDetalles /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

function aviso(id: string, tono: TonoAviso | null, texto: string): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', tono, texto }
}

function guiaConNotas() {
  const uno = pasoPrueba('n-p1', 'Abrir el panel de prueba', ['Abre el panel de prueba'])
  uno.bloques.push(
    aviso('n-info', 'info', 'El panel de prueba tarda unos segundos en abrir.'),
    aviso('n-riesgo', 'precaucion', 'No cierres la ventana de prueba.'),
    aviso('n-vacio', 'consejo', '   '),
  )
  const dos = pasoPrueba('n-p2', 'Guardar el dato de prueba', ['Guarda el dato de prueba'])
  const tres = pasoPrueba('n-p3', 'Comprobar el dato de prueba', ['Mira el dato de prueba'])
  tres.bloques.push(aviso('n-consejo', 'consejo', 'Si no aparece, recarga la lista de prueba.'), aviso('n-sin-tono', null, 'Nota heredada de prueba.'))
  return [uno, dos, tres]
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
  ponerAncho('telefono')
})

describe('notasDeLaGuia', () => {
  it('reúne información y consejo (y un aviso sin tono) por ventana, sin riesgos ni vacíos', () => {
    const procedimiento = { pasos: guiaConNotas() } as unknown as Procedimiento
    expect(notasDeLaGuia(procedimiento)).toEqual([
      { numero: 1, titulo: 'Abrir el panel de prueba', notas: [{ id: 'n-info', tono: 'info', texto: 'El panel de prueba tarda unos segundos en abrir.' }] },
      {
        numero: 3,
        titulo: 'Comprobar el dato de prueba',
        notas: [
          { id: 'n-consejo', tono: 'consejo', texto: 'Si no aparece, recarga la lista de prueba.' },
          { id: 'n-sin-tono', tono: 'info', texto: 'Nota heredada de prueba.' },
        ],
      },
    ])
  })

  it('sin procedimiento, nada', () => {
    expect(notasDeLaGuia(null)).toEqual([])
  })
})

describe('«Notas de la guía» en Detalles', () => {
  it('en el teléfono, por ventana y con su palabra', async () => {
    await sembrarGuia({ id: 'guia-notas', titulo: 'Guía de prueba con notas', pasos: guiaConNotas() })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-notas/detalles')
    const notas = await esperar(() => document.body.querySelector<HTMLElement>('[data-notas-guia]'), 'las notas')
    const texto = notas.textContent ?? ''
    expect(texto).toContain('Ventana 1 · Abrir el panel de prueba')
    expect(texto).toContain('Información. El panel de prueba tarda unos segundos en abrir.')
    expect(texto).toContain('Ventana 3 · Comprobar el dato de prueba')
    expect(texto).toContain('Consejo. Si no aparece, recarga la lista de prueba.')
    // Los riesgos van en su ventana, no aquí; y la ventana 2 no tiene notas.
    expect(texto).not.toContain('No cierres la ventana de prueba.')
    expect(texto).not.toContain('Ventana 2')
  })

  it('desde 768 px, Detalles no cambia', async () => {
    ponerAncho('tableta')
    await sembrarGuia({ id: 'guia-notas', titulo: 'Guía de prueba con notas', pasos: guiaConNotas() })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-notas/detalles')
    await esperar(() => (textoPantalla().includes('Guía de prueba con notas') ? true : null), 'los detalles')
    expect(document.body.querySelector('[data-notas-guia]')).toBeNull()
  })

  it('la ventana sigue sin enseñarlas', async () => {
    await sembrarGuia({ id: 'guia-notas', titulo: 'Guía de prueba con notas', pasos: guiaConNotas() })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-notas', { modo: 'ventana' })
    await esperar(() => document.body.querySelector('[data-pie-ventana]'), 'la ventana 1')
    expect(textoPantalla()).toContain('No cierres la ventana de prueba.')
    expect(textoPantalla()).not.toContain('El panel de prueba tarda unos segundos en abrir.')
  })
})
