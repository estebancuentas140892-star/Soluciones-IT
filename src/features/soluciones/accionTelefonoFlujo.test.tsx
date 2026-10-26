// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type BloquePaso, type OpcionDecision, type PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { leerModoEjecucion } from '../../lib/preferenciasEjecucion'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  ponerAncho,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// UNA ACCIÓN POR PANTALLA EN EL TELÉFONO, CON LAS PANTALLAS DE VERDAD (tarea
// 355, «Equilibrada esencial» de Claude Design, AD-098). Por debajo de 768 px:
//
//   - sin preferencia guardada, la guía abre en su primera acción, sin
//     pantallas previas, y enseña una sola acción;
//   - en pantalla, solo lo de la sección 5 de la especificación, cada cosa en
//     su condición: dónde, el riesgo, «Comprueba», la instrucción, «Cómo
//     hacerlo», el dato técnico, la credencial, «Debes ver» y «No se cumple»
//     de una comprobación, la pregunta y el botón de la ayuda;
//   - «Ayuda con este paso» con sus secciones en su orden, nunca vacías, y la
//     etiqueta de los requisitos solo en la primera acción y sin avance;
//   - los riesgos como en la ventana: texto completo, «Confirmo que la leí»
//     solo en la crítica y, mientras falte, «Listo» con `aria-disabled` y una
//     frase que dice qué falta;
//   - «Ver el paso entero» del índice lleva a la ventana por paso y «Volver a
//     una acción a la vez» regresa, y la preferencia se guarda;
//   - desde 768, la acción a la vez de siempre.
//
// Todo lo sembrado es inventado.

// Las imágenes se dan por resueltas, como en ejecucionMinima.test.tsx.
vi.mock('../../components/useUrlAdjunto', () => ({
  useUrlAdjunto: (referencia: string | null) => (referencia ? `blob:prueba/${referencia}` : null),
}))

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <p>DETALLES DE LA GUÍA</p> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]
const ruta = (id: string) => `/soluciones/cat-pruebas/${id}`

const ACCION_1 = 'Abre el programa de prueba'
const ACCION_2 = 'Escribe el dato nuevo'
const ACCION_3 = 'Pulsa Guardar'
const COMPRUEBA = 'Comprueba que la caja muestra el dato'

function bloque(parcial: Partial<BloquePaso> & { id: string }): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, tipo: 'tarea', ...parcial }
}

function avisoDe(id: string, tareaId: string, tono: BloquePaso['tono'], texto: string): BloquePaso {
  return bloque({ id, tipo: 'aviso', tono, texto, alcance: 'tarea', tareaId })
}

const imagen = (referencia: string) => ({ referencia, nombre: `${referencia}.png`, tipo: 'image/png' })

