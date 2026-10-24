// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// EL CIERRE DE LA GUÍA EN EL TELÉFONO, PROPUESTAS A1 Y A2 (aprobadas por el
// usuario el 2026-10-23, tarea 352; regla 28).
//
//   - A1: las comprobaciones en la lista del prototipo, una tarjeta con su
//     círculo por fila, que se marca y se desmarca como siempre;
//   - A2: «Sí, quedó resuelto» siempre disponible. Con todo marcado termina;
//     con algo sin marcar, pregunta «¿Comprobaste esto en el equipo?» con lo
//     que falta nombrado, y solo al confirmarlo lo marca y termina.
//     «Revisarlas» vuelve sin marcar nada.
//
// Todo lo sembrado es inventado.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <p>DETALLES DE LA GUÍA</p> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
  { ruta: '/', elemento: <p>RESOLVER</p> },
]

const COMPROBACIONES = ['La caja de prueba muestra el dato nuevo', 'El panel de prueba responde', 'El registro de prueba queda guardado']

async function sembrar(): Promise<void> {
  await sembrarGuia({
    id: 'guia-cierre',
    titulo: 'Guía de prueba con cierre',
    pasos: [pasoPrueba('cierre-p1', 'Cambiar el dato de prueba', ['Escribe el dato de prueba'])],
    procedimiento: { verificacionFinal: COMPROBACIONES },
  })
}

function boton(texto: string): HTMLElement | null {
  return (
    Array.from(document.body.querySelectorAll<HTMLElement>('button')).find(
      (b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim() === texto,
    ) ?? null
  )
}

function casillas(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-comprobaciones-finales] [role="checkbox"]'))
}

async function alCierre(): Promise<void> {
  await montar(RUTAS, '/soluciones/cat-pruebas/guia-cierre', { ventanaPorDefecto: true })
  await esperar(() => document.body.querySelector('[data-accion-pie]'), 'la ventana 1')
  await tocar(document.body.querySelector<HTMLElement>('[data-accion-pie]') as HTMLElement)
  await esperar(() => (textoPantalla().includes('¿El problema quedó resuelto?') ? true : null), 'el cierre')
}

async function avance() {
  return db.progresoPasos.get('guia-cierre')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await sembrar()
})

afterEach(async () => {
  await desmontarTodo()
})

describe('A1: las comprobaciones como la lista del prototipo', () => {
  it('van en una tarjeta, con su círculo, y se marcan y desmarcan sin terminar la guía', async () => {
    await alCierre()
    const filas = casillas()
    expect(filas.map((f) => f.textContent?.trim())).toEqual(COMPROBACIONES)
    expect(filas.every((f) => f.querySelector('[data-circulo-comprobacion]')?.className.includes('rounded-full'))).toBe(true)

    await tocar(filas[1])
    expect(casillas()[1].getAttribute('aria-checked')).toBe('true')
    expect((await avance())?.verificacionHecha).toEqual([1])
    await tocar(casillas()[1])
    expect(casillas()[1].getAttribute('aria-checked')).toBe('false')
    expect(textoPantalla()).not.toContain('Guía completada')
  })
})

describe('A2: «Sí, quedó resuelto» siempre disponible', () => {
  it('con todo marcado termina la guía en un toque', async () => {
    await alCierre()
    for (const indice of [0, 1, 2]) await tocar(casillas()[indice])
    const si = boton('Sí, quedó resuelto')
    expect(si).not.toBeNull()
    expect(si?.getAttribute('aria-disabled')).toBeNull()
    await tocar(si as HTMLElement)
    await esperar(() => textoPantalla().includes('Guía completada'), 'la guía terminada')
    const guardado = await avance()
    expect(guardado?.verificacionHecha).toEqual([0, 1, 2])
    expect(guardado?.cierrePendiente).toBe(false)
  })

  it('con algo sin marcar pregunta por lo que falta, por su nombre, y no marca nada hasta confirmarlo', async () => {
    await alCierre()
    await tocar(casillas()[0])
    await tocar(boton('Sí, quedó resuelto') as HTMLElement)

    const grupo = await esperar(() => document.body.querySelector<HTMLElement>('[data-confirmar-pendientes]'), 'la confirmación')
    expect(textoPantalla()).toContain('¿Comprobaste esto en el equipo?')
    // Solo lo que falta, con su texto, y en su orden.
    const nombrados = Array.from(grupo.querySelectorAll('li')).map((li) => li.textContent?.trim())
    expect(nombrados).toEqual([COMPROBACIONES[1], COMPROBACIONES[2]])
    expect(grupo.textContent).toContain('Al confirmarlas, quedan marcadas y la guía termina.')
    // «Anterior» sigue en el pie mientras se confirma (regla 28).
    expect(document.body.querySelector('button[aria-label^="Anterior"]')).not.toBeNull()
    // Todavía no se marcó ni se terminó nada.
    expect((await avance())?.verificacionHecha).toEqual([0])
    expect(textoPantalla()).not.toContain('Guía completada')

    // «Revisarlas» vuelve a la pregunta, sin marcar nada.
    await tocar(boton('Revisarlas') as HTMLElement)
    expect(document.body.querySelector('[data-confirmar-pendientes]')).toBeNull()
    expect(textoPantalla()).toContain('¿El problema quedó resuelto?')
    expect((await avance())?.verificacionHecha).toEqual([0])

    // Confirmarlo marca lo que faltaba y termina, en una sola escritura.
    await tocar(boton('Sí, quedó resuelto') as HTMLElement)
    await tocar(boton('Sí, las comprobé') as HTMLElement)
    await esperar(() => textoPantalla().includes('Guía completada'), 'la guía terminada')
    const guardado = await avance()
    expect(guardado?.verificacionHecha).toEqual([0, 1, 2])
    expect(guardado?.cierrePendiente).toBe(false)
  })

  it('sin marcar nada, dos toques terminan la guía con todo lo confirmado', async () => {
    await alCierre()
    await tocar(boton('Sí, quedó resuelto') as HTMLElement)
    const grupo = await esperar(() => document.body.querySelector<HTMLElement>('[data-confirmar-pendientes]'), 'la confirmación')
    expect(grupo.querySelectorAll('li')).toHaveLength(3)
    await tocar(boton('Sí, las comprobé') as HTMLElement)
    await esperar(() => textoPantalla().includes('Guía completada'), 'la guía terminada')
    expect((await avance())?.verificacionHecha).toEqual([0, 1, 2])
  })

  it('con una sola pendiente habla en singular', async () => {
    await alCierre()
    await tocar(casillas()[0])
    await tocar(casillas()[2])
    await tocar(boton('Sí, quedó resuelto') as HTMLElement)
    const grupo = await esperar(() => document.body.querySelector<HTMLElement>('[data-confirmar-pendientes]'), 'la confirmación')
    expect(grupo.textContent).toContain('Al confirmarla, queda marcada y la guía termina.')
    expect(boton('Sí, la comprobé')).not.toBeNull()
    expect(boton('Revisarla')).not.toBeNull()
  })

  it('«No, sigue igual» no marca ni termina nada', async () => {
    await alCierre()
    await tocar(boton('No, sigue igual') as HTMLElement)
    await esperar(() => (textoPantalla().includes('El problema sigue') ? true : null), 'la hoja')
    const guardado = await avance()
    expect(guardado?.verificacionHecha ?? []).toEqual([])
    expect(textoPantalla()).not.toContain('Guía completada')
  })
})
