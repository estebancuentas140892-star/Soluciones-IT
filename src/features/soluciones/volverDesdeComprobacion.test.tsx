// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  db,
  type BloquePaso,
  type MicroPasoComoHacer,
  type OpcionDecision,
  type PasoProcedimiento,
  type ProgresoPasos,
} from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS, normalizarProcedimiento } from '../../lib/procedimiento'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
import {
  control,
  desmontarTodo,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { accionDeGuia } from './accionGuia'
import { guiaTerminada } from './cierrePaso'
import { GuiaPage } from './GuiaPage'
import { ProcedimientoVista } from './ProcedimientoVista'
import { ProveedorEjecucion } from './ProveedorEjecucion'

// VOLVER DESDE LA COMPROBACIÓN FINAL (tarea 308).
//
// "Antes de terminar, comprueba" era la vista sin paso de la ejecución
// (`indiceActual` null) y no tenía pie: quien pulsaba "Siguiente" por error
// en la última acción quedaba atrapado ahí, sin poder revisar lo que acababa
// de hacer. Ahora es un estado más de la ejecución, con tres conceptos que no
// se mezclan:
//
//   - "Siguiente" desde la última acción entra a la comprobación final, y
//     entrar no termina nada;
//   - "Anterior" vuelve a la última acción realmente recorrida (por la ruta
//     de las respuestas, nunca la anterior en la lista de la guía), sin
//     desmarcar ni cambiar nada;
//   - solo "Finalizar" termina la ejecución.
//
// Se recorre con la pantalla de verdad (`GuiaPage`). Todo lo sembrado es
// INVENTADO.

// La imagen de "Debes ver" se da por resuelta, como en ejecucionMinima.
vi.mock('../../components/useUrlAdjunto', () => ({
  useUrlAdjunto: (referencia: string | null) => (referencia ? `blob:prueba/${referencia}` : null),
}))

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

const COMPROBACION = 'Antes de terminar, comprueba'

// LA GUÍA LINEAL: A → B → C, con C de dos acciones; la segunda trae todo lo
// que la ejecución enseña (riesgo, "Cómo hacerlo" numerado, dato técnico y
// "Debes ver"), para comprobar que al volver sigue ahí.
const RUTA_LINEAL = '/soluciones/cat-pruebas/guia-lineal'
const ACCION_A = 'Abre el programa de correo de prueba'
const ACCION_B = 'Abre Importar y exportar de prueba'
const ACCION_C1 = 'Elige Archivo de datos de prueba'
const ACCION_C2 = 'Guarda el archivo en la carpeta de respaldos de prueba'
const RIESGO = 'Si la carpeta de prueba se llena, el archivo queda incompleto'
const DATO = 'Respaldo-de-prueba.pst'
const COMO: MicroPasoComoHacer[] = [
  { id: 'lin-m1', accion: 'Pulsa', elemento: 'Examinar' },
  { id: 'lin-m2', accion: 'Elige', elemento: 'Respaldos', ubicacion: 'Panel izquierdo' },
]
const COMPROBACIONES = [
  'El archivo de prueba aparece en la carpeta de respaldos',
  'El tamaño del archivo de prueba es mayor que cero',
]

function aviso(id: string, tono: BloquePaso['tono'], texto: string, tareaId: string): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', texto, tono, alcance: 'tarea', tareaId }
}

function pasosLineales(): PasoProcedimiento[] {
  const c = pasoPrueba('lin-c', 'Guardar el archivo de prueba', [ACCION_C1, ACCION_C2])
  return [
    pasoPrueba('lin-a', 'Abrir el programa de correo de prueba', [ACCION_A]),
    pasoPrueba('lin-b', 'Abrir la exportación de prueba', [ACCION_B]),
    {
      ...c,
      bloques: [
        c.bloques[0],
        aviso('lin-riesgo', 'precaucion', RIESGO, 'lin-c-t2'),
        {
          ...c.bloques[1],
          comoHacer: COMO,
          resultadoVisual: {
            adjunto: { referencia: 'pruebas/1700000010-respaldo.png', nombre: 'respaldo.png', tipo: 'image/png' },
            descripcion: 'La carpeta de respaldos de prueba con el archivo',
          },
        },
        aviso('lin-dato', 'dato', DATO, 'lin-c-t2'),
      ],
    },
  ]
}