/** La guía del caso: un paso con tres acciones y lo que las acompaña, y una comprobación. */
async function sembrarCaso(): Promise<void> {
  await sembrarGuia({ id: 'guia-consulta', titulo: 'Guía de consulta de prueba', pasos: [pasoPrueba('gc-p1', 'Leer', ['Lee la consulta de prueba'])] })
  await sembrarGuia({
    id: 'guia-contingencia',
    titulo: 'Guía de contingencia de prueba',
    pasos: [pasoPrueba('gk-p1', 'Reparar', ['Repara la prueba'])],
  })
  const paso1: PasoProcedimiento = {
    ...pasoPrueba('un-p1', 'Cambiar el dato de prueba', []),
    lugar: 'Programa de prueba',
    objetivo: 'Que la caja use el dato del documento',
    vinculoProtegido: { tipo: 'credencial', id: 'cred-programa', titulo: 'Acceso de prueba al programa' },
    bloques: [
      bloque({
        id: 'un-t1',
        texto: ACCION_1,
        comoHacer: [
          { id: 'un-m1', accion: 'Pulsa', elemento: 'Inicio' },
          { id: 'un-m2', accion: 'Abre', elemento: 'el programa de prueba', ubicacion: 'Menú de aplicaciones' },
        ],
      }),
      avisoDe('un-info', 'un-t1', 'info', 'Explicación de prueba del campo'),
      bloque({ id: 'un-img', tipo: 'imagen', texto: 'La ventana de prueba', adjunto: imagen('captura-prueba'), alcance: 'tarea', tareaId: 'un-t1' }),
      bloque({ id: 'un-t2', texto: ACCION_2, resultadoVisual: { adjunto: imagen('resultado-prueba') } }),
      avisoDe('un-dato', 'un-t2', 'dato', 'Formato de prueba: EJ-0000'),
      bloque({ id: 'un-t3', texto: ACCION_3 }),
      avisoDe('un-critica', 'un-t3', 'importante', 'Guardar reemplaza el dato anterior de prueba'),
      bloque({ id: 'un-consulta', tipo: 'guia', guiaArticuloId: 'guia-consulta', guiaArticuloTitulo: 'Guía de consulta de prueba', intencionGuia: 'consulta', alcance: 'tarea', tareaId: 'un-t3' }),
      bloque({ id: 'un-contingencia', tipo: 'guia', guiaArticuloId: 'guia-contingencia', guiaArticuloTitulo: 'Guía de contingencia de prueba', intencionGuia: 'contingencia', alcance: 'tarea', tareaId: 'un-t3' }),
    ],
  }
  const paso2: PasoProcedimiento = {
    ...pasoPrueba('un-p2', 'Comprobar el cambio de prueba', []),
    bloques: [
      bloque({ id: 'un-c1', texto: COMPRUEBA, tipoTarea: 'verificacion', resultadoVisual: { adjunto: imagen('debes-ver-prueba') } }),
      avisoDe('un-precaucion', 'un-c1', 'precaucion', 'La caja de prueba tarda en refrescar'),
    ],
  }
  await sembrarGuia({
    id: 'guia-una',
    titulo: 'Cambiar un dato de la caja de prueba',
    pasos: [paso1, paso2],
    procedimiento: {
      descripcion: 'Usa esta guía cuando la caja de prueba tenga el dato viejo.',
      objetivoGeneral: 'Dejar el dato de prueba cambiado.',
      requisitos: ['Documento de prueba con el dato', 'Usuario de prueba con permisos'],
      verificacionFinal: ['La caja de prueba muestra el dato nuevo'],
    },
  })
}

// --- lo que se ve y se toca ---------------------------------------------

function instruccion(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-instruccion-telefono]')
}

function principal(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-accion-pie]')
}

