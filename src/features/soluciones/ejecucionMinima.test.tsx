// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type BloquePaso, type MicroPasoComoHacer, type PasoProcedimiento, type ResultadoVisual } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
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
import { VistaContenidoAsistencia } from '../asistencia/VistaContenidoAsistencia'
import { ArticuloForm } from './ArticuloForm'
import { GuiaPage } from './GuiaPage'

// LA EJECUCIÓN MÍNIMA (tarea 307, regla 27, AD-068; sustituye a la prueba
// de la jerarquía de la tarea 303, AD-066, y conserva lo que sigue
// valiendo de ella).
//
// Una pantalla responde "¿qué hago ahora y cómo lo hago?": la acción, el
// riesgo real, la ruta rápida, el paso a paso, el dato técnico, lo que hace
// falta para hacerla y, plegada, la imagen del resultado. Lo heredado
// ("Dónde", "Para qué", el "Debes ver" de texto, la información y los
// consejos) carga sin romper nada, pero no se muestra.
//
// Todo lo sembrado es inventado. happy-dom no aplica Tailwind, así que lo
// visual se comprueba por las CLASES; la medida real a 390 × 844, 375 × 667,
// 1280 × 800 y con el texto al 130 % se hizo en el navegador (CHANGELOG).

// La imagen de "Debes ver" se sirve desde Storage o desde la copia sin
// conexión; en las pruebas no hay ninguna de las dos, así que la URL se da
// por resuelta. Que la referencia entre en la copia sin conexión lo prueba
// `src/lib/resultadoVisual.test.ts`.
vi.mock('../../components/useUrlAdjunto', () => ({
  useUrlAdjunto: (referencia: string | null) => (referencia ? `blob:prueba/${referencia}` : null),
}))

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]
const RUTA = '/soluciones/cat-pruebas/guia-minima'

const TITULO_PASO_1 = 'Preparar la exportación de prueba'
const ACCION_1 = 'Abre la opción de exportación'
const ACCION_2 = 'Comprueba que el asistente de prueba queda abierto'
const TITULO_PASO_2 = 'Elegir el archivo de destino de prueba'
const COMO: MicroPasoComoHacer[] = [
  { id: 'min-m1', accion: 'Abre', elemento: 'Archivo', ubicacion: 'Barra superior' },
  { id: 'min-m2', accion: 'Selecciona', elemento: 'Herramientas' },
  { id: 'min-m3', accion: 'Pulsa', elemento: 'Exportar' },
]
const RUTA_RAPIDA = 'Ruta rápida: Archivo › Herramientas › Exportar'
const DATO = 'Backup_2026-10-07.pst'
const RIESGO = 'Si el disco de destino se llena, la exportación se corta y el archivo queda incompleto'
const DESCRIPCION = 'La ventana Importar y exportar de prueba, abierta'
const RESULTADO: ResultadoVisual = {
  adjunto: { referencia: 'pruebas/1700000009-ventana-exportar.png', nombre: 'ventana-exportar.png', tipo: 'image/png' },
  descripcion: DESCRIPCION,
}
// Lo heredado, que la guía trae y la ejecución ya no enseña.
const DONDE = 'Aplicación de correo de prueba'
const PARA_QUE = 'Tener una copia del buzón de prueba'
const DEBES_VER_TEXTO = 'El asistente de exportación de prueba queda abierto'
const EXPLICACION = 'El archivo conserva carpetas y contactos de prueba'
const CONSEJO = 'Truco de prueba del equipo'

function aviso(id: string, tono: BloquePaso['tono'], texto: string, tareaId = 'min-p1-t1'): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', texto, tono, alcance: 'tarea', tareaId }
}