async function sembrarLineal(): Promise<void> {
  await sembrarGuia({
    id: 'guia-lineal',
    titulo: 'Respaldar un buzón de prueba',
    pasos: pasosLineales(),
    procedimiento: { verificacionFinal: COMPROBACIONES },
  })
}

// LA GUÍA CON DECISIÓN: A → Decide; "Sí" lleva a C → D (y ahí termina), "No"
// lleva a F → G. En la lista de la guía D está justo antes de F, y C antes
// de D: volver "al anterior de la lista" sería un error en los dos caminos.
const RUTA_DECISION = '/soluciones/cat-pruebas/guia-decision'

function decision(id: string, texto: string, opciones: OpcionDecision[]): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto, tipoTarea: 'decision', opciones }
}

async function sembrarDecision(): Promise<void> {
  const decide = pasoPrueba('dec-decide', 'Decidir el camino de prueba', [])
  decide.bloques.push(
    decision('dec-pregunta', '¿El equipo de prueba ya tiene el programa?', [
      { id: 'dec-si', titulo: 'Sí', descripcion: '', destino: { tipo: 'paso', pasoId: 'dec-c' } },
      { id: 'dec-no', titulo: 'No', descripcion: '', destino: { tipo: 'paso', pasoId: 'dec-f' } },
    ]),
  )
  await sembrarGuia({
    id: 'guia-decision',
    titulo: 'Preparar un equipo de prueba',
    pasos: [
      pasoPrueba('dec-a', 'Encender el equipo de prueba', ['Enciende el equipo de prueba']),
      decide,
      pasoPrueba('dec-c', 'Abrir el programa de prueba', ['Abre el programa de prueba (camino Sí)']),
      { ...pasoPrueba('dec-d', 'Configurar el programa de prueba', ['Configura el programa de prueba (camino Sí)']), alTerminar: { tipo: 'fin' } },
      pasoPrueba('dec-f', 'Descargar el programa de prueba', ['Descarga el programa de prueba (camino No)']),
      pasoPrueba('dec-g', 'Instalar el programa de prueba', ['Instala el programa de prueba (camino No)']),
    ],
    procedimiento: { verificacionFinal: ['El programa de prueba abre sin errores'] },
  })
}

/** El control grande del pie, por su rótulo exacto. */
function principal(texto: string): HTMLElement | null {
  return control(new RegExp(`^${texto}$`))
}

/** Una acción de riesgo pendiente llega por su advertencia previa (tarea 311): se lee y se sigue. */
async function pasarLaAdvertencia(): Promise<void> {
  const boton = principal('Entiendo, continuar')
  if (boton) await tocar(boton)
}

async function completar(texto: string): Promise<void> {
  await esperar(() => textoPantalla().includes(texto), `la acción «${texto}»`)
  await pasarLaAdvertencia()
  await tocar(await esperar(() => principal('Completar y seguir'), `"Completar y seguir" en «${texto}»`))
}

function casillas(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="checkbox"]'))
}

/** El "Anterior" del pie, el mismo control en cada acción y en la comprobación. */
function anterior(): Promise<HTMLElement> {
  return esperarControl(/^Anterior/)
}

async function enLaComprobacion(): Promise<void> {
  await esperar(() => textoPantalla().includes(COMPROBACION), 'la comprobación final')
}

async function fila(id: string): Promise<ProgresoPasos | undefined> {
  return db.progresoPasos.get(id)
}

/** ¿La ejecución guardada está terminada, con la regla de toda la app? */
async function terminada(id: string): Promise<boolean> {
  const articulo = await db.articulos.get(id)
  const procedimiento = normalizarProcedimiento(articulo?.procedimiento ?? null)
  const avance = await fila(id)
  if (!procedimiento) throw new Error('sin procedimiento')
  return guiaTerminada(
    procedimiento,
    avance?.pasosHechos,
    avance?.verificacionHecha,
    avance?.elecciones,
    avance?.cierrePendiente,
  )
}