function etiquetaPrincipal(): string {
  return (principal()?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function lineaDeCabecera(): string {
  return (document.body.querySelector('[data-paso-en-cabecera]')?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function seccionesDeLaAyuda(): string[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-seccion-ayuda]')).map((s) => s.dataset.seccionAyuda ?? '')
}

async function enLaAccion(texto: string): Promise<void> {
  await esperar(() => instruccion()?.textContent === texto, `la acción «${texto}»`)
}

async function abrirAyuda(): Promise<HTMLElement> {
  await tocar(await esperar(() => document.body.querySelector<HTMLElement>('[data-ayuda-paso]'), 'el botón de la ayuda'))
  return esperar(() => document.body.querySelector<HTMLElement>('[data-hoja-ayuda]'), 'la hoja de la ayuda')
}

async function cerrarAyuda(): Promise<void> {
  await tocar(await esperarControl('Cerrar la ayuda y volver a la acción'))
  await esperar(() => document.body.querySelector('[role="dialog"]') === null, 'la ayuda cerrada')
}

async function listo(): Promise<void> {
  const boton = principal()
  if (!boton) throw new Error('No hay botón principal en el pie.')
  await tocar(boton)
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('abrir la guía en el teléfono', () => {
  it('sin preferencia, abre en su primera acción: sin pantallas previas y una sola acción', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'), { modo: 'defecto' })
    await enLaAccion(ACCION_1)

    expect(await leerModoEjecucion('foco')).toBe('foco')
    expect(document.body.querySelector('[data-accion-telefono]')).not.toBeNull()
    expect(document.body.querySelector('[data-marco-ventana]')).toBeNull()
    const texto = textoPantalla()
    // Ni orientar ni preparar: la guía abre trabajando (regla 31 g).
    expect(texto).not.toContain('Qué vas a hacer')
    expect(control('Ver lo que necesitas')).toBeNull()
    expect(document.body.querySelector('[data-antes-de-empezar]')).toBeNull()
    // Una sola acción por pantalla.
    expect(texto).not.toContain(ACCION_2)
    expect(texto).not.toContain(ACCION_3)
    expect(etiquetaPrincipal()).toBe('Listo · Siguiente')
  })

  it('en pantalla, solo lo necesario: dónde, la instrucción con su tamaño, «Cómo hacerlo», la credencial y el botón de la ayuda', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'))
    await enLaAccion(ACCION_1)

    expect(document.body.querySelector('[data-donde]')?.textContent).toContain('Programa de prueba')
    // 26 caracteres: 26 px (sección 8), nunca recortada.
    expect(instruccion()?.className).toContain('text-[26px]')
    expect(instruccion()?.className).not.toMatch(/truncate|line-clamp/)
    expect(textoPantalla()).toContain('Cómo hacerlo')
    expect(textoPantalla()).toContain('Menú de aplicaciones')
    // La credencial del paso, en línea y en su primera acción (regla 29).
    expect(textoPantalla()).toContain('Credencial necesaria')
    expect(control(/^Ver la credencial: /)).toBeNull()
    expect(document.body.querySelector('[data-ten-a-mano]')?.textContent).toBe('Ten a mano 2 cosas')

    // Lo que acompaña NO está a la vista (criterio 2).
    const texto = textoPantalla()
    for (const fuera of [
      'Explicación de prueba del campo',
      'La ventana de prueba',
      'Que la caja use el dato del documento',
      'Lo que sigue',
      'Documento de prueba con el dato',
      'Guía de consulta de prueba',
    ]) {
      expect(texto, fuera).not.toContain(fuera)
    }
  })

  it('la cabecera: «Tengo un problema» de 44, el índice y la línea con el paso, la acción y el equipo', async () => {
    await sembrarCaso()
    await sembrarEquipo({ id: 'eq-una', nombre: 'CAJA-PRUEBA-01' })
    await montar(RUTAS, `${ruta('guia-una')}?equipo=eq-una`)
    await enLaAccion(ACCION_1)

    await esperar(() => lineaDeCabecera().includes('CAJA-PRUEBA-01'), 'el equipo en la línea')
    expect(lineaDeCabecera()).toBe('Paso 1 de 2 · acción 1 de 3 · CAJA-PRUEBA-01')
    const problema = await esperarControl('Tengo un problema con esta acción: ver las salidas')
    expect(problema.className).toContain('h-11')
    expect(problema.className).toContain('w-11')
    expect(control(/^Paso 1 de 2\. Abrir el índice de pasos$/)?.textContent).toBe('Índice')
  })
})

describe('«Ayuda con este paso»', () => {
  it('se abre a pedido con sus secciones en su orden, sin ninguna vacía, y cerrarla no marca nada', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'))
    await enLaAccion(ACCION_1)

    const hoja = await abrirAyuda()
    const dialogo = hoja.closest('[role="dialog"]') as HTMLElement
    expect(dialogo.textContent).toContain('Ayuda con este paso')
    expect(dialogo.querySelector('h2')?.textContent).toBe(ACCION_1)
    expect(seccionesDeLaAyuda()).toEqual(['requisitos', 'imagenes', 'paraQue', 'notas', 'loQueSigue'])
    expect(hoja.textContent).toContain('Documento de prueba con el dato')
    expect(hoja.textContent).toContain('La ventana de prueba')
    expect(hoja.textContent).toContain('Que la caja use el dato del documento')
    expect(hoja.textContent).toContain('Información. Explicación de prueba del campo')
    expect(document.body.querySelector('[data-seccion-ayuda="loQueSigue"]')?.textContent).toContain(ACCION_2)
    for (const seccion of document.body.querySelectorAll('[data-seccion-ayuda]')) {
      expect(seccion.textContent?.trim().length).toBeGreaterThan(0)
    }

    await cerrarAyuda()
    expect(instruccion()?.textContent).toBe(ACCION_1)
    expect(await db.progresoPasos.get('guia-una')).toBeUndefined()
  })

  it('si el primer paso hace otra guía en el sitio, los requisitos de la guía que se abrió llegan a su primera acción', async () => {
    await sembrarGuia({
      id: 'guia-acceso',
      titulo: 'Entrar al programa de prueba',
      pasos: [pasoPrueba('ac-p1', 'Entrar', ['Entra al programa de prueba'])],
      procedimiento: { requisitos: ['Red de prueba de la guía reutilizada'] },
    })
    await sembrarGuia({
      id: 'guia-con-acceso',
      titulo: 'Registrar a una persona de prueba',
      pasos: [
        { ...pasoPrueba('ca-p1', 'Entrar al programa', []), subArticuloId: 'guia-acceso', subArticuloTitulo: 'Entrar al programa de prueba' },
        pasoPrueba('ca-p2', 'Guardar', ['Selecciona Guardar']),
      ],
      procedimiento: { requisitos: ['Datos de la persona de prueba'] },
    })
    await montar(RUTAS, ruta('guia-con-acceso'))
    await enLaAccion('Entra al programa de prueba')

    expect(document.body.querySelector('[data-ten-a-mano]')?.textContent).toBe('Ten a mano 1 cosa')
    const hoja = await abrirAyuda()
    expect(hoja.textContent).toContain('Datos de la persona de prueba')
    // Lo que pide la guía reutilizada no pasa solo (regla 25 f).
    expect(hoja.textContent).not.toContain('Red de prueba de la guía reutilizada')
  })

  it('«No sale como dice» abre las salidas de siempre, sin cerrar ni marcar nada', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'))
    await enLaAccion(ACCION_1)
    await abrirAyuda()

    await tocar(await esperarControl('No sale como dice: tengo un problema'))
    const hoja = await esperar(
      () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"]')).find((d) => d.textContent?.includes('Algo va mal')) ?? null,
      'la hoja de las salidas',
    )
    expect(hoja.textContent).toContain(`En «${ACCION_1}».`)
    expect(document.body.querySelector('[data-hoja-ayuda]')).toBeNull()
    expect(await db.progresoPasos.get('guia-una')).toBeUndefined()
  })
})

