// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso, type OpcionDecision, type PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
import {
  COMPLETAR_Y_SEGUIR,
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  ponerAncho,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// LA VENTANA EN EL TELÉFONO, CON LAS PANTALLAS DE VERDAD (tarea 348).
//
// En el teléfono, un paso de la guía se lee entero y se cierra con un solo
// "Listo". Se recorre lo que importa, con guías de distinto tamaño:
//
//   - con cuántas instrucciones sea, sin casillas, numeradas, y un "Listo" que
//     cierra la ventana y deja el MISMO avance guardado de siempre;
//   - los dos niveles de advertencia: la precaución no pide nada, la crítica
//     pide "Confirmo que la leí" y mientras no se confirme la ventana no se
//     cierra, y el botón apagado dice por qué;
//   - la comprobación con su salida a la vista;
//   - las preguntas: la de Sí/No y la de opciones fijas al pie, con lo que
//     hace falta para contestar a la vista, y la de Sí/No con camino propio
//     dentro de la ventana;
//   - revisar una ventana hecha, consultar una de más adelante y volver;
//   - y que el escritorio, la preferencia de una acción a la vez y la del
//     paso entero siguen siendo lo que eran.
//
// Todo lo sembrado es inventado.

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <p>DETALLES DE LA GUÍA</p> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

const ruta = (id: string) => `/soluciones/cat-pruebas/${id}`

function bloque(parcial: Partial<BloquePaso> & { id: string }): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, tipo: 'tarea', ...parcial }
}

function aviso(id: string, tono: 'precaucion' | 'importante', texto: string, tareaId: string): BloquePaso {
  return bloque({ id, tipo: 'aviso', texto, tono, alcance: 'tarea', tareaId })
}

function pregunta(id: string, texto: string, extra: Partial<BloquePaso> = {}): BloquePaso {
  return bloque({ id, texto, tipoTarea: 'decision', ...extra })
}

function comprobacion(id: string, texto: string): BloquePaso {
  return bloque({ id, texto, tipoTarea: 'verificacion' })
}

const opcion = (id: string, titulo: string, descripcion: string, destino?: string): OpcionDecision => ({
  id,
  titulo,
  descripcion,
  destino: destino ? { tipo: 'paso', pasoId: destino } : { tipo: 'continuar' },
})

/** Una ventana (paso) con sus acciones y lo que se le agregue. */
function ventana(id: string, titulo: string, acciones: string[], extras: BloquePaso[] = []): PasoProcedimiento {
  const base = pasoPrueba(id, titulo, acciones)
  return { ...base, bloques: [...base.bloques, ...extras] }
}

// --- lo que se ve y se toca ---------------------------------------------

function piePrincipal(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-accion-pie]')
}

function etiquetaPrincipal(): string {
  return (piePrincipal()?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function respuestasDelPie(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-pie-ventana] [data-respuesta-ventana]'))
}

function instrucciones(): string[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-instruccion-ventana]')).map((fila) =>
    (fila.textContent ?? '').replace(/\s+/g, ' ').trim(),
  )
}

function critica(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-aviso-ventana="critica"]')
}

async function tocarPrincipal(): Promise<void> {
  const boton = piePrincipal()
  if (!boton) throw new Error('No hay botón principal en el pie.')
  await tocar(boton)
}

async function enLaVentana(titulo: string): Promise<void> {
  await esperar(
    () => document.body.querySelector('[data-pie-ventana]') && document.body.textContent?.includes(titulo),
    `la ventana «${titulo}»`,
  )
}