/** Recorre la guía lineal hasta la comprobación final. */
async function lineaHastaLaComprobacion(): Promise<void> {
  await completar(ACCION_A)
  await completar(ACCION_B)
  await completar(ACCION_C1)
  await esperar(() => textoPantalla().includes(ACCION_C2), 'la última acción')
  // La última acción ya no promete terminar: lleva a la comprobación.
  expect(principal('Completar y terminar')).toBeNull()
  await completar(ACCION_C2)
  await enLaComprobacion()
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('guía lineal: A → B → C → comprobación final', () => {
  it('entrar a la comprobación no termina nada, y tiene "Anterior" y el control de cierre en su pie', async () => {
    await sembrarLineal()
    await montar(RUTAS, RUTA_LINEAL)
    await lineaHastaLaComprobacion()

    expect(textoPantalla()).not.toContain('Guía terminada')
    const avance = await fila('guia-lineal')
    expect(avance?.pasosHechos).toEqual(['lin-a', 'lin-b', 'lin-c'])
    expect(avance?.verificacionHecha).toEqual([])
    expect(avance?.cierrePendiente).toBeFalsy()
    expect(await terminada('guia-lineal')).toBe(false)

    // "Anterior" es una navegación principal: el mismo botón de 64 px de cada
    // acción, en el pie pegajoso, activo.
    const boton = await anterior()
    expect(boton.hasAttribute('disabled')).toBe(false)
    expect(boton.className).toContain('h-16')
    expect(boton.className).toContain('w-16')
    expect(boton.closest('.sticky')).not.toBeNull()
    // Con casillas sin marcar, el control dice cuántas faltan, inactivo.
    const cierre = principal('Faltan 2 comprobaciones')
    expect(cierre?.hasAttribute('disabled')).toBe(true)
    expect(cierre?.className).toContain('h-16')
    expect(principal('Finalizar')).toBeNull()
    // La pantalla sigue siendo la de siempre: el título y sus casillas.
    expect(casillas()).toHaveLength(2)
    for (const texto of COMPROBACIONES) expect(textoPantalla()).toContain(texto)
  })

  it('"Anterior" vuelve a C por su última acción, sin tocar nada, y "Seguir" vuelve a la comprobación', async () => {
    await sembrarLineal()
    await montar(RUTAS, RUTA_LINEAL)
    await lineaHastaLaComprobacion()
    const antes = await fila('guia-lineal')

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_C2), 'la última acción de C')
    expect(textoPantalla()).not.toContain(COMPROBACION)
    expect(textoPantalla()).toContain('acción 2 de 2')
    // C sigue hecha: la marca discreta, sin palabra (tarea 307).
    expect(document.body.querySelector('[role="img"][aria-label="Completada"]')).not.toBeNull()
    // Se puede revisar todo lo de la acción: cómo hacerla, el dato y la imagen.
    // Su riesgo ya no va bajo la instrucción (tarea 311): está un "Anterior"
    // más atrás, en su advertencia previa, sin bloquear la revisión.
    expect(textoPantalla()).not.toContain(RIESGO)
    expect(textoPantalla()).toContain('Cómo hacerlo')
    expect(textoPantalla()).toContain('Pulsa Examinar.')
    expect(textoPantalla()).toContain('Panel izquierdo')
    expect(textoPantalla()).toContain('Dato técnico')
    expect(textoPantalla()).toContain(DATO)
    expect(textoPantalla()).toContain('Debes ver')
    // Volver solo movió la vista: el avance guardado es exactamente el mismo.
    expect(await fila('guia-lineal')).toEqual(antes)

    // Y su riesgo sigue a mano: "Anterior" enseña su advertencia, y "Entiendo,
    // continuar" vuelve a la acción hecha sin tocar nada.
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('Precaución. Antes de continuar'), 'la advertencia de C2')
    expect(textoPantalla()).toContain(RIESGO)
    await tocar(await esperar(() => principal('Entiendo, continuar'), '"Entiendo, continuar"'))
    await esperar(() => textoPantalla().includes(ACCION_C2) && principal('Seguir') !== null, 'C2 otra vez')
    expect(await fila('guia-lineal')).toEqual(antes)

    // El control de la acción ya hecha no la vuelve a cerrar: lleva a la comprobación.
    await tocar(await esperar(() => principal('Seguir'), '"Seguir" desde la acción hecha'))
    await enLaComprobacion()
    expect(await fila('guia-lineal')).toEqual(antes)
  })

  it('desde ahí la navegación normal sigue hacia atrás, sin límite, y vuelve hacia adelante hasta la comprobación', async () => {
    await sembrarLineal()
    await montar(RUTAS, RUTA_LINEAL)
    await lineaHastaLaComprobacion()
    const antes = await fila('guia-lineal')

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_C2), 'C, acción 2')
    // Entre C2 y C1, la advertencia de C2 (tarea 311): la navegación refleja
    // lo que se leyó antes de hacerla.
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('Precaución. Antes de continuar'), 'la advertencia de C2')
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_C1) && textoPantalla().includes('acción 1 de 2'), 'C, acción 1')
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_B), 'B')
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_A), 'A')
    // En la primera acción de la guía ya no hay nada antes.
    expect((await anterior()).hasAttribute('disabled')).toBe(true)

    await tocar(await esperarControl('Ir al paso 2'))
    await esperar(() => textoPantalla().includes(ACCION_B), 'B otra vez')
    await tocar(await esperarControl('Ir al paso 3'))
    await esperar(() => textoPantalla().includes(ACCION_C1), 'C otra vez')
    await tocar(await esperarControl('Ir a la acción 2'))
    await esperar(() => textoPantalla().includes(ACCION_C2), 'la última acción otra vez')
    await tocar(await esperarControl('Seguir'))
    await enLaComprobacion()
    expect(await fila('guia-lineal')).toEqual(antes)
    expect(await terminada('guia-lineal')).toBe(false)
  })
})