describe('una acción por pantalla, un «Listo» por acción', () => {
  it('«Listo» marca la acción y trae la siguiente; la etiqueta de requisitos se va con el avance y «Dónde» sigue', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'))
    await enLaAccion(ACCION_1)

    await listo()
    await enLaAccion(ACCION_2)
    expect((await db.progresoPasos.get('guia-una'))?.instruccionesHechas).toEqual(['un-t1'])
    expect(lineaDeCabecera()).toBe('Paso 1 de 2 · acción 2 de 3')
    expect(document.body.querySelector('[data-donde]')?.textContent).toContain('Programa de prueba')
    expect(document.body.querySelector('[data-ten-a-mano]')).toBeNull()
    // El dato técnico, a la vista; la credencial del paso ya no (solo con su
    // primera acción); la imagen del resultado de una acción, en la ayuda.
    expect(textoPantalla()).toContain('Formato de prueba: EJ-0000')
    expect(textoPantalla()).not.toContain('Credencial necesaria')
    expect(textoPantalla()).not.toContain('Debes ver')

    await abrirAyuda()
    expect(seccionesDeLaAyuda()).toEqual(['funciono', 'loQueSigue'])
    expect(document.body.querySelector('[data-seccion-ayuda="loQueSigue"]')?.textContent).toContain(ACCION_3)
    await cerrarAyuda()

    // «Anterior» vuelve a la acción hecha sin desmarcarla, con su marca.
    await tocar(await esperarControl(/^Anterior\. Solo mueve la vista/))
    await enLaAccion(ACCION_1)
    expect(document.body.querySelector('[role="img"][aria-label="Completada"]')).not.toBeNull()
    expect(etiquetaPrincipal()).toBe('Ir a la acción 2')
    expect((await db.progresoPasos.get('guia-una'))?.instruccionesHechas).toEqual(['un-t1'])
  })

  it('la advertencia crítica va antes de la instrucción, entera; sin confirmarla «Listo» no está disponible y lo dice', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'))
    await enLaAccion(ACCION_1)
    await listo()
    await enLaAccion(ACCION_2)
    await listo()
    await enLaAccion(ACCION_3)

    const critica = document.body.querySelector<HTMLElement>('[data-aviso-ventana="critica"]')
    expect(critica?.textContent).toContain('Advertencia crítica')
    expect(critica?.textContent).toContain('Guardar reemplaza el dato anterior de prueba')
    expect(critica?.compareDocumentPosition(instruccion()!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(principal()?.getAttribute('aria-disabled')).toBe('true')
    expect(etiquetaPrincipal()).toBe('Falta confirmar la advertencia')
    expect(document.body.querySelector('[data-no-disponible]')?.textContent).toBe(
      'Confirma la advertencia crítica de arriba para poder seguir.',
    )

    // Tocarlo apagado no marca nada.
    await listo()
    expect((await db.progresoPasos.get('guia-una'))?.instruccionesHechas).toEqual(['un-t1', 'un-t2'])

    await tocar(await esperarControl('Confirmo que la leí'))
    await esperar(() => principal()?.getAttribute('aria-disabled') === 'false', '«Listo» disponible')
    expect(etiquetaPrincipal()).toBe('Listo · Siguiente')
    await listo()
    await enLaAccion(COMPRUEBA)
    expect(lineaDeCabecera()).toBe('Paso 2 de 2')
  })

  it('las guías de consulta van en la ayuda y las de contingencia, con las salidas de «Tengo un problema»', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'))
    await enLaAccion(ACCION_1)
    await listo()
    await enLaAccion(ACCION_2)
    await listo()
    await enLaAccion(ACCION_3)
    expect(textoPantalla()).not.toContain('Guía de consulta de prueba')
    expect(textoPantalla()).not.toContain('Guía de contingencia de prueba')

    const ayuda = await abrirAyuda()
    expect(seccionesDeLaAyuda()).toEqual(['consulta', 'loQueSigue'])
    await esperar(() => ayuda.textContent?.includes('Guía de consulta de prueba'), 'la guía de consulta')
    expect(ayuda.textContent).toContain('se abre aparte')
    expect(ayuda.textContent).not.toContain('Guía de contingencia de prueba')
    expect(document.body.querySelector('[data-seccion-ayuda="loQueSigue"]')?.textContent).toContain(COMPRUEBA)
    await cerrarAyuda()

    await tocar(await esperarControl('Tengo un problema con esta acción: ver las salidas'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'las salidas')
    expect(hoja.textContent).toContain(`En «${ACCION_3}».`)
    await esperar(() => hoja.textContent?.includes('Guía de contingencia de prueba'), 'la contingencia de la acción')
  })

  it('la comprobación: «Comprueba», la precaución que no pide nada, «Debes ver» y «No se cumple»; y después, el cierre del teléfono', async () => {
    await sembrarCaso()
    await db.progresoPasos.put({
      articuloId: 'guia-una',
      pasosHechos: ['un-p1'],
      instruccionesHechas: ['un-t1', 'un-t2', 'un-t3'],
      verificacionHecha: [],
      actualizadoEn: '2026-10-26T12:00:00.000Z',
    })
    await montar(RUTAS, ruta('guia-una'))
    await enLaAccion(COMPRUEBA)

    expect(textoPantalla()).toContain('Comprueba')
    const precaucion = document.body.querySelector<HTMLElement>('[data-aviso-ventana="precaucion"]')
    expect(precaucion?.textContent).toContain('La caja de prueba tarda en refrescar')
    expect(control('Confirmo que la leí')).toBeNull()
    expect(document.body.querySelector('[data-parte-accion="debes ver"]')).not.toBeNull()

    await tocar(await esperarControl('No se cumple'))
    const hoja = await esperar(() => document.body.querySelector<HTMLElement>('[role="dialog"]'), 'las salidas')
    expect(hoja.textContent).toContain(`En «${COMPRUEBA}».`)
    await tocar(await esperarControl('Cancelar'))
    await esperar(() => document.body.querySelector('[role="dialog"]') === null, 'las salidas cerradas')
    expect((await db.progresoPasos.get('guia-una'))?.instruccionesHechas).not.toContain('un-c1')

    expect(etiquetaPrincipal()).toBe('Listo · Comprobar el resultado')
    await listo()
    // El final del teléfono es el de siempre (regla 31 h), con lo recorrido en pasos.
    await esperar(() => textoPantalla().includes('¿El problema quedó resuelto?'), 'el cierre del teléfono')
    expect(textoPantalla()).toContain('2 pasos hechos')
    await tocar(await esperarControl('Anterior. Vuelve a la última acción, sin cambiar lo marcado'))
    await enLaAccion(COMPRUEBA)
  })
})

