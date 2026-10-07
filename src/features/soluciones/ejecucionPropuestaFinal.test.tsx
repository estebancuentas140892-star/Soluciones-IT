// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type PasoProcedimiento } from '../../lib/db'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// LA EJECUCIÓN DE UNA GUÍA SEGÚN LA PROPUESTA FINAL DE CLAUDE DESIGN
// (2026-10-01). Lo que se comprueba con la pantalla de verdad:
//
//   - el contador "N/M" abre la "Ruta de la guía", que dice dónde va el
//     trabajo ("Aquí vas") y que abrir un paso no marca nada;
//   - un paso de más adelante abierto desde ahí se CONSULTA: se lee, nada
//     se marca y "Ir al paso N" devuelve al paso de trabajo;
//   - un paso hecho solo navega ("Ir al paso N"), una acción hecha lleva
//     a la siguiente ("Ir a la acción N");
//   - lo que falta por hacer, pendiente, bloquea con su nombre
//     ("Completa «X»"), acortado dentro de las comillas si es largo y
//     entero para el lector;
//   - "Completar y terminar" solo cuando de verdad no queda otro paso.
//
// Todo lo sembrado es inventado.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

const RUTA = '/soluciones/cat-pruebas/guia-propuesta'

async function sembrarTresPasos() {
  await sembrarGuia({
    id: 'guia-propuesta',
    titulo: 'Guía de prueba de la propuesta final',
    pasos: [
      pasoPrueba('pf-p1', 'Abrir el programa de prueba', ['Pulsar el icono de prueba', 'Esperar la ventana']),
      pasoPrueba('pf-p2', 'Configurar la prueba', ['Escribir el valor de prueba']),
      pasoPrueba('pf-p3', 'Comprobar la prueba', ['Imprimir la hoja de prueba']),
    ],
  })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

/** La fila del índice cuyo texto contiene `titulo`, dentro de la hoja. */
function filaDelIndice(titulo: string): HTMLElement | null {
  const hoja = document.body.querySelector('[role="dialog"]')
  if (!hoja) return null
  return (
    Array.from(hoja.querySelectorAll<HTMLElement>('button')).find((boton) =>
      (boton.textContent ?? '').includes(titulo),
    ) ?? null
  )
}

describe('la ruta de la guía', () => {
  it('el contador abre el índice: dónde va el trabajo, los nombres enteros y que abrir no marca nada', async () => {
    await sembrarTresPasos()
    await db.progresoPasos.put({
      articuloId: 'guia-propuesta',
      pasosHechos: ['pf-p1'],
      instruccionesHechas: ['pf-p1-t1', 'pf-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: new Date().toISOString(),
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Escribir el valor de prueba'), 'el paso 2')

    await tocar(await esperarControl(/^Paso 2 de 3\. Abrir el índice de pasos$/))
    await esperar(() => textoPantalla().includes('Ruta de la guía'), 'la hoja del índice')
    expect(textoPantalla()).toContain('Abrir un paso solo lo muestra. No marca nada como hecho.')
    const actual = filaDelIndice('Configurar la prueba')
    expect(actual?.getAttribute('aria-current')).toBe('step')
    expect(actual?.textContent).toContain('Aquí vas')
    // Ninguna fila repite el número de tareas: lo que se busca es el nombre.
    expect(textoPantalla()).not.toMatch(/\d+ tareas?/)
  })
})

describe('consultar otro paso no marca nada', () => {
  it('un paso de más adelante se consulta y "Ir al paso N" devuelve al de trabajo', async () => {
    await sembrarTresPasos()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Pulsar el icono de prueba'), 'el paso 1')

    await tocar(await esperarControl(/^Paso 1 de 3\. Abrir el índice de pasos$/))
    await tocar(await esperar(() => filaDelIndice('Comprobar la prueba'), 'la fila del paso 3'))

    await esperar(() => textoPantalla().includes('Imprimir la hoja de prueba'), 'el paso 3 a la vista')
    expect(textoPantalla()).toContain('Solo consulta · no se marca nada')
    // Lo único que se ofrece es volver: ni completar, ni anterior, ni salidas.
    expect(control('Ir al paso 1')).not.toBeNull()
    expect(control(/^Completar/)).toBeNull()
    expect(control(/^Anterior/)).toBeNull()
    expect(control(/^Tengo un problema/)).toBeNull()

    await tocar(await esperarControl('Ir al paso 1'))
    await esperar(() => textoPantalla().includes('Pulsar el icono de prueba'), 'de vuelta en el paso 1')
    expect(textoPantalla()).not.toContain('Solo consulta')
    // Consultar no tocó el avance.
    expect(await db.progresoPasos.get('guia-propuesta')).toBeUndefined()
  })

  it('un paso de más adelante con varias acciones se lee entero sin marcar nada', async () => {
    await sembrarGuia({
      id: 'guia-propuesta',
      titulo: 'Guía de prueba de la propuesta final',
      pasos: [
        pasoPrueba('pf-p1', 'Abrir el programa de prueba', ['Pulsar el icono de prueba']),
        pasoPrueba('pf-p2', 'Configurar la prueba', ['Escribir el valor A', 'Escribir el valor B']),
      ],
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Pulsar el icono de prueba'), 'el paso 1')

    await tocar(await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/))
    await tocar(await esperar(() => filaDelIndice('Configurar la prueba'), 'la fila del paso 2'))
    await esperar(() => textoPantalla().includes('Escribir el valor A'), 'la primera acción consultada')

    await tocar(await esperarControl('Acción siguiente'))
    await esperar(() => textoPantalla().includes('Escribir el valor B'), 'la segunda acción consultada')
    expect(textoPantalla()).toContain('Solo consulta · no se marca nada')
    expect(await db.progresoPasos.get('guia-propuesta')).toBeUndefined()
  })

  it('volver atrás no es consulta: un paso hecho solo navega y una acción hecha lleva a la siguiente', async () => {
    await sembrarTresPasos()
    await db.progresoPasos.put({
      articuloId: 'guia-propuesta',
      pasosHechos: ['pf-p1'],
      instruccionesHechas: ['pf-p1-t1', 'pf-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: new Date().toISOString(),
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Escribir el valor de prueba'), 'el paso 2')

    // "Anterior" entra al paso 1 por su última acción: el paso está hecho.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('Esperar la ventana'), 'la última acción del paso 1')
    expect(textoPantalla()).not.toContain('Solo consulta')
    expect(control('Ir al paso 2')).not.toBeNull()

    // Y otra vez atrás, a la primera acción: seguir es ir a la acción 2.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('Pulsar el icono de prueba'), 'la primera acción del paso 1')
    expect(control('Ir a la acción 2')).not.toBeNull()
  })
})

describe('el botón dice la consecuencia', () => {
  // Desde la tarea 289 lo que un paso o una tarea reutiliza se HACE en el
  // sitio, una acción detrás de otra. El bloqueo con nombre queda donde lo
  // reutilizado se ve junto al resto del paso: la vista de paso entero,
  // cuyo control dice qué paso falta completar.
  it('lo que falta del paso bloquea con su nombre, acortado y entero para el lector', async () => {
    const nombreLargo = 'Configurar las páginas que abre el navegador de prueba al iniciar en la caja'
    await sembrarGuia({
      id: 'guia-apoyo',
      titulo: 'Abrir el navegador de prueba',
      pasos: [pasoPrueba('apoyo-p1', 'Abrir el navegador de prueba', ['Pulsar el icono del navegador'])],
    })
    const conGuia: PasoProcedimiento = {
      ...pasoPrueba('pf-p1', nombreLargo, []),
      subArticuloId: 'guia-apoyo',
      subArticuloTitulo: 'Abrir el navegador de prueba',
    }
    await sembrarGuia({
      id: 'guia-propuesta',
      titulo: 'Guía de prueba de la propuesta final',
      pasos: [conGuia, pasoPrueba('pf-p2', 'Terminar la prueba', ['Cerrar el navegador'])],
    })
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Pulsar el icono del navegador'), 'lo reutilizado dentro del paso')

    const boton = await esperarControl(`Completa «${nombreLargo}»`)
    expect(boton.hasAttribute('disabled')).toBe(true)
    // A la vista: el verbo entero y el nombre acortado DENTRO de las comillas.
    const visible = (boton.textContent ?? '').trim()
    expect(visible.startsWith('Completa «')).toBe(true)
    expect(visible.endsWith('…»')).toBe(true)
    expect(visible.length).toBeLessThan(`Completa «${nombreLargo}»`.length)
  })

  it('una guía que una tarea exige se hace en el sitio, justo antes de esa tarea, sin tarjeta que abrir', async () => {
    await sembrarGuia({
      id: 'guia-apoyo',
      titulo: 'Configurar las páginas del navegador de prueba',
      pasos: [pasoPrueba('apoyo-p1', 'Abrir el navegador de prueba', ['Pulsar el icono del navegador'])],
    })
    const conGuia: PasoProcedimiento = pasoPrueba('pf-p1', 'Preparar el navegador', ['Revisar la página de inicio'])
    conGuia.bloques.push({
      ...conGuia.bloques[0],
      id: 'pf-p1-g1',
      tipo: 'guia',
      texto: '',
      tipoTarea: null,
      tareaId: 'pf-p1-t1',
      alcance: 'tarea',
      guiaArticuloId: 'guia-apoyo',
      guiaArticuloTitulo: 'Configurar las páginas del navegador de prueba',
      intencionGuia: 'necesario',
    })
    await sembrarGuia({
      id: 'guia-propuesta',
      titulo: 'Guía de prueba de la propuesta final',
      pasos: [conGuia, pasoPrueba('pf-p2', 'Terminar la prueba', ['Cerrar el navegador'])],
    })
    await montar(RUTAS, RUTA)
    // Primero lo que la tarea exige, en el sitio: ni tarjeta ni "Necesario".
    await esperar(() => textoPantalla().includes('Pulsar el icono del navegador'), 'lo que la tarea exige')
    expect(textoPantalla()).not.toContain('Revisar la página de inicio')
    expect(textoPantalla()).not.toContain('Necesario para seguir')
    expect(control(/^Abrir:/)).toBeNull()
    expect(control('Paso 1 de 2. Abrir el índice de pasos')).not.toBeNull()

    // Hecho, sigue con la tarea, que ya se puede marcar.
    await tocar(await esperarControl('Completar y seguir'))
    await esperar(() => textoPantalla().includes('Revisar la página de inicio'), 'la tarea que lo exigía')
    expect(control('Completar y seguir')).not.toBeNull()
    expect((await db.progresoPasos.get('guia-propuesta'))?.vinculos?.['guia-apoyo']?.pasosHechos).toEqual(['apoyo-p1'])

    // "Anterior" la vuelve a leer, ya hecha, sin abrir nada.
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('hecha'), 'lo exigido, para leerlo')
    expect(textoPantalla()).toContain('Qué hacer')
    expect(textoPantalla()).toContain('Pulsar el icono del navegador')
    expect(control('Ir a la acción 2')).not.toBeNull()
  })

  it('"Completar y terminar" solo cuando no queda otro paso por hacer', async () => {
    await sembrarGuia({
      id: 'guia-propuesta',
      titulo: 'Guía de prueba de la propuesta final',
      pasos: [
        pasoPrueba('pf-p1', 'Abrir el programa de prueba', ['Pulsar el icono de prueba']),
        pasoPrueba('pf-p2', 'Cerrar la prueba', ['Pulsar Cerrar']),
      ],
    })
    // El paso 1 se saltó: el 2 es el último, pero NO termina la guía.
    await db.progresoPasos.put({
      articuloId: 'guia-propuesta',
      pasosHechos: [],
      instruccionesHechas: [],
      pasosSaltados: ['pf-p1'],
      verificacionHecha: [],
      actualizadoEn: new Date().toISOString(),
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Pulsar el icono de prueba'), 'entra en el paso saltado')

    await tocar(await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/))
    await tocar(await esperar(() => filaDelIndice('Cerrar la prueba'), 'la fila del paso 2'))
    await esperar(() => textoPantalla().includes('Pulsar Cerrar'), 'el paso 2')
    // El paso 2 es donde sigue el trabajo (el 1 se apartó al saltarlo).
    expect(textoPantalla()).not.toContain('Solo consulta')
    expect(control('Completar y seguir')).not.toBeNull()
    expect(control('Completar y terminar')).toBeNull()
  })
})