async function progreso(id: string) {
  return db.progresoPasos.get(id)
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('una ventana con varias instrucciones', () => {
  async function sembrar(): Promise<void> {
    await sembrarGuia({
      id: 'guia-v1',
      titulo: 'Guía de prueba por ventanas',
      pasos: [
        ventana('v1-p1', 'Preparar el equipo', ['Abre el panel de prueba', 'Escribe el dato de prueba', 'Guarda el cambio de prueba']),
        ventana('v1-p2', 'Cerrar la prueba', ['Cierra el panel de prueba']),
      ],
    })
  }

  it('las lee numeradas y sin casillas, y un solo "Listo" cierra la ventana y deja el avance de siempre', async () => {
    await sembrar()
    await montar(RUTAS, ruta('guia-v1'), { modo: 'ventana' })
    await enLaVentana('Abre el panel de prueba')

    // Las tres instrucciones a la vez, con su número, y ninguna casilla.
    expect(instrucciones()).toEqual([
      expect.stringContaining('Abre el panel de prueba'),
      expect.stringContaining('Escribe el dato de prueba'),
      expect.stringContaining('Guarda el cambio de prueba'),
    ])
    expect(document.body.querySelector('[role="checkbox"]')).toBeNull()
    // La cabecera dice en qué ventana se va y la tarjeta, cuál es (tarea 350,
    // prototipo de Claude Design): «Ventana 1 de 2» arriba y su título a 22.
    expect(document.body.querySelector('[data-paso-en-cabecera]')?.textContent).toContain('Ventana 1 de 2')
    expect(document.body.querySelector('[data-marco-ventana] h2')?.textContent).toBe('Preparar el equipo')
    expect(document.body.querySelector('[data-marco-ventana]')?.textContent).toContain('Ventana 1')
    expect(etiquetaPrincipal()).toBe('Listo · Siguiente ventana')

    await tocarPrincipal()
    await enLaVentana('Cierra el panel de prueba')
    expect(etiquetaPrincipal()).toBe('Listo · Terminar guía')

    // El MISMO avance de siempre: el paso hecho y todas sus tareas marcadas.
    const avance = await progreso('guia-v1')
    expect(avance?.pasosHechos).toEqual(['v1-p1'])
    expect(avance?.instruccionesHechas).toEqual(expect.arrayContaining(['v1-p1-t1', 'v1-p1-t2', 'v1-p1-t3']))
  })

  it('una ventana de una sola instrucción también se cierra con "Listo", y la última termina la guía', async () => {
    await sembrar()
    await montar(RUTAS, ruta('guia-v1'), { modo: 'ventana' })
    await enLaVentana('Abre el panel de prueba')
    await tocarPrincipal()
    await enLaVentana('Cierra el panel de prueba')
    expect(instrucciones()).toHaveLength(1)

    await tocarPrincipal()
    await esperar(() => textoPantalla().includes('Guía completada'), 'la pantalla de guía completada')
    expect((await progreso('guia-v1'))?.pasosHechos).toEqual(['v1-p1', 'v1-p2'])
  })

  it('"Ver la ventana anterior" la muestra hecha, sin cambiar nada, y su botón lleva a la siguiente', async () => {
    await sembrar()
    await montar(RUTAS, ruta('guia-v1'), { modo: 'ventana' })
    await enLaVentana('Abre el panel de prueba')
    await tocarPrincipal()
    await enLaVentana('Cierra el panel de prueba')

    await tocar(await esperarControl(/^Ver la ventana anterior/))
    await enLaVentana('Abre el panel de prueba')
    expect(etiquetaPrincipal()).toBe('Seguir en la ventana 2')
    expect((await progreso('guia-v1'))?.pasosHechos).toEqual(['v1-p1'])

    await tocarPrincipal()
    await enLaVentana('Cierra el panel de prueba')
    expect((await progreso('guia-v1'))?.pasosHechos).toEqual(['v1-p1'])
  })

  it('en la primera ventana, "volver" dice con palabras que no hay anterior', async () => {
    await sembrar()
    await montar(RUTAS, ruta('guia-v1'), { modo: 'ventana' })
    await enLaVentana('Abre el panel de prueba')
    const volver = control(/^No hay ventana anterior/)
    expect(volver).not.toBeNull()
    expect(volver?.getAttribute('aria-disabled')).toBe('true')
    await tocar(volver!)
    // Tocarlo no hace nada: sigue en la misma ventana.
    expect(textoPantalla()).toContain('Abre el panel de prueba')
  })

  it('consultar una ventana de más adelante no la cierra: el botón devuelve al trabajo', async () => {
    await sembrar()
    await montar(RUTAS, ruta('guia-v1'), { modo: 'ventana' })
    await enLaVentana('Abre el panel de prueba')

    await tocar(await esperarControl(/^Ventana 1 de 2\. Abrir el índice de ventanas$/))
    const filas = await esperar(() => {
      const hoja = document.body.querySelector('[role="dialog"]')
      const lista = hoja ? Array.from(hoja.querySelectorAll<HTMLElement>('ol button')) : []
      return lista.length >= 2 ? lista : null
    }, 'las filas del índice')
    await tocar(filas[1])

    await enLaVentana('Cierra el panel de prueba')
    expect(etiquetaPrincipal()).toBe('Volver a la ventana 1')
    await tocarPrincipal()
    await enLaVentana('Abre el panel de prueba')
    // Nada quedó hecho por haber mirado.
    expect((await progreso('guia-v1'))?.pasosHechos ?? []).toEqual([])
  })
})

describe('las advertencias de la ventana', () => {
  async function sembrar(tono: 'precaucion' | 'importante'): Promise<void> {
    await sembrarGuia({
      id: 'guia-v2',
      titulo: 'Guía de prueba con advertencia',
      pasos: [
        ventana(
          'v2-p1',
          'Cambiar el dato',
          ['Abre el campo de prueba', 'Reemplaza el dato de prueba'],
          [aviso('v2-aviso', tono, 'Reemplazar borra el dato anterior de la prueba.', 'v2-p1-t2')],
        ),
        ventana('v2-p2', 'Comprobar el cambio', ['Revisa el campo de prueba']),
      ],
    })
  }

  it('una precaución se lee antes de su acción, con su palabra, y no pide ningún toque', async () => {
    await sembrar('precaucion')
    await montar(RUTAS, ruta('guia-v2'), { modo: 'ventana' })
    await enLaVentana('Abre el campo de prueba')

    const precaucion = document.body.querySelector<HTMLElement>('[data-aviso-ventana="precaucion"]')
    expect(precaucion?.textContent).toContain('Precaución')
    expect(precaucion?.textContent).toContain('Reemplazar borra el dato anterior de la prueba.')
    expect(control('Confirmo que la leí')).toBeNull()
    // Va antes de la instrucción a la que pertenece.
    const segunda = document.body.querySelectorAll('[data-instruccion-ventana]')[1]
    expect(precaucion!.compareDocumentPosition(segunda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Y "Listo" está disponible desde el primer momento.
    expect(piePrincipal()?.getAttribute('aria-disabled')).toBe('false')
    await tocarPrincipal()
    await enLaVentana('Revisa el campo de prueba')
  })

  it('una crítica pide "Confirmo que la leí": sin ella la ventana no se cierra y el botón apagado dice por qué', async () => {
    await sembrar('importante')
    await montar(RUTAS, ruta('guia-v2'), { modo: 'ventana' })
    await enLaVentana('Abre el campo de prueba')

    expect(critica()?.textContent).toContain('Advertencia crítica')
    expect(piePrincipal()?.getAttribute('aria-disabled')).toBe('true')
    expect(etiquetaPrincipal()).toBe('Falta confirmar la advertencia')
    // La explicación está escrita, a la vista, y se anuncia.
    const motivo = document.body.querySelector('[data-pie-ventana] [data-no-disponible]')
    expect(motivo?.textContent).toContain('Confirma la advertencia crítica de arriba para poder seguir.')
    expect(motivo?.getAttribute('role')).toBe('status')

    // Tocar lo apagado no cierra nada.
    await tocarPrincipal()
    expect(textoPantalla()).toContain('Abre el campo de prueba')
    expect((await progreso('guia-v2'))?.pasosHechos ?? []).toEqual([])

    // Confirmada, se puede cerrar.
    await tocar(await esperarControl('Confirmo que la leí'))
    await esperar(() => etiquetaPrincipal() === 'Listo · Siguiente ventana', 'el botón disponible')
    expect(control('Advertencia confirmada')?.getAttribute('aria-pressed')).toBe('true')
    await tocarPrincipal()
    await enLaVentana('Revisa el campo de prueba')
  })

  it('confirmar por error se deshace tocando otra vez, y la ventana vuelve a quedar bloqueada', async () => {
    await sembrar('importante')
    await montar(RUTAS, ruta('guia-v2'), { modo: 'ventana' })
    await enLaVentana('Abre el campo de prueba')

    await tocar(await esperarControl('Confirmo que la leí'))
    await esperar(() => etiquetaPrincipal() === 'Listo · Siguiente ventana', 'disponible')
    await tocar(await esperarControl('Advertencia confirmada'))
    await esperar(() => etiquetaPrincipal() === 'Falta confirmar la advertencia', 'bloqueada otra vez')
  })

  it('las críticas pendientes no se saltan respondiendo la pregunta de la ventana por otro camino', async () => {
    // Cuatro respuestas: no caben fijas al pie, así que la pregunta va dentro de la ventana.
    const paso = ventana(
      'v2b-p1',
      'Elegir el camino',
      ['Abre el campo de prueba'],
      [
        aviso('v2b-aviso', 'importante', 'Elegir mal reinicia la prueba.', 'v2b-p1-t1'),
        pregunta('v2b-q', '¿Qué opción de prueba aplica?', {
          opciones: [
            opcion('o1', 'Primera', 'Aplica la primera.'),
            opcion('o2', 'Segunda', 'Aplica la segunda.'),
            opcion('o3', 'Tercera', 'Aplica la tercera.'),
            opcion('o4', 'Cuarta', 'Aplica la cuarta.'),
          ],
        }),
      ],
    )
    await sembrarGuia({
      id: 'guia-v2b',
      titulo: 'Guía de prueba con crítica y pregunta',
      pasos: [paso, ventana('v2b-p2', 'Seguir', ['Revisa el resultado de prueba'])],
    })
    await montar(RUTAS, ruta('guia-v2b'), { modo: 'ventana' })
    await enLaVentana('Abre el campo de prueba')
    expect(respuestasDelPie()).toHaveLength(0)

    await tocar(await esperarControl(/^Tercera/))
    await esperarQue(async () => ((await progreso('guia-v2b'))?.elecciones ?? {})['v2b-q'] === 'o3', 'la respuesta guardada')
    // La respuesta quedó, pero la ventana NO se cerró: falta la crítica.
    expect(textoPantalla()).toContain('Abre el campo de prueba')
    expect((await progreso('guia-v2b'))?.pasosHechos ?? []).toEqual([])
    expect(etiquetaPrincipal()).toBe('Falta confirmar la advertencia')

    await tocar(await esperarControl('Confirmo que la leí'))
    await esperar(() => etiquetaPrincipal() === 'Listo · Siguiente ventana', 'disponible')
    await tocarPrincipal()
    await enLaVentana('Revisa el resultado de prueba')
  })
})

describe('la comprobación de la ventana', () => {
  it('es una tarjeta con su salida a la vista, y "Listo" la da por comprobada', async () => {
    await sembrarGuia({
      id: 'guia-v3',
      titulo: 'Guía de prueba con comprobación',
      pasos: [
        ventana('v3-p1', 'Aplicar y comprobar', ['Aplica el cambio de prueba'], [comprobacion('v3-p1-c', 'Comprueba que el cambio de prueba se ve')]),
        ventana('v3-p2', 'Terminar', ['Cierra la prueba']),
      ],
    })
    await montar(RUTAS, ruta('guia-v3'), { modo: 'ventana' })
    await enLaVentana('Aplica el cambio de prueba')

    const tarjeta = document.body.querySelector<HTMLElement>('[data-comprobacion-ventana]')
    expect(tarjeta?.textContent).toContain('Comprobación')
    expect(tarjeta?.textContent).toContain('Comprueba que el cambio de prueba se ve')
    // No cuenta como una instrucción más.
    expect(instrucciones()).toHaveLength(1)
    // La salida está en la propia tarjeta, no escondida.
    expect(tarjeta?.querySelector('button')?.textContent).toBe('No se cumple')

    await tocarPrincipal()
    await enLaVentana('Cierra la prueba')
    expect((await progreso('guia-v3'))?.instruccionesHechas).toEqual(expect.arrayContaining(['v3-p1-t1', 'v3-p1-c']))
  })

  it('"No se cumple" abre las mismas salidas de siempre y no cierra la ventana', async () => {
    await sembrarGuia({
      id: 'guia-v3',
      titulo: 'Guía de prueba con comprobación',
      pasos: [
        ventana('v3-p1', 'Aplicar y comprobar', ['Aplica el cambio de prueba'], [comprobacion('v3-p1-c', 'Comprueba que el cambio de prueba se ve')]),
      ],
    })
    await montar(RUTAS, ruta('guia-v3'), { modo: 'ventana' })
    await enLaVentana('Aplica el cambio de prueba')

    await tocar(await esperarControl('No se cumple'))
    await esperar(() => document.body.querySelector('[role="dialog"]'), 'la hoja de salidas')
    expect((await progreso('guia-v3'))?.pasosHechos ?? []).toEqual([])
  })
})

describe('las preguntas de la ventana', () => {
  it('una pregunta de Sí/No que cierra la ventana va fija al pie: responder es avanzar', async () => {
    await sembrarGuia({
      id: 'guia-v4',
      titulo: 'Guía de prueba con pregunta',
      pasos: [
        ventana('v4-p1', 'Revisar el equipo', ['Enciende el equipo de prueba'], [pregunta('v4-q', '¿El equipo de prueba llega a su pantalla principal?')]),
        ventana('v4-p2', 'Seguir', ['Registra la revisión de prueba']),
      ],
    })
    await montar(RUTAS, ruta('guia-v4'), { modo: 'ventana' })
    await enLaVentana('Enciende el equipo de prueba')

    // La pregunta y sus dos respuestas, en el pie y con la misma forma.
    const pie = document.body.querySelector('[data-pie-ventana]')
    expect(pie?.textContent).toContain('¿El equipo de prueba llega a su pantalla principal?')
    const respuestas = respuestasDelPie()
    expect(respuestas.map((r) => r.textContent?.trim())).toEqual(['Sí', 'No'])
    // Ninguna es "la buena": las dos van con el mismo color de acento neutro.
    expect(respuestas[0].className).toBe(respuestas[1].className)
    // La pregunta no se repite dentro de la ventana.
    expect(document.body.querySelectorAll('[data-decision-ventana]')).toHaveLength(0)

    await tocar(respuestas[0])
    await enLaVentana('Registra la revisión de prueba')
    expect((await progreso('guia-v4'))?.pasosHechos).toEqual(['v4-p1'])
    expect((await progreso('guia-v4'))?.instruccionesHechas).toEqual(expect.arrayContaining(['v4-p1-t1', 'v4-q']))
  })

  it('una pregunta de opciones fija al pie lleva el criterio dentro de cada respuesta y responder lleva a su paso', async () => {
    const preguntar = ventana(
      'v5-p1',
      'Identificar la versión',
      ['Abre el programa de prueba'],
      [
        pregunta('v5-q', '¿Qué versión del programa de prueba usas?', {
          opciones: [
            opcion('clasica', 'Clásica', 'Veo el menú Archivo arriba.', 'v5-p2'),
            opcion('nueva', 'Nueva', 'Veo una cinta de botones.', 'v5-p3'),
          ],
        }),
      ],
    )
    await sembrarGuia({
      id: 'guia-v5',
      titulo: 'Guía de prueba con opciones',
      pasos: [preguntar, ventana('v5-p2', 'Camino clásico', ['Exporta desde Archivo']), ventana('v5-p3', 'Camino nuevo', ['Exporta desde la cinta'])],
    })
    await montar(RUTAS, ruta('guia-v5'), { modo: 'ventana' })
    await enLaVentana('Abre el programa de prueba')

    // Lo que hace falta para contestar está en los propios botones.
    const respuestas = respuestasDelPie()
    expect(respuestas).toHaveLength(2)
    expect(respuestas[0].textContent).toContain('Clásica')
    expect(respuestas[0].textContent).toContain('Veo el menú Archivo arriba.')
    expect(respuestas[1].textContent).toContain('Veo una cinta de botones.')
    expect(textoPantalla()).not.toContain('Cómo responder')

    await tocar(respuestas[1])
    await enLaVentana('Exporta desde la cinta')
    expect(textoPantalla()).not.toContain('Exporta desde Archivo')
  })

  it('con una crítica sin confirmar, las respuestas del pie se apagan SIN esconder su criterio y dicen por qué', async () => {
    await sembrarGuia({
      id: 'guia-v6',
      titulo: 'Guía de prueba con pregunta bloqueada',
      pasos: [
        ventana(
          'v6-p1',
          'Elegir',
          ['Abre el programa de prueba'],
          [
            aviso('v6-aviso', 'importante', 'Elegir mal reinicia la prueba.', 'v6-p1-t1'),
            pregunta('v6-q', '¿Qué versión usas?', {
              opciones: [opcion('a', 'Clásica', 'Veo el menú Archivo arriba.'), opcion('b', 'Nueva', 'Veo una cinta de botones.')],
            }),
          ],
        ),
        ventana('v6-p2', 'Seguir', ['Termina la prueba']),
      ],
    })
    await montar(RUTAS, ruta('guia-v6'), { modo: 'ventana' })
    await enLaVentana('Abre el programa de prueba')

    const respuestas = respuestasDelPie()
    expect(respuestas.every((r) => r.getAttribute('aria-disabled') === 'true')).toBe(true)
    // El criterio sigue ahí, legible: no se esconde ni se atenúa con opacidad.
    expect(respuestas[0].textContent).toContain('Veo el menú Archivo arriba.')
    expect(respuestas.some((r) => /\bopacity-/.test(r.className))).toBe(false)
    expect(document.body.querySelector('[data-pie-ventana] [data-no-disponible]')?.textContent).toContain(
      'Primero confirma la advertencia de arriba.',
    )

    // Tocarlas no responde nada.
    await tocar(respuestas[0])
    expect((await progreso('guia-v6'))?.elecciones ?? {}).toEqual({})

    await tocar(await esperarControl('Confirmo que la leí'))
    await esperar(() => respuestasDelPie().every((r) => r.getAttribute('aria-disabled') === 'false'), 'respuestas disponibles')
    await tocar(respuestasDelPie()[0])
    await enLaVentana('Termina la prueba')
  })

  it('una pregunta de Sí/No con camino propio se queda dentro de la ventana, y sin responder no se cierra', async () => {
    await sembrarGuia({
      id: 'guia-camino',
      titulo: 'Abrir el acceso de prueba',
      pasos: [ventana('cam-p1', 'Abrir', ['Abre el acceso de prueba'])],
    })
    await sembrarGuia({
      id: 'guia-v7',
      titulo: 'Guía de prueba con camino alterno',
      pasos: [
        ventana(
          'v7-p1',
          'Revisar el equipo',
          ['Enciende el equipo de prueba'],
          [
            pregunta('v7-q', '¿El equipo de prueba enciende?', {
              decisionArticuloId: 'guia-camino',
              decisionArticuloTitulo: 'Abrir el acceso de prueba',
            }),
          ],
        ),
        ventana('v7-p2', 'Seguir', ['Registra la revisión de prueba']),
      ],
    })
    await montar(RUTAS, ruta('guia-v7'), { modo: 'ventana' })
    await enLaVentana('Enciende el equipo de prueba')

    // Dentro de la ventana, no en el pie; el "No" dice a dónde lleva.
    expect(respuestasDelPie()).toHaveLength(0)
    expect(document.body.querySelector('[data-decision-ventana="pendiente"]')).not.toBeNull()
    expect(control('No, seguir con «Abrir el acceso de prueba»')).not.toBeNull()
    // Sin responder, el botón principal está apagado y lo explica.
    expect(etiquetaPrincipal()).toBe('Responde la pregunta')
    expect(document.body.querySelector('[data-pie-ventana] [data-no-disponible]')?.textContent).toContain('Responde la pregunta')
    await tocarPrincipal()
    expect((await progreso('guia-v7'))?.pasosHechos ?? []).toEqual([])

    await tocar(await esperarControl('Sí, continuar'))
    await esperar(() => document.body.querySelector('[data-decision-ventana="respondida"]'), 'la respuesta dada')
    expect(etiquetaPrincipal()).toBe('Listo · Siguiente ventana')
    // Se puede cambiar la respuesta.
    expect(control(/^Cambiar la respuesta/)).not.toBeNull()
    await tocarPrincipal()
    await enLaVentana('Registra la revisión de prueba')
  })
})

describe('una guía necesaria dentro de la ventana', () => {
  it('mientras falte, "Listo" está apagado y dice qué completar; hecha, se puede cerrar', async () => {
    await sembrarGuia({
      id: 'guia-apoyo',
      titulo: 'Instalar el apoyo de prueba',
      pasos: [pasoPrueba('apoyo-p1', 'Instalar', ['Ejecuta el instalador de prueba'])],
    })
    const paso = pasoPrueba('v8-p1', 'Usar el apoyo', ['Usa el apoyo de prueba'])
    paso.bloques.push({
      ...paso.bloques[0],
      id: 'v8-p1-g1',
      tipo: 'guia',
      texto: '',
      tipoTarea: null,
      tareaId: 'v8-p1-t1',
      alcance: 'tarea',
      guiaArticuloId: 'guia-apoyo',
      guiaArticuloTitulo: 'Instalar el apoyo de prueba',
      intencionGuia: 'necesario',
    })
    await sembrarGuia({ id: 'guia-v8', titulo: 'Guía de prueba con guía necesaria', pasos: [paso] })
    await montar(RUTAS, ruta('guia-v8'), { modo: 'ventana' })
    await enLaVentana('Ejecuta el instalador de prueba')

    expect(piePrincipal()?.getAttribute('aria-disabled')).toBe('true')
    expect(document.body.querySelector('[data-pie-ventana] [data-no-disponible]')?.textContent).toContain(
      'Completa «Instalar el apoyo de prueba» para poder cerrar la ventana.',
    )
    await tocarPrincipal()
    expect((await progreso('guia-v8'))?.pasosHechos ?? []).toEqual([])

    // Terminar lo que exige la tarea libera la ventana.
    await tocar(await esperarControl(COMPLETAR_Y_SEGUIR))
    await esperar(() => piePrincipal()?.getAttribute('aria-disabled') === 'false', 'la ventana disponible')
    await tocarPrincipal()
    await esperar(() => textoPantalla().includes('Guía completada'), 'la guía terminada')
  })
})

describe('un paso que reutiliza otra guía, dentro de la ventana', () => {
  it('la guía reutilizada se hace dentro de la ventana, "Listo" lo explica mientras falte y al terminarla sigue la ventana 2', async () => {
    await sembrarGuia({
      id: 'guia-acceso',
      titulo: 'Entrar al programa de prueba',
      pasos: [pasoPrueba('acc-p1', 'Abrir el programa', ['Abre el programa de prueba'])],
    })
    const entrar = { ...pasoPrueba('v9-p1', 'Entrar al programa', []), subArticuloId: 'guia-acceso', subArticuloTitulo: 'Entrar al programa de prueba' }
    const guardar = ventana(
      'v9-p2',
      'Guardar',
      ['Selecciona Guardar'],
      [aviso('v9-r', 'precaucion', 'Guardar reemplaza el registro de prueba anterior.', 'v9-p2-t1')],
    )
    await sembrarGuia({
      id: 'guia-v9r',
      titulo: 'Guía de prueba que reutiliza otra',
      pasos: [entrar, guardar],
      procedimiento: { verificacionFinal: ['El registro de prueba aparece guardado.'] },
    })
    await montar(RUTAS, ruta('guia-v9r'), { modo: 'ventana' })
    // La guía reutilizada carga desde la base local; sus acciones salen en la ventana.
    await esperar(() => textoPantalla().includes('Abre el programa de prueba'), 'la acción de la guía reutilizada', 10000)

    // Mientras falte, "Listo" está apagado y dice qué completar: no es un callejón sin salida.
    expect(piePrincipal()?.getAttribute('aria-disabled')).toBe('true')
    expect(document.body.querySelector('[data-pie-ventana] [data-no-disponible]')?.textContent).toContain(
      'Completa «Entrar al programa» para poder cerrar la ventana.',
    )
    await tocar(await esperarControl(COMPLETAR_Y_SEGUIR))

    // Terminada, sigue la ventana 2, con su precaución en su sitio y "Listo" a mano.
    await enLaVentana('Selecciona Guardar')
    expect(document.body.querySelector('[data-aviso-ventana="precaucion"]')?.textContent).toContain('Guardar reemplaza el registro de prueba anterior.')
    expect(control('Entiendo, continuar')).toBeNull()
    expect(piePrincipal()?.getAttribute('aria-disabled')).toBe('false')
    expect((await progreso('guia-v9r'))?.pasosHechos).toEqual(['v9-p1'])

    // "Listo" de la última ventana lleva a la comprobación final de siempre.
    expect(etiquetaPrincipal()).toBe('Listo · Comprobar el resultado')
    await tocarPrincipal()
    // El cierre del prototipo (tarea 350): la pregunta en el pie.
    await esperar(() => textoPantalla().includes('¿El problema quedó resuelto?'), 'la comprobación final')
  })
})

describe('cada quien con su forma de trabajar', () => {
  async function sembrar(): Promise<void> {
    await sembrarGuia({
      id: 'guia-v9',
      titulo: 'Guía de prueba de modos',
      pasos: [ventana('v9-p1', 'Primer paso', ['Primera acción de prueba', 'Segunda acción de prueba']), ventana('v9-p2', 'Segundo paso', ['Tercera acción de prueba'])],
    })
  }

  // Desde la tarea 355 el teléfono abre una acción a la vez; la ventana es una
  // opción del índice, y quien la eligió la conserva.
  it('en el teléfono, sin preferencia guardada, abre una acción a la vez (tarea 355)', async () => {
    await sembrar()
    await montar(RUTAS, ruta('guia-v9'), { modo: 'defecto' })
    await esperar(() => document.body.querySelector('[data-accion-telefono]') !== null, 'la acción a la vez')
    expect(document.body.querySelector('[data-marco-ventana]')).toBeNull()
    expect(textoPantalla()).not.toContain('Segunda acción de prueba')
  })

  it('en el teléfono, quien eligió la ventana la conserva', async () => {
    await sembrar()
    await guardarModoEjecucion('ventana')
    await montar(RUTAS, ruta('guia-v9'))
    await enLaVentana('Primera acción de prueba')
    expect(document.body.querySelector('[role="checkbox"]')).toBeNull()
  })

  it('en el teléfono, quien eligió una acción a la vez la conserva', async () => {
    await sembrar()
    await guardarModoEjecucion('foco')
    await montar(RUTAS, ruta('guia-v9'))
    await esperar(() => textoPantalla().includes('Primera acción de prueba'), 'la primera acción')
    expect(document.body.querySelector('[data-marco-ventana]')).toBeNull()
    expect(textoPantalla()).not.toContain('Segunda acción de prueba')
  })

  it('en el teléfono, quien prefería ver el paso entero lo recibe como ventana', async () => {
    await sembrar()
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS, ruta('guia-v9'))
    await enLaVentana('Primera acción de prueba')
  })

  it('en el teléfono, el índice cambia entre una acción a la vez y la ventana', async () => {
    await sembrar()
    await montar(RUTAS, ruta('guia-v9'), { modo: 'ventana' })
    await enLaVentana('Primera acción de prueba')

    // En la ventana, el índice de ventanas (tarea 350); en la acción a la vez,
    // el de pasos de siempre.
    await tocar(await esperarControl(/^Ventana 1 de 2\. Abrir el índice de ventanas$/))
    await tocar(await esperarControl('Volver a una acción a la vez'))
    await esperar(() => !document.body.querySelector('[data-marco-ventana]'), 'sin ventana')
    expect(textoPantalla()).not.toContain('Segunda acción de prueba')

    await tocar(await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/))
    await tocar(await esperarControl('Ver el paso entero'))
    await enLaVentana('Segunda acción de prueba')
  })

  it('en tableta y escritorio la ventana se ve como el paso entero de siempre, con sus casillas', async () => {
    await sembrar()
    await guardarModoEjecucion('ventana')
    ponerAncho('tableta')
    await montar(RUTAS, ruta('guia-v9'))
    await esperar(() => textoPantalla().includes('Segunda acción de prueba'), 'el paso entero')
    expect(document.body.querySelector('[data-pie-ventana]')).toBeNull()
    expect(control('Tarea: Primera acción de prueba')?.getAttribute('role')).toBe('checkbox')
  })

  it('en tableta y escritorio, sin preferencia, sigue una acción a la vez', async () => {
    await sembrar()
    ponerAncho('tableta')
    await montar(RUTAS, ruta('guia-v9'), { modo: 'defecto' })
    await esperar(() => textoPantalla().includes('Primera acción de prueba'), 'la primera acción')
    expect(document.body.querySelector('[data-pie-ventana]')).toBeNull()
    expect(textoPantalla()).not.toContain('Segunda acción de prueba')
  })
})

describe('guías de tamaños distintos', () => {
  it.each([
    [1, 0, 0, 0],
    [2, 1, 1, 0],
    [4, 2, 1, 1],
    [7, 1, 2, 0],
  ])('%i acciones, %i precauciones, %i críticas, %i comprobaciones: se recorren hasta terminar', async (acciones, precauciones, criticas, comprobaciones) => {
    const nombres = Array.from({ length: acciones }, (_, i) => `Acción ${i + 1} de prueba`)
    const extras: BloquePaso[] = []
    for (let i = 0; i < precauciones; i += 1) extras.push(aviso(`pre-${i}`, 'precaucion', `Cuidado ${i + 1} de prueba.`, 'tam-p1-t1'))
    for (let i = 0; i < criticas; i += 1) extras.push(aviso(`cri-${i}`, 'importante', `Crítica ${i + 1} de prueba.`, 'tam-p1-t1'))
    for (let i = 0; i < comprobaciones; i += 1) extras.push(comprobacion(`tam-p1-c${i}`, `Comprobación ${i + 1} de prueba`))
    await sembrarGuia({
      id: 'guia-tam',
      titulo: 'Guía de prueba de tamaños',
      pasos: [ventana('tam-p1', 'Ventana de prueba', nombres, extras), ventana('tam-p2', 'Cierre de prueba', ['Cierra todo'])],
    })
    await montar(RUTAS, ruta('guia-tam'), { modo: 'ventana' })
    await enLaVentana('Acción 1 de prueba')

    expect(instrucciones()).toHaveLength(acciones)
    expect(document.body.querySelectorAll('[data-aviso-ventana="precaucion"]')).toHaveLength(precauciones)
    expect(document.body.querySelectorAll('[data-aviso-ventana="critica"]')).toHaveLength(criticas)
    expect(document.body.querySelectorAll('[data-comprobacion-ventana]')).toHaveLength(comprobaciones)

    // Una confirmación por cada crítica, ni más ni menos; "Listo" solo con todas.
    for (let i = 0; i < criticas; i += 1) {
      expect(piePrincipal()?.getAttribute('aria-disabled')).toBe('true')
      const botones = Array.from(document.body.querySelectorAll<HTMLElement>('[data-aviso-ventana="critica"] button')).filter(
        (b) => b.getAttribute('aria-pressed') === 'false',
      )
      await tocar(botones[0])
    }
    await esperar(() => piePrincipal()?.getAttribute('aria-disabled') === 'false', 'la ventana disponible')
    await tocarPrincipal()
    await enLaVentana('Cierra todo')
    await tocarPrincipal()
    await esperar(() => textoPantalla().includes('Guía completada'), 'la guía terminada')
    expect((await progreso('guia-tam'))?.pasosHechos).toEqual(['tam-p1', 'tam-p2'])
  })
})