describe('las preguntas', () => {
  const opcion = (id: string, titulo: string, descripcion: string): OpcionDecision => ({
    id,
    titulo,
    descripcion,
    destino: { tipo: 'continuar' },
  })

  it('la de Sí/No se responde en el pie, sin repetir la pregunta, y el «No» dice a dónde lleva', async () => {
    await sembrarGuia({ id: 'guia-consulta', titulo: 'Guía de consulta de prueba', pasos: [pasoPrueba('gc-p1', 'Leer', ['Lee la consulta de prueba'])] })
    await sembrarGuia({
      id: 'guia-sino',
      titulo: 'Guía de prueba con una pregunta',
      pasos: [
        {
          ...pasoPrueba('sn-p1', 'Revisar la caja de prueba', []),
          bloques: [
            bloque({
              id: 'sn-d1',
              texto: '¿La caja de prueba enciende?',
              tipoTarea: 'decision',
              decisionArticuloId: 'guia-consulta',
              decisionArticuloTitulo: 'Guía de consulta de prueba',
            }),
          ],
        },
      ],
    })
    await montar(RUTAS, ruta('guia-sino'))
    await enLaAccion('¿La caja de prueba enciende?')

    const respuestas = Array.from(document.body.querySelectorAll<HTMLElement>('[data-pie-ventana] [data-respuesta-ventana]'))
    expect(respuestas.map((r) => r.textContent)).toEqual(['Sí', 'NoSigues con «Guía de consulta de prueba»'])
    expect(principal()).toBeNull()
    // La pregunta es la instrucción: no se repite en el pie.
    expect(document.body.querySelector('[data-pie-ventana]')?.textContent).not.toContain('¿La caja de prueba enciende?')

    await tocar(respuestas[0])
    await esperar(() => textoPantalla().includes('Guía completada'), 'la guía terminada')
  })

  it('con más de tres respuestas, se quedan en la pantalla y el pie dice que hay que responder', async () => {
    await sembrarGuia({
      id: 'guia-opciones',
      titulo: 'Guía de prueba con cuatro respuestas',
      pasos: [
        {
          ...pasoPrueba('op-p1', 'Elegir la versión de prueba', []),
          bloques: [
            bloque({
              id: 'op-d1',
              texto: '¿Qué versión de prueba usas?',
              tipoTarea: 'decision',
              opciones: [
                opcion('op-a', 'Versión A', 'La de prueba A'),
                opcion('op-b', 'Versión B', 'La de prueba B'),
                opcion('op-c', 'Versión C', 'La de prueba C'),
                opcion('op-d', 'Versión D', 'La de prueba D'),
              ],
            }),
          ],
        },
      ],
    })
    await montar(RUTAS, ruta('guia-opciones'))
    await enLaAccion('¿Qué versión de prueba usas?')

    expect(document.body.querySelectorAll('[data-pie-ventana] [data-respuesta-ventana]')).toHaveLength(0)
    expect(document.body.querySelector('[data-decision-ventana="pendiente"]')?.textContent).toContain('Versión D')
    expect(principal()?.getAttribute('aria-disabled')).toBe('true')
    expect(etiquetaPrincipal()).toBe('Responde la pregunta')
  })
})