describe('solo "Finalizar" termina la ejecución', () => {
  it('marcar todas las casillas no termina; "Anterior" sigue funcionando y conserva lo marcado; "Finalizar" termina', async () => {
    await sembrarLineal()
    await montar(RUTAS, RUTA_LINEAL)
    await lineaHastaLaComprobacion()

    await tocar(casillas()[0])
    await esperar(() => principal('Falta 1 comprobación'), 'falta una')
    expect(principal('Falta 1 comprobación')?.hasAttribute('disabled')).toBe(true)
    await tocar(casillas()[1])
    const finalizar = await esperar(() => principal('Finalizar'), '"Finalizar"')
    expect(finalizar.hasAttribute('disabled')).toBe(false)
    // Con todo marcado, la guía TODAVÍA no está terminada: falta "Finalizar".
    expect(textoPantalla()).toContain(COMPROBACION)
    expect(textoPantalla()).not.toContain('Guía terminada')
    await esperarQue(async () => (await fila('guia-lineal'))?.cierrePendiente === true, 'la comprobación abierta')
    expect(await terminada('guia-lineal')).toBe(false)
    // Para la ficha y las listas, la ejecución sigue abierta, en la comprobación.
    const articulo = await db.articulos.get('guia-lineal')
    const accion = accionDeGuia(normalizarProcedimiento(articulo?.procedimiento ?? null)!, await fila('guia-lineal'), true)
    expect(accion.estado).toBe('continuar')
    expect(accion.pendiente).toEqual({ tipo: 'verificacion' })

    // Volver a revisar con todo marcado: es una acción, no "Guía terminada".
    const antes = await fila('guia-lineal')
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_C2), 'la última acción')
    expect(textoPantalla()).not.toContain('Guía terminada')
    await tocar(await esperarControl('Seguir'))
    await enLaComprobacion()
    expect(casillas().map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'true'])
    expect(await fila('guia-lineal')).toEqual(antes)

    await tocar(await esperar(() => principal('Finalizar'), '"Finalizar"'))
    await esperar(() => textoPantalla().includes('Guía terminada'), 'la guía terminada')
    await esperarQue(async () => (await fila('guia-lineal'))?.cierrePendiente === false, 'la comprobación cerrada')
    expect(await terminada('guia-lineal')).toBe(true)
  })

  it('salir con la comprobación abierta y volver retoma en ella con lo marcado; "Anterior" lleva al último paso', async () => {
    await sembrarLineal()
    await db.progresoPasos.put({
      articuloId: 'guia-lineal',
      ejecucionId: 'ejecucion-de-prueba',
      pasosHechos: ['lin-a', 'lin-b', 'lin-c'],
      instruccionesHechas: ['lin-a-t1', 'lin-b-t1', 'lin-c-t1', 'lin-c-t2'],
      verificacionHecha: [0, 1],
      cierrePendiente: true,
      actualizadoEn: '2026-10-07T12:00:00.000Z',
    })
    await montar(RUTAS, RUTA_LINEAL)
    await enLaComprobacion()
    // No se tomó por terminada (abrir una terminada empieza un caso nuevo).
    expect(casillas().map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'true'])
    expect(principal('Finalizar')).not.toBeNull()
    expect((await fila('guia-lineal'))?.ejecucionId).toBe('ejecucion-de-prueba')

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_C2), 'la última acción del último paso')
    expect((await fila('guia-lineal'))?.pasosHechos).toEqual(['lin-a', 'lin-b', 'lin-c'])
  })

  it('una fila de antes de la 308 con todo marcado sigue terminada: abrirla empieza un caso nuevo, como siempre', async () => {
    await sembrarLineal()
    await db.progresoPasos.put({
      articuloId: 'guia-lineal',
      pasosHechos: ['lin-a', 'lin-b', 'lin-c'],
      instruccionesHechas: ['lin-a-t1', 'lin-b-t1', 'lin-c-t1', 'lin-c-t2'],
      verificacionHecha: [0, 1],
      actualizadoEn: '2026-10-07T12:00:00.000Z',
    })
    expect(await terminada('guia-lineal')).toBe(true)
    await montar(RUTAS, RUTA_LINEAL)
    await esperar(() => textoPantalla().includes(ACCION_A), 'la primera acción de un caso nuevo')
  })
})