/** Un paso de dos acciones con todos los papeles, y lo heredado; y un paso cuya acción dice lo mismo que su título. */
async function sembrarCaso() {
  const base = pasoPrueba('min-p1', TITULO_PASO_1, [ACCION_1, ACCION_2])
  const paso1: PasoProcedimiento = {
    ...base,
    lugar: DONDE,
    objetivo: PARA_QUE,
    resultado: DEBES_VER_TEXTO,
    bloques: [
      aviso('min-riesgo', 'precaucion', RIESGO),
      { ...base.bloques[0], comoHacer: COMO, resultadoVisual: RESULTADO },
      aviso('min-dato', 'dato', DATO),
      aviso('min-info', 'info', EXPLICACION),
      aviso('min-consejo', 'consejo', CONSEJO),
      { ...base.bloques[1], tipoTarea: 'verificacion' },
    ],
  }
  const paso2 = pasoPrueba('min-p2', TITULO_PASO_2, [TITULO_PASO_2])
  await sembrarGuia({ id: 'guia-minima', titulo: 'Exportar un buzón de prueba', pasos: [paso1, paso2] })
}

async function abrir() {
  await sembrarCaso()
  await montar(RUTAS, RUTA)
  await esperar(() => textoPantalla().includes(ACCION_1), 'la primera acción')
}

/** La instrucción de la acción: el encabezado que recibe el foco. */
function instrucciones(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('h2[data-foco-lectura]'))
}

/** Lo que se lee en la pantalla de la acción: sin la cabecera, la ruta de escritorio, el pie fijo ni las hojas. */
function contenidoDeLaAccion(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
    (e) => !e.closest('.sticky') && !e.closest('header') && !e.closest('nav') && !e.closest('[role="dialog"]'),
  )
}