describe('la ventana por paso, como opción del índice', () => {
  it('«Ver el paso entero» lleva a la ventana y «Volver a una acción a la vez» regresa; la preferencia se guarda', async () => {
    await sembrarCaso()
    await montar(RUTAS, ruta('guia-una'), { modo: 'defecto' })
    await enLaAccion(ACCION_1)

    await tocar(await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/))
    await tocar(await esperarControl('Ver el paso entero'))
    await esperar(() => document.body.querySelector('[data-marco-ventana]'), 'la ventana')
    expect(textoPantalla()).toContain(ACCION_2)
    expect(await leerModoEjecucion('foco')).toBe('ventana')

    await tocar(await esperarControl(/^Ventana 1 de 2\. Abrir el índice de ventanas$/))
    await tocar(await esperarControl('Volver a una acción a la vez'))
    await enLaAccion(ACCION_1)
    expect(document.body.querySelector('[data-marco-ventana]')).toBeNull()
    expect(await leerModoEjecucion('ventana')).toBe('foco')
  })
})

describe('desde 768, nada cambia', () => {
  it('la tableta abre con sus dos pantallas previas y la acción a la vez de siempre', async () => {
    await sembrarCaso()
    ponerAncho('tableta')
    await montar(RUTAS, ruta('guia-una'), { modo: 'defecto' })
    await esperar(() => textoPantalla().includes('Qué vas a hacer'), 'la orientación')
    expect(document.body.querySelector('[data-accion-telefono]')).toBeNull()
    expect(document.body.querySelector('[data-ayuda-paso]')).toBeNull()
  })
})
