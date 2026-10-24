// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BloquePaso, OpcionDecision } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  ponerAncho,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { ArticuloPage } from './ArticuloPage'
import { GuiaPage } from './GuiaPage'

// LA SEGUNDA PASADA DE FIDELIDAD AL PROTOTIPO EN LA GUÍA (tarea 351, AD-094),
// con la pantalla de verdad en el teléfono y la ejecución por ventanas:
//
//   - sin pantallas previas (propuesta B, aprobada el 2026-10-23): la guía se
//     abre en la ventana 1 con «Antes de empezar» encima, y la orientación
//     se lee en «Detalles»; la acción a la vez conserva sus dos pantallas;
//   - la línea bajo el título («Ventana 1 de 2», «Antes de empezar») va DENTRO
//     de la fila de la cabecera, junto al título, no en una fila aparte;
//   - con caminos de distinto largo, cuántas ventanas como poco y como mucho;
//   - el cierre vuelve con el botón de 44 junto a la pregunta.
// Desde 768 px la cabecera de siempre no tiene esa línea.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <ArticuloPage comoDetalles /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

function decision(id: string, texto: string, opciones: OpcionDecision[]): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto, tipoTarea: 'decision', opciones }
}

/** La línea bajo el título de la cabecera, si está dentro de la fila del título. */
function lineaEnElTitulo(): string | null {
  const titulo = document.body.querySelector('h1')
  return titulo?.parentElement?.querySelector('[data-paso-en-cabecera]')?.textContent ?? null
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

async function sembrarGuiaDos(): Promise<void> {
  await sembrarGuia({
    id: 'guia-dos',
    titulo: 'Guía de dos ventanas de prueba',
    pasos: [
      pasoPrueba('d-p1', 'Abrir la ventana de prueba', ['Abrir el programa de prueba']),
      pasoPrueba('d-p2', 'Cerrar la ventana de prueba', ['Cerrar el programa de prueba']),
    ],
    procedimiento: {
      descripcion: 'Usa esta guía cuando hay que probar dos ventanas.',
      objetivoGeneral: 'Dejar probadas las dos ventanas.',
      requisitos: ['Acceso de prueba', 'acceso de prueba.'],
    },
  })
}

describe('sin pantallas previas en la ventana del teléfono (propuesta B, tarea 351)', () => {
  it('abrir la guía es estar en la ventana 1, con «Antes de empezar» encima y sin orientación', async () => {
    await sembrarGuiaDos()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-dos', { ventanaPorDefecto: true })

    await esperar(() => (textoPantalla().includes('Abrir el programa de prueba') ? true : null), 'la ventana 1')
    expect(lineaEnElTitulo()).toBe('Ventana 1 de 2')
    const texto = textoPantalla()
    expect(texto).not.toContain('Qué vas a hacer')
    expect(control('Ver lo que necesitas')).toBeNull()
    expect(control('Todo listo, empezar')).toBeNull()
    // Los requisitos de la guía, sin repetidos, en la tarjeta de encima de la
    // ventana (fuera de su marco), como el prototipo.
    const tarjeta = document.body.querySelector('[data-antes-de-empezar]')
    expect(tarjeta?.textContent).toContain('Acceso de prueba')
    expect(tarjeta?.querySelectorAll('li')).toHaveLength(1)
    expect(tarjeta?.closest('[data-marco-ventana]')).toBeNull()
    expect(tarjeta?.compareDocumentPosition(document.body.querySelector('[data-marco-ventana]')!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )

    // Hecha la ventana 1, la tarjeta ya no vuelve: el trabajo empezó.
    await tocar(await esperarControl(/^Listo/))
    await esperar(() => (textoPantalla().includes('Cerrar el programa de prueba') ? true : null), 'la ventana 2')
    expect(document.body.querySelector('[data-antes-de-empezar]')).toBeNull()
  })

  it('la acción a la vez del teléfono conserva sus dos pantallas', async () => {
    await sembrarGuiaDos()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-dos')

    await esperar(() => (textoPantalla().includes('Qué vas a hacer') ? true : null), 'la orientación')
    expect(lineaEnElTitulo()).toBe('Antes de empezar')
    await tocar(await esperarControl('Ver lo que necesitas'))
    expect(textoPantalla()).toContain('Ten esto listo antes de la primera acción.')
  })

  it('en «Detalles» del teléfono, la orientación: «Cuándo usarla» con su rótulo y el objetivo', async () => {
    await sembrarGuiaDos()
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-dos/detalles')

    await esperar(() => (textoPantalla().includes('Dejar probadas las dos ventanas.') ? true : null), 'los detalles')
    const texto = textoPantalla()
    expect(texto.toLowerCase()).toContain('cuándo usarla')
    // Sin la fórmula «Usa esta guía», como la decía «Qué vas a hacer».
    expect(texto).toContain('Cuando hay que probar dos ventanas.')
    expect(texto).not.toContain('Usa esta guía cuando')
  })
})

describe('la cabecera de la guía en el teléfono (tarea 351)', () => {

  it('con caminos de distinto largo dice cuántas ventanas como poco y como mucho', async () => {
    const primero = pasoPrueba('c-p1', 'Elegir el camino de prueba', ['Mirar el equipo de prueba'])
    primero.bloques.push(
      decision('c-camino', '¿Qué camino de prueba sigues?', [
        { id: 'c-corto', titulo: 'Corto', descripcion: '', destino: { tipo: 'paso', pasoId: 'c-p3' } },
        { id: 'c-largo', titulo: 'Largo', descripcion: '', destino: { tipo: 'paso', pasoId: 'c-p2' } },
      ]),
    )
    await sembrarGuia({
      id: 'guia-caminos',
      titulo: 'Guía de caminos de prueba',
      pasos: [
        primero,
        pasoPrueba('c-p2', 'Paso solo del camino largo', ['Hacer lo del camino largo']),
        pasoPrueba('c-p3', 'Paso común de prueba', ['Hacer lo común']),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-caminos', { ventanaPorDefecto: true })

    await esperar(() => (textoPantalla().includes('Mirar el equipo de prueba') ? true : null), 'la ventana 1')
    // Corto: 1 y 3; largo: 1, 2 y 3.
    expect(lineaEnElTitulo()).toBe('Ventana 1 de 2 · hasta 3 si hace falta')
  })

  it('el cierre vuelve a la última ventana con el botón junto a la pregunta', async () => {
    await sembrarGuia({
      id: 'guia-cierre',
      titulo: 'Guía con cierre de prueba',
      pasos: [pasoPrueba('f-p1', 'Única ventana de prueba', ['Hacer lo único'])],
      procedimiento: { verificacionFinal: ['El equipo de prueba quedó bien'] },
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-cierre', { ventanaPorDefecto: true })

    await tocar(await esperarControl(/^Listo/))
    await esperar(() => (textoPantalla().includes('¿El problema quedó resuelto?') ? true : null), 'el cierre')
    expect(lineaEnElTitulo()).toBe('Comprobación final')
    // Ya no hay un botón «Última ventana» a lo ancho: volver es el de 44 junto a la pregunta.
    expect(control(/^Última ventana/)).toBeNull()
    const volver = await esperarControl(/^Anterior\. Vuelve a la última ventana/)
    expect(volver.parentElement?.textContent).toContain('¿El problema quedó resuelto?')
    await tocar(volver)
    await esperar(() => (textoPantalla().includes('Hacer lo único') ? true : null), 'de vuelta en la ventana')
  })

  it('desde 768 px la cabecera no lleva esa línea junto al título', async () => {
    ponerAncho('tableta')
    await sembrarGuia({
      id: 'guia-tableta',
      titulo: 'Guía de tableta de prueba',
      pasos: [pasoPrueba('t-p1', 'Ventana de tableta', ['Hacer lo de tableta']), pasoPrueba('t-p2', 'Otra de tableta', ['Hacer lo otro'])],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-tableta', { ventanaPorDefecto: true })
    await esperar(() => (textoPantalla().includes('Hacer lo de tableta') ? true : null), 'el paso 1')
    expect(lineaEnElTitulo()).toBeNull()
  })
})