describe('decisiones ramificadas: "Anterior" respeta el recorrido real', () => {
  it('A → Decide → No → F → G → comprobación: "Anterior" vuelve a G, no a D', async () => {
    await sembrarDecision()
    await montar(RUTAS, RUTA_DECISION)
    await completar('Enciende el equipo de prueba')
    await esperar(() => textoPantalla().includes('¿El equipo de prueba ya tiene el programa?'), 'la pregunta')
    await tocar(await esperar(() => control(/^No/), 'la respuesta No'))
    await completar('Descarga el programa de prueba (camino No)')
    await completar('Instala el programa de prueba (camino No)')
    await enLaComprobacion()
    const antes = await fila('guia-decision')
    expect(antes?.elecciones).toEqual({ 'dec-pregunta': 'dec-no' })

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('Instala el programa de prueba (camino No)'), 'G')
    expect(textoPantalla()).not.toContain('Configura el programa de prueba (camino Sí)')
    expect(control(/^Paso 4 de 4\. Abrir el índice de pasos$/)).not.toBeNull()

    // Y hacia atrás sigue por el camino recorrido: F y la pregunta respondida.
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('Descarga el programa de prueba (camino No)'), 'F')
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('¿El equipo de prueba ya tiene el programa?'), 'la pregunta')
    expect(control(/^No/)?.textContent).toContain('Tu respuesta')
    // Nada cambió: ni la respuesta, ni lo hecho.
    expect(await fila('guia-decision')).toEqual(antes)

    await tocar(await esperarControl('Ir al paso 3'))
    await tocar(await esperarControl('Ir al paso 4'))
    await tocar(await esperarControl('Seguir'))
    await enLaComprobacion()
    expect(await fila('guia-decision')).toEqual(antes)
  })

  it('A → Decide → Sí → C → D → comprobación: "Anterior" vuelve a D', async () => {
    await sembrarDecision()
    await montar(RUTAS, RUTA_DECISION)
    await completar('Enciende el equipo de prueba')
    await tocar(await esperar(() => control(/^Sí/), 'la respuesta Sí'))
    await completar('Abre el programa de prueba (camino Sí)')
    await completar('Configura el programa de prueba (camino Sí)')
    await enLaComprobacion()
    const antes = await fila('guia-decision')
    expect(antes?.elecciones).toEqual({ 'dec-pregunta': 'dec-si' })
    expect(antes?.pasosHechos).toEqual(['dec-a', 'dec-decide', 'dec-c', 'dec-d'])

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('Configura el programa de prueba (camino Sí)'), 'D')
    expect(textoPantalla()).not.toContain('camino No')
    expect(await fila('guia-decision')).toEqual(antes)
  })
})

describe('el último contexto visitado, no el último de la lista', () => {
  it('con un paso saltado que se cierra al final, "Anterior" vuelve a ese paso', async () => {
    await sembrarLineal()
    await montar(RUTAS, RUTA_LINEAL)
    await completar(ACCION_A)
    // B se salta desde "Tengo un problema".
    await esperar(() => textoPantalla().includes(ACCION_B), 'B')
    await tocar(await esperarControl('Tengo un problema con esta acción: ver las salidas'))
    await tocar(await esperarControl(/^Seguir con el paso siguiente/))
    await completar(ACCION_C1)
    await completar(ACCION_C2)
    // El avance vuelve al paso saltado y, al cerrarlo, a la comprobación.
    await completar(ACCION_B)
    await enLaComprobacion()

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_B), 'B, de donde se llegó')
    expect(textoPantalla()).not.toContain(ACCION_C2)
  })
})