/** Los elementos del contenido de la acción cuyo texto propio (sin el de sus hijos) contiene `texto`. */
function conTextoPropio(texto: string): HTMLElement[] {
  return contenidoDeLaAccion().filter((e) =>
    Array.from(e.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').includes(texto)),
  )
}

/** El elemento más interno cuyo texto contiene `texto`. */
function elementoCon(texto: string): HTMLElement {
  const candidatos = Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter((e) =>
    (e.textContent ?? '').replace(/\s+/g, ' ').includes(texto),
  )
  const masInterno = candidatos.find((e) => !candidatos.some((otro) => otro !== e && e.contains(otro)))
  if (!masInterno) throw new Error(`No está en pantalla: ${texto}`)
  return masInterno
}

function clasesDe(elemento: Element): string[] {
  return [elemento, ...Array.from(elemento.querySelectorAll('*'))].flatMap((e) => Array.from(e.classList))
}

/** El control que pliega y despliega "Debes ver", o null si la acción no tiene imagen. */
function botonDebesVer(dentro: ParentNode = document.body): HTMLButtonElement | null {
  return (
    Array.from(dentro.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find(
      (b) => (b.textContent ?? '').trim() === 'Debes ver',
    ) ?? null
  )
}

function imagenDelResultado(): HTMLImageElement | null {
  return document.body.querySelector<HTMLImageElement>(`img[alt="${DESCRIPCION}"]`)
}

async function completarYSeguir() {
  await tocar(await esperarControl('Completar y seguir'))
}

async function verElPasoEntero() {
  await tocar(await esperarControl(/^Paso 1 de 2\. Abrir el índice de pasos$/))
  await tocar(await esperarControl(/^Ver el paso entero$/))
  await esperar(() => document.body.querySelector('button[role="checkbox"]'), 'la vista de paso entero')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('una sola instrucción principal', () => {
  it('la acción es la única instrucción de la pantalla: un encabezado, el único texto grande, nunca recortado', async () => {
    await abrir()

    expect(instrucciones()).toHaveLength(1)
    const [h2] = instrucciones()
    expect(h2.textContent).toBe(ACCION_1)
    expect(h2.classList.contains('text-[26px]')).toBe(true)
    // Nunca se recorta: parte la línea dentro de su columna (regla 23).
    expect(h2.classList.contains('min-w-0')).toBe(true)
    expect(h2.classList.contains('[overflow-wrap:anywhere]')).toBe(true)
    expect(Array.from(h2.classList).some((c) => /^line-clamp-|^truncate$/.test(c))).toBe(false)
    const grandes = contenidoDeLaAccion().filter(
      (e) => e !== h2 && Array.from(e.classList).some((c) => /^text-\[(1[89]|[2-9][0-9])px\]$|^text-(xl|[2-9]xl)$/.test(c)),
    )
    expect(grandes).toEqual([])
  })

  it('el título del paso no se repite sobre la acción: sigue en la navegación, no en el cuerpo', async () => {
    await abrir()
    // Ni en una línea de contexto, ni en grande sobre la instrucción.
    expect(conTextoPropio(TITULO_PASO_1)).toEqual([])
    // Sigue siendo dato de estructura: la ruta de escritorio lo nombra en su
    // nodo, pero no lo repite a 17 px bajo los nodos.
    const ruta = document.body.querySelector('nav[aria-label="Ruta del procedimiento"]')
    expect(ruta?.querySelector('[aria-current="step"]')?.getAttribute('title')).toBe(TITULO_PASO_1)
    expect(Array.from(ruta?.querySelectorAll('.text-\\[17px\\]') ?? [])).toEqual([])
  })

  it('un paso cuya acción dice lo mismo que su título enseña la frase una sola vez, sin comparar textos', async () => {
    await sembrarCaso()
    await db.progresoPasos.put({
      articuloId: 'guia-minima',
      pasosHechos: ['min-p1'],
      instruccionesHechas: ['min-p1-t1', 'min-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: '2026-10-07T12:00:00.000Z',
    })
    await montar(RUTAS, RUTA)
    await esperar(() => instrucciones()[0]?.textContent === TITULO_PASO_2, 'el paso 2')
    expect(conTextoPropio(TITULO_PASO_2)).toEqual(instrucciones())
  })

  it('un paso con varias acciones se entiende: cada una con su lugar en el paso, su rótulo y su instrucción', async () => {
    await abrir()
    expect(textoPantalla()).toContain('acción 1 de 2')
    expect(textoPantalla()).toContain('Qué hacer')

    await completarYSeguir()
    await esperar(() => instrucciones()[0]?.textContent === ACCION_2, 'la segunda acción')
    expect(instrucciones()).toHaveLength(1)
    expect(textoPantalla()).toContain('acción 2 de 2')
    expect(textoPantalla()).toContain('Comprueba')
  })
})

describe('el estado no sustituye a la función', () => {
  it('una acción hecha sigue diciendo "Qué hacer"; lo hecho se dice aparte, con su marca y en voz baja', async () => {
    await abrir()
    await completarYSeguir()
    await esperar(() => instrucciones()[0]?.textContent === ACCION_2, 'la segunda acción')
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => instrucciones()[0]?.textContent === ACCION_1, 'de vuelta en la primera, ya hecha')

    const rotulo = elementoCon('Qué hacer').closest('p') as HTMLElement
    expect(rotulo.textContent).toContain('Qué hacer')
    // "hecha" va a su lado, en verde y con su marca, no en su lugar.
    const estado = Array.from(rotulo.querySelectorAll('span')).find((s) => s.textContent === 'hecha')
    expect(estado?.classList.contains('text-noct-exito')).toBe(true)
    expect(estado?.querySelector('svg')).not.toBeNull()
    expect(textoPantalla()).not.toContain('Hecha')
    // La instrucción, atenuada; el progreso del paso la marca.
    expect(instrucciones()[0].classList.contains('text-noct-neutral-400')).toBe(true)
  })
})

describe('lo heredado carga sin romper nada y no se muestra', () => {
  it('ni "Dónde", ni "Para qué", ni el "Debes ver" de texto, ni la información, ni los consejos, ni "Más información"', async () => {
    await abrir()
    const texto = textoPantalla()
    for (const retirado of [DONDE, 'Dónde', PARA_QUE, 'Para qué', DEBES_VER_TEXTO, EXPLICACION, CONSEJO, 'Más información']) {
      expect(texto).not.toContain(retirado)
    }
    // La guía sigue entera en la base: nada se convirtió ni se borró.
    const guardada = await db.articulos.get('guia-minima')
    expect(guardada?.procedimiento?.pasos[0]).toMatchObject({ lugar: DONDE, objetivo: PARA_QUE, resultado: DEBES_VER_TEXTO })
  })

  it('en el paso entero tampoco, y sin dejar huecos donde estaban', async () => {
    await abrir()
    await verElPasoEntero()
    const texto = textoPantalla()
    for (const retirado of [DONDE, PARA_QUE, DEBES_VER_TEXTO, EXPLICACION, CONSEJO]) {
      expect(texto).not.toContain(retirado)
    }
    // Ninguna fila vacía en la lista del paso.
    const filas = Array.from(document.body.querySelectorAll<HTMLElement>('ul > li'))
    expect(filas.filter((li) => (li.textContent ?? '').trim() === '' && li.children.length === 0)).toEqual([])
  })
})

describe('la advertencia, a la vista y en la misma acción', () => {
  it('va bajo la instrucción y antes de "Cómo hacerlo": se lee antes de hacerla', async () => {
    await abrir()
    const texto = textoPantalla()
    const posiciones = [
      texto.indexOf('Qué hacer'),
      texto.indexOf(ACCION_1),
      texto.indexOf(`Precaución. ${RIESGO}`),
      texto.indexOf(RUTA_RAPIDA),
      texto.indexOf('Ver paso a paso'),
      texto.indexOf('Dato técnico'),
      texto.indexOf(DATO),
      texto.indexOf('Debes ver'),
    ]
    expect(posiciones.every((p) => p >= 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
  })

  it('nunca plegada, imposible de confundir: el único bloque con fondo de color', async () => {
    await abrir()
    const alerta = elementoCon(RIESGO).closest<HTMLElement>('[role="note"]')
    expect(alerta).not.toBeNull()
    // A la vista sin tocar nada, y fuera de todo lo que se pliega.
    const plegables = Array.from(document.body.querySelectorAll('button[aria-controls]')).map((b) =>
      document.getElementById(b.getAttribute('aria-controls') ?? ''),
    )
    expect(plegables.some((zona) => zona?.contains(alerta as HTMLElement))).toBe(false)
    expect(clasesDe(alerta as HTMLElement).some((c) => /^bg-noct-error/.test(c))).toBe(true)
    const conFondoDeEstado = contenidoDeLaAccion().filter(
      (e) => !(alerta as HTMLElement).contains(e) && Array.from(e.classList).some((c) => /^bg-noct-(error|exito|precaucion|accion)/.test(c)),
    )
    expect(conFondoDeEstado).toEqual([])
  })
})

describe('"Cómo hacerlo" queda intacto', () => {
  it('la ruta rápida a la vista y el paso a paso plegado, con la ubicación dentro de su microacción', async () => {
    await abrir()
    expect(textoPantalla()).toContain(RUTA_RAPIDA)
    await tocar(await esperarControl(/^Ver paso a paso$/))
    const primera = await esperar(
      () => Array.from(document.body.querySelectorAll('ol > li')).find((li) => li.textContent?.startsWith('Abre Archivo.')),
      'la primera microacción',
    )
    expect(primera.textContent).toContain('Barra superior')
  })

  it('el dato técnico va con su instrucción, con su rótulo y en monoespaciada', async () => {
    await abrir()
    const valor = elementoCon(DATO)
    expect(valor.classList.contains('font-mono')).toBe(true)
    expect(Array.from(valor.parentElement?.children ?? []).some((h) => h.textContent === 'Dato técnico')).toBe(true)
  })
})

describe('"Debes ver" es la imagen del resultado', () => {
  it('sin imagen no aparece: ni el control ni un texto en su lugar', async () => {
    await abrir()
    await completarYSeguir()
    await esperar(() => instrucciones()[0]?.textContent === ACCION_2, 'la comprobación, sin imagen')
    expect(botonDebesVer()).toBeNull()
    expect(textoPantalla()).not.toContain('Debes ver')
  })

  it('con imagen aparece plegada al final; se abre y se cierra, y la imagen se amplía', async () => {
    await abrir()
    const boton = botonDebesVer()
    expect(boton).not.toBeNull()
    expect(boton?.getAttribute('aria-expanded')).toBe('false')
    // Plegada no ocupa sitio: la imagen ni siquiera está montada.
    expect(imagenDelResultado()).toBeNull()
    expect(boton?.classList.contains('min-h-11')).toBe(true)

    await tocar(boton as HTMLButtonElement)
    const imagen = await esperar(imagenDelResultado, 'la imagen del resultado')
    expect(botonDebesVer()?.getAttribute('aria-expanded')).toBe('true')
    expect(imagen.getAttribute('src')).toBe(`blob:prueba/${RESULTADO.adjunto.referencia}`)
    // Tocarla la amplía en el visor de siempre, con su descripción.
    await tocar(await esperarControl(`Ampliar la imagen: ${DESCRIPCION}`))
    const visor = await esperar(() => document.body.querySelector('[role="dialog"]'), 'el visor')
    expect(visor.getAttribute('aria-label')).toBe(`Imagen ampliada: ${DESCRIPCION}`)
    expect(visor.textContent).toContain(DESCRIPCION)
    await tocar(await esperar(() => control(/^Volver$/), 'cerrar el visor'))
    await esperar(() => !document.body.querySelector('[role="dialog"]'), 'el visor cerrado')

    await tocar(botonDebesVer() as HTMLButtonElement)
    await esperar(() => imagenDelResultado() === null, 'la imagen plegada otra vez')
    expect(botonDebesVer()?.getAttribute('aria-expanded')).toBe('false')
  })

  it('cada acción llega con su "Debes ver" plegado', async () => {
    await abrir()
    await tocar(botonDebesVer() as HTMLButtonElement)
    await esperar(imagenDelResultado, 'la imagen abierta')
    await completarYSeguir()
    await esperar(() => instrucciones()[0]?.textContent === ACCION_2, 'la segunda acción')
    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => instrucciones()[0]?.textContent === ACCION_1, 'de vuelta en la primera')
    expect(botonDebesVer()?.getAttribute('aria-expanded')).toBe('false')
    expect(imagenDelResultado()).toBeNull()
  })

  it('en el paso entero, bajo su tarea', async () => {
    await abrir()
    await verElPasoEntero()
    const boton = await esperar(() => botonDebesVer(), 'el "Debes ver" de la tarea')
    await tocar(boton)
    await esperar(imagenDelResultado, 'la imagen en el paso entero')
    // Solo la tarea que la tiene: la comprobación no lleva ninguno.
    expect(Array.from(document.body.querySelectorAll('button[aria-expanded]')).filter((b) => b.textContent?.trim() === 'Debes ver')).toHaveLength(1)
  })

  it('en "Probar" desde el editor', async () => {
    await sembrarCaso()
    await montar(RUTAS, `${RUTA}/editar`)
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(new RegExp(`^${TITULO_PASO_1}`))
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
    await tocar(await esperarControl(/^Probar$/))
    await tocar(await esperarControl(/^Ver como técnico$/))
    await esperar(() => textoPantalla().includes('Como lo ve el técnico') && botonDebesVer() !== null, 'la prueba del paso')
    await tocar(botonDebesVer() as HTMLButtonElement)
    await esperar(imagenDelResultado, 'la imagen en "Probar"')
    // "Probar" enseña lo mismo que la ejecución: nada de lo heredado.
    expect(textoPantalla()).not.toContain(DONDE)
    expect(textoPantalla()).not.toContain(DEBES_VER_TEXTO)
  })

  describe('dentro de una guía reutilizada', () => {
    beforeEach(async () => {
      const base = pasoPrueba('reu-p1', 'Abrir la exportación', [ACCION_1])
      await sembrarGuia({
        id: 'guia-reutilizada',
        titulo: 'Abrir la exportación de prueba',
        pasos: [{ ...base, bloques: [{ ...base.bloques[0], resultadoVisual: RESULTADO }] }],
      })
      await sembrarGuia({
        id: 'guia-que-reutiliza',
        titulo: 'Exportar el buzón de prueba con lo reutilizado',
        pasos: [
          { ...pasoPrueba('qr-p1', 'Abrir la exportación', []), subArticuloId: 'guia-reutilizada', subArticuloTitulo: 'Abrir la exportación de prueba' },
          pasoPrueba('qr-p2', 'Revisar', ['Revisa el archivo de prueba']),
        ],
      })
    })

    it('en el flujo de la guía que la reutiliza', async () => {
      await montar(RUTAS, '/soluciones/cat-pruebas/guia-que-reutiliza')
      await esperar(() => instrucciones()[0]?.textContent === ACCION_1, 'la acción reutilizada, en el sitio')
      await tocar(await esperar(() => botonDebesVer(), 'su "Debes ver"'))
      await esperar(imagenDelResultado, 'la imagen de lo reutilizado')
    })

    it('y al leer el paso que la reutiliza, ya hecho', async () => {
      await db.progresoPasos.put({
        articuloId: 'guia-que-reutiliza',
        pasosHechos: ['qr-p1'],
        instruccionesHechas: [],
        verificacionHecha: [],
        actualizadoEn: '2026-10-07T12:00:00.000Z',
        vinculos: {
          'guia-reutilizada': {
            pasosHechos: ['reu-p1'],
            instruccionesHechas: ['reu-p1-t1'],
            verificacionHecha: [],
            actualizadoEn: '2026-10-07T12:00:00.000Z',
          },
        },
      })
      await montar(RUTAS, '/soluciones/cat-pruebas/guia-que-reutiliza')
      await esperar(() => textoPantalla().includes('Revisa el archivo de prueba'), 'el paso 2')
      await tocar(await esperarControl(/^Anterior/))
      const lectura = await esperar(
        () => document.body.querySelector<HTMLElement>('[aria-label="Lo que se hace en este paso"]'),
        'la lectura de lo reutilizado',
      )
      const boton = await esperar(() => botonDebesVer(lectura), 'su "Debes ver" en la lectura')
      expect(boton.getAttribute('aria-expanded')).toBe('false')
      await tocar(boton)
      await esperar(imagenDelResultado, 'la imagen en la lectura')
    })
  })
})

describe('el computador atendido enseña lo mismo', () => {
  it('lo que una versión anterior de la app aún envíe ("Dónde", "Debes ver" de texto, información) no se dibuja', async () => {
    await montar(
      [
        {
          ruta: '/portal',
          elemento: (
            <VistaContenidoAsistencia
              contenido={{
                v: 1,
                titulo: 'Paso 1 · Exportar el buzón de prueba',
                bloques: [
                  { tipo: 'donde', texto: DONDE },
                  { tipo: 'accion', texto: ACCION_1 },
                  { tipo: 'nota', texto: RIESGO, etiqueta: 'Precaución' },
                  { tipo: 'nota', texto: EXPLICACION, etiqueta: 'Información' },
                  { tipo: 'debes_ver', texto: DEBES_VER_TEXTO },
                ],
              }}
            />
          ),
        },
      ],
      '/portal',
    )
    await esperar(() => textoPantalla().includes(ACCION_1), 'el contenido en el portal')
    expect(textoPantalla()).toContain(RIESGO)
    expect(textoPantalla()).not.toContain(DONDE)
    expect(textoPantalla()).not.toContain(EXPLICACION)
    expect(textoPantalla()).not.toContain(DEBES_VER_TEXTO)
  })
})