describe('regresiones', () => {
  it('en la vista de paso entero, "Anterior" también vuelve al último paso y su control vuelve a la comprobación', async () => {
    await guardarModoEjecucion('pasoEntero')
    await sembrarLineal()
    await db.progresoPasos.put({
      articuloId: 'guia-lineal',
      pasosHechos: ['lin-a', 'lin-b', 'lin-c'],
      instruccionesHechas: ['lin-a-t1', 'lin-b-t1', 'lin-c-t1', 'lin-c-t2'],
      verificacionHecha: [],
      actualizadoEn: '2026-10-07T12:00:00.000Z',
    })
    await montar(RUTAS, RUTA_LINEAL)
    await enLaComprobacion()
    const antes = await fila('guia-lineal')

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes(ACCION_C1) && textoPantalla().includes(ACCION_C2), 'el paso C entero')
    await tocar(await esperar(() => principal('Seguir'), '"Seguir" del paso hecho'))
    await enLaComprobacion()
    expect(await fila('guia-lineal')).toEqual(antes)
  })

  it('el Sí/No antiguo: volver desde la comprobación hasta la decisión la conserva respondida', async () => {
    await sembrarGuia({
      id: 'guia-destino-no',
      titulo: 'Crear un vínculo de prueba con permiso de edición',
      pasos: [pasoPrueba('dno-p1', 'Permitir la edición', ['Selecciona Puede editar'])],
    })
    const paso = pasoPrueba('sno-p1', 'Copiar el vínculo de prueba', ['Copia el vínculo del archivo de prueba'])
    paso.bloques.push({
      ...paso.bloques[0],
      id: 'sno-p1-dec',
      texto: '¿La persona de prueba solo necesita ver el archivo?',
      tipoTarea: 'decision',
      decisionArticuloId: 'guia-destino-no',
      decisionArticuloTitulo: 'Crear un vínculo de prueba con permiso de edición',
    })
    await sembrarGuia({
      id: 'guia-si-no',
      titulo: 'Enviar un archivo de prueba',
      pasos: [paso, pasoPrueba('sno-p2', 'Enviar el correo de prueba', ['Pega el vínculo y envía el correo de prueba'])],
      procedimiento: { verificacionFinal: ['La persona de prueba recibió el correo'] },
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-si-no')
    await completar('Copia el vínculo del archivo de prueba')
    await esperar(() => textoPantalla().includes('¿La persona de prueba solo necesita ver el archivo?'), 'la decisión')
    await tocar(await esperarControl('Sí: seguir con la guía'))
    await completar('Pega el vínculo y envía el correo de prueba')
    await enLaComprobacion()
    const antes = await fila('guia-si-no')

    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('Pega el vínculo y envía el correo de prueba'), 'el paso 2')
    await tocar(await anterior())
    await esperar(() => textoPantalla().includes('¿La persona de prueba solo necesita ver el archivo?'), 'la decisión')
    expect(antes?.instruccionesHechas).toContain('sno-p1-dec')
    expect(await fila('guia-si-no')).toEqual(antes)
  })

  it('"Probar" (la vista de lista) no cambia: marcar la última comprobación la termina, sin "Finalizar"', async () => {
    const pasos = pasosLineales()
    const raiz = 'vista-previa:guia-lineal:prueba'
    await db.progresoPasos.put({
      articuloId: raiz,
      pasosHechos: ['lin-a', 'lin-b', 'lin-c'],
      instruccionesHechas: ['lin-a-t1', 'lin-b-t1', 'lin-c-t1', 'lin-c-t2'],
      verificacionHecha: [0],
      actualizadoEn: '2026-10-07T12:00:00.000Z',
    })
    const procedimiento = normalizarProcedimiento({
      descripcion: '',
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      verificacionFinal: COMPROBACIONES,
      tiempoEstimadoMin: 10,
      dificultad: 'principiante',
      pasos,
    })!
    await montar(
      [
        {
          ruta: '/prueba',
          elemento: (
            <ProveedorEjecucion raizId={raiz}>
              <ProcedimientoVista articuloId={raiz} procedimiento={procedimiento} />
            </ProveedorEjecucion>
          ),
        },
      ],
      '/prueba',
    )
    await esperar(() => textoPantalla().includes('Verificación final'), 'la verificación de la lista')
    await tocar(casillas().find((c) => c.getAttribute('aria-checked') === 'false')!)
    await esperar(() => textoPantalla().includes('Procedimiento completado'), 'completado en la lista')
    expect((await db.progresoPasos.get(raiz))?.cierrePendiente).toBeFalsy()
  })
})
