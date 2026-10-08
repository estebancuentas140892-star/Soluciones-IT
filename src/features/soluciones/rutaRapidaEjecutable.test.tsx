// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type MicroPasoComoHacer, type PasoProcedimiento } from '../../lib/db'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  limpiarBase,
  montar,
  pasoPrueba,
  pausa,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { ArticuloForm } from './ArticuloForm'
import { GuiaPage } from './GuiaPage'

// LA RUTA RÁPIDA ES EJECUTABLE (tarea 309), con las pantallas de verdad.
//
// Probando las guías reales, "Cómo hacerlo" seguía diciendo de más o de
// menos: la ruta rápida eran solo los elementos ("carpeta de la persona ›
// archivo .pst › archivo .pst"), así que perdía justo lo que dice qué hacer,
// y "Ver paso a paso" repetía después las mismas frases. Ahora:
//
//   - la ruta rápida es la secuencia ejecutable, cada microacción con su
//     verbo (`fraseDeMicroPaso`);
//   - una sola microacción no es "Cómo hacerlo": la pantalla enseña solo la
//     instrucción;
//   - "Ver paso a paso" solo existe cuando dice algo que la ruta no dice (hoy,
//     una ubicación), decidido por estructura;
//   - por eso el editor no deja guardar "Cómo hacerlo" con una sola: cero o
//     al menos dos. La guía antigua que ya tiene una sigue cargando y
//     ejecutándose; al editarla, hay que resolverla.
//
// Todo lo sembrado es inventado; el caso del respaldo copia la FORMA del
// caso real (tres microacciones: abrir la carpeta, copiar, pegar).

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <p>DETALLES DE LA GUÍA</p> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

const ACCION = 'Guarda el respaldo de prueba en el servidor'
const TITULO_PASO = 'Guardar el respaldo de prueba'

const RESPALDO: MicroPasoComoHacer[] = [
  { id: 'r1', accion: 'Abre o crea', elemento: 'la carpeta de la persona' },
  { id: 'r2', accion: 'Copia', elemento: 'el archivo .pst desde el equipo local' },
  { id: 'r3', accion: 'Pega', elemento: 'el archivo .pst en la carpeta del servidor' },
]
const RUTA_RESPALDO =
  'Abre o crea la carpeta de la persona › Copia el archivo .pst desde el equipo local › Pega el archivo .pst en la carpeta del servidor'

const CON_UBICACION: MicroPasoComoHacer[] = [
  { id: 'u1', accion: 'Abre', elemento: 'Archivo', ubicacion: 'Esquina superior izquierda' },
  { id: 'u2', accion: 'Selecciona', elemento: 'Abrir y exportar' },
  { id: 'u3', accion: 'Selecciona', elemento: 'Importar o exportar' },
]

function pasoCon(comoHacer?: MicroPasoComoHacer[], id = 'rr-p1'): PasoProcedimiento {
  const base = pasoPrueba(id, TITULO_PASO, [ACCION])
  return comoHacer === undefined ? base : { ...base, bloques: [{ ...base.bloques[0], comoHacer }] }
}

async function abrirCon(comoHacer?: MicroPasoComoHacer[]): Promise<void> {
  await sembrarGuia({ id: 'guia-rr', titulo: 'Respaldar el correo de prueba', pasos: [pasoCon(comoHacer)] })
  await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr')
  await esperar(() => textoPantalla().includes(ACCION), 'la instrucción')
}

function textoDe(elemento: Element): string {
  return (elemento.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Las rutas rápidas en pantalla: las listas que nombra su rótulo "Ruta rápida". */
function rutasRapidas(dentro: ParentNode = document.body): HTMLElement[] {
  return Array.from(dentro.querySelectorAll<HTMLElement>('ol[aria-labelledby]')).filter((ol) =>
    document.getElementById(ol.getAttribute('aria-labelledby') ?? '')?.textContent?.startsWith('Ruta rápida'),
  )
}

/** Las frases de una ruta rápida, sin su separador. */
function frasesDeLaRuta(ruta: HTMLElement): string[] {
  return Array.from(ruta.children).map((li) => textoDe(li).replace(/\s*›$/, ''))
}

function botonPasoAPaso(dentro: ParentNode = document.body): HTMLButtonElement | null {
  return (
    Array.from(dentro.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')).find((b) =>
      /^(Ver|Ocultar) paso a paso$/.test(textoDe(b)),
    ) ?? null
  )
}

function clasesDe(elemento: Element): string[] {
  return [elemento, ...Array.from(elemento.querySelectorAll('*'))].flatMap((e) => Array.from(e.classList))
}

/** Lo que tiene que cumplir el caso del respaldo en cualquier vista. */
function comprobarRespaldo(dentro: ParentNode = document.body): void {
  const rutas = rutasRapidas(dentro)
  expect(rutas).toHaveLength(1)
  expect(textoDe(rutas[0])).toBe(RUTA_RESPALDO)
  expect(frasesDeLaRuta(rutas[0]).map((frase) => frase.split(' ')[0])).toEqual(['Abre', 'Copia', 'Pega'])
  expect(botonPasoAPaso(dentro)).toBeNull()
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('cuántas microacciones (Modo Foco)', () => {
  it('cero: solo la instrucción, sin ruta ni paso a paso', async () => {
    await abrirCon()
    expect(textoPantalla()).not.toContain('Ruta rápida')
    expect(botonPasoAPaso()).toBeNull()
  })

  it('una: solo la instrucción; la microacción no se repite como ruta ni como paso a paso', async () => {
    await abrirCon([{ id: 's1', accion: 'Selecciona', elemento: 'Guardar' }])
    expect(textoPantalla()).not.toContain('Ruta rápida')
    expect(textoPantalla()).not.toContain('Selecciona Guardar')
    expect(botonPasoAPaso()).toBeNull()
    // El dato sigue en la guía: no se borra ni se convierte.
    const tarea = (await db.articulos.get('guia-rr'))?.procedimiento?.pasos[0].bloques[0]
    expect(tarea?.comoHacer).toEqual([{ id: 's1', accion: 'Selecciona', elemento: 'Guardar' }])
  })

  it('dos sin ubicación: la ruta dice acción y elemento, y no hay paso a paso que la repita', async () => {
    await abrirCon([
      { id: 'd1', accion: 'Copia', elemento: 'el archivo de prueba' },
      { id: 'd2', accion: 'Pega', elemento: 'el archivo en la carpeta de prueba' },
    ])
    expect(textoPantalla()).toContain('Ruta rápida: Copia el archivo de prueba › Pega el archivo en la carpeta de prueba')
    expect(frasesDeLaRuta(rutasRapidas()[0])).toEqual(['Copia el archivo de prueba', 'Pega el archivo en la carpeta de prueba'])
    expect(botonPasoAPaso()).toBeNull()
    expect(textoPantalla()).not.toContain('paso a paso')
  })

  it('tres, el caso del respaldo: los verbos se quedan; no es una lista de sustantivos', async () => {
    await abrirCon(RESPALDO)
    expect(textoPantalla()).toContain(`Ruta rápida: ${RUTA_RESPALDO}`)
    comprobarRespaldo()
    expect(textoPantalla()).not.toContain('la carpeta de la persona › el archivo .pst desde el equipo local')
  })

  it('con una ubicación: la ruta con sus frases y "Ver paso a paso", que enseña la ubicación al abrirlo', async () => {
    await abrirCon(CON_UBICACION)
    expect(textoPantalla()).toContain('Ruta rápida: Abre Archivo › Selecciona Abrir y exportar › Selecciona Importar o exportar')
    const boton = botonPasoAPaso()
    expect(boton).not.toBeNull()
    expect(boton?.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).not.toContain('Esquina superior izquierda')

    await tocar(boton as HTMLButtonElement)
    const lista = await esperar(
      () => document.getElementById(botonPasoAPaso()?.getAttribute('aria-controls') ?? '') as HTMLOListElement | null,
      'el paso a paso',
    )
    expect(Array.from(lista.children).map((li) => textoDe(li.firstElementChild as Element))).toEqual([
      'Abre Archivo.',
      'Selecciona Abrir y exportar.',
      'Selecciona Importar o exportar.',
    ])
    expect(lista.children[0].children[1]?.textContent).toBe('Ubicación: Esquina superior izquierda')
    expect(textoPantalla()).toContain('Esquina superior izquierda')
  })

  it('un texto largo envuelve en varias líneas: nada se recorta ni se sale del ancho', async () => {
    const larga: MicroPasoComoHacer[] = [
      { id: 'l1', accion: 'Abre o crea', elemento: 'la carpeta con el nombre completo de la persona dentro de PST-365_Backups' },
      { id: 'l2', accion: 'Copia', elemento: 'el archivo \\\\servidor-de-prueba\\respaldos\\buzon-de-una-persona-con-nombre-largo.pst' },
      { id: 'l3', accion: 'Pega', elemento: 'el archivo .pst dentro de la carpeta de la persona en el servidor de respaldos de prueba' },
    ]
    await abrirCon(larga)
    const [ruta] = rutasRapidas()
    expect(frasesDeLaRuta(ruta)).toEqual(larga.map((m) => `${m.accion} ${m.elemento}`))
    const contenedor = ruta.parentElement as HTMLElement
    const clases = clasesDe(contenedor)
    // Parte la línea dentro de su columna, incluso una ruta sin espacios.
    expect(contenedor.classList.contains('min-w-0')).toBe(true)
    expect(clases).toContain('[overflow-wrap:anywhere]')
    expect(clases).toContain('text-pretty')
    // Las frases fluyen en línea, como un párrafo que envuelve.
    expect(ruta.classList.contains('inline')).toBe(true)
    expect(Array.from(ruta.children).every((li) => li.classList.contains('inline'))).toBe(true)
    // Nunca se recorta, se abrevia ni se desplaza en horizontal.
    expect(clases.filter((c) => /^line-clamp-|^truncate$|^whitespace-nowrap$|^overflow-x-|^overflow-hidden$/.test(c))).toEqual([])
    // Ninguna línea empieza por el separador: va pegado a la frase anterior.
    const separador = ruta.children[0].querySelector('[aria-hidden]')
    expect(separador?.textContent?.startsWith(' ›')).toBe(true)
  })
})

describe('las demás vistas, con el caso del respaldo', () => {
  beforeEach(async () => {
    await sembrarGuia({ id: 'guia-rr', titulo: 'Respaldar el correo de prueba', pasos: [pasoCon(RESPALDO)] })
  })

  it('la vista de paso entero', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr')
    await esperar(() => textoPantalla().includes(ACCION), 'la instrucción')
    await tocar(await esperarControl(/^Paso 1 de 1\. Abrir el índice de pasos$/))
    await tocar(await esperarControl(/^Ver el paso entero$/))
    await esperar(() => document.body.querySelector('button[role="checkbox"]'), 'la vista de paso entero')
    comprobarRespaldo()
  })

  it('la lectura de la guía entera (la vista previa del editor)', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr/editar')
    await tocar(await esperarControl(/^Vista previa$/))
    await esperar(() => textoPantalla().includes(RUTA_RESPALDO), 'la ruta en la lectura')
    comprobarRespaldo()
  })

  it('"Probar" desde el editor', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr/editar')
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(new RegExp(`^${TITULO_PASO}`))
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
    await tocar(await esperarControl(/^Probar$/))
    await tocar(await esperarControl(/^Ver como técnico$/))
    await esperar(() => textoPantalla().includes('Como lo ve el técnico') && textoPantalla().includes(RUTA_RESPALDO), 'la prueba del paso')
    comprobarRespaldo()
  })

  it('dentro de la guía que la reutiliza, en el sitio', async () => {
    await sembrarGuia({
      id: 'guia-que-reutiliza',
      titulo: 'Cambiar el equipo de una persona de prueba',
      pasos: [
        { ...pasoPrueba('qr-p1', 'Respaldar el correo', []), subArticuloId: 'guia-rr', subArticuloTitulo: 'Respaldar el correo de prueba' },
        pasoPrueba('qr-p2', 'Entregar el equipo', ['Entrega el equipo de prueba']),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-que-reutiliza')
    await esperar(() => textoPantalla().includes(ACCION), 'la acción reutilizada')
    comprobarRespaldo()
  })

  it('sin conexión, desde la base local', async () => {
    const red = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', red)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr')
      await esperar(() => textoPantalla().includes(RUTA_RESPALDO), 'la ruta sin red')
      comprobarRespaldo()
      expect(red).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })
})

describe('en el editor: cero microacciones o al menos dos', () => {
  // El caso del encargo: una instrucción que no dice el gesto y una única
  // microacción que sí lo dice. La ejecución la escondería.
  const INSTRUCCION = 'Configura correctamente la cuenta'
  const TITULO_PASO_CUENTA = 'Configurar la cuenta de prueba'
  const UNICA: MicroPasoComoHacer = { id: 'unica', accion: 'Selecciona', elemento: 'No, solo esta aplicación' }
  const AVISO =
    'Cómo hacerlo necesita al menos 2 acciones. Si solo hay una, escríbela directamente en la instrucción principal.'
  const AL_GUARDAR = `«${INSTRUCCION}» tiene una sola microacción en Cómo hacerlo: escríbela en la instrucción principal o añade otra.`

  async function sembrarCuenta(comoHacer?: MicroPasoComoHacer[]): Promise<void> {
    const base = pasoPrueba('cu-p1', TITULO_PASO_CUENTA, [INSTRUCCION])
    const paso = comoHacer === undefined ? base : { ...base, bloques: [{ ...base.bloques[0], comoHacer }] }
    await sembrarGuia({ id: 'guia-cuenta', titulo: 'Guía de prueba de la cuenta', pasos: [paso] })
  }

  /** El editor, en "Pasos" y con el paso abierto; o, con `enPasos` false, en la pestaña con la que abre. */
  async function abrirEditor(enPasos = true): Promise<void> {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-cuenta/editar')
    await esperarControl('Guardar procedimiento')
    if (!enPasos) return
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(new RegExp(`^${TITULO_PASO_CUENTA}`))
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
  }

  function campoInstruccion(): HTMLInputElement | undefined {
    return Array.from(document.body.querySelectorAll<HTMLInputElement>('input')).find((i) => i.value === INSTRUCCION)
  }

  /** Selecciona la instrucción como lo hace el autor: tocándola. */
  async function seleccionarInstruccion(): Promise<void> {
    const entrada = await esperar(campoInstruccion, 'el campo de la instrucción')
    await act(async () => {
      entrada.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    await pausa()
  }

  /** El campo de una microacción por su rótulo completo ("Acción de la microacción 1"). */
  function campo(etiqueta: string): HTMLInputElement | null {
    const rotulo = Array.from(document.body.querySelectorAll('label')).find((l) => textoDe(l) === etiqueta)
    const id = rotulo?.getAttribute('for')
    return id ? (document.getElementById(id) as HTMLInputElement | null) : null
  }

  async function rellenar(numero: number, accion: string, elemento: string, ubicacion = ''): Promise<void> {
    await escribir(await esperar(() => campo(`Acción de la microacción ${numero}`), `la acción ${numero}`), accion)
    await escribir(campo(`Elemento de la microacción ${numero}`) as HTMLInputElement, elemento)
    if (ubicacion) await escribir(campo(`Ubicación (opcional) de la microacción ${numero}`) as HTMLInputElement, ubicacion)
  }

  /** El aviso de una sola microacción junto a "Cómo hacerlo", o null. */
  function avisoUnaSola(): HTMLElement | null {
    return Array.from(document.body.querySelectorAll<HTMLElement>('p')).find((p) => textoDe(p) === AVISO) ?? null
  }

  /** Lo que dice el aviso de una fila ("Falta el elemento."), o null. */
  function avisoDeFila(numero: number): string | null {
    const fila = campo(`Acción de la microacción ${numero}`)?.closest('li')
    const aviso = fila ? Array.from(fila.querySelectorAll('p')).find((p) => /^Faltan? /.test(textoDe(p))) : undefined
    return aviso ? textoDe(aviso) : null
  }

  async function guardada() {
    return db.articulos.get('guia-cuenta')
  }

  async function tareaGuardada() {
    return (await guardada())?.procedimiento?.pasos[0]?.bloques.find((b) => b.tipo === 'tarea')
  }

  async function guardar(): Promise<void> {
    await tocar(await esperarControl('Guardar procedimiento'))
  }

  /** Guardó: el editor lleva a los detalles de la guía. */
  async function esperarGuardado(): Promise<void> {
    await esperar(() => textoPantalla().includes('DETALLES DE LA GUÍA'), 'la guía guardada')
  }

  /** No guardó: sigue en el editor y la base no cambió. */
  async function comprobarQueNoGuardo(antes: Awaited<ReturnType<typeof guardada>>): Promise<void> {
    await pausa(150)
    expect(textoPantalla()).not.toContain('DETALLES DE LA GUÍA')
    expect((await guardada())?.updatedAt).toBe(antes?.updatedAt)
  }

  it('cero: sin "Cómo hacerlo" no hay aviso y se guarda', async () => {
    await sembrarCuenta()
    await abrirEditor()
    expect(avisoUnaSola()).toBeNull()
    const antes = await guardada()

    await guardar()
    await esperarGuardado()
    expect((await guardada())?.updatedAt).not.toBe(antes?.updatedAt)
    expect('comoHacer' in ((await tareaGuardada()) ?? {})).toBe(false)
  })

  it('una completa: el aviso se ve junto a "Cómo hacerlo" antes de guardar, y no deja guardar', async () => {
    await sembrarCuenta()
    await abrirEditor()
    await seleccionarInstruccion()
    await tocar(await esperarControl(/^Cómo hacerlo · opcional$/))
    // Recién creada y vacía, todavía no es ninguna: no hay aviso.
    expect(avisoUnaSola()).toBeNull()

    await rellenar(1, UNICA.accion, UNICA.elemento)
    const aviso = await esperar(avisoUnaSola, 'el aviso de una sola microacción')
    // A la vista, en el bloque "Cómo hacerlo", encima de las filas: ni
    // ventana ni tooltip, y quien usa lector de pantalla lo oye al entrar.
    const grupo = aviso.closest<HTMLElement>('[role="group"]')
    expect(document.getElementById(grupo?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Cómo hacerlo')
    expect(grupo?.getAttribute('aria-describedby')?.split(' ')).toContain(aviso.id)
    expect(aviso.closest('[role="dialog"]')).toBeNull()
    expect(aviso.hasAttribute('title')).toBe(false)
    const primeraAccion = campo('Acción de la microacción 1') as HTMLInputElement
    expect(aviso.compareDocumentPosition(primeraAccion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // No es un campo a medias: la fila no dice que le falte nada.
    expect(avisoDeFila(1)).toBeNull()

    const antes = await guardada()
    await guardar()
    await esperar(() => textoPantalla().includes('Antes de guardar, corrige esto:'), 'el aviso de arriba')
    expect(textoPantalla()).toContain(AL_GUARDAR)
    await esperar(() => document.activeElement === avisoUnaSola(), 'el foco en el aviso')
    await comprobarQueNoGuardo(antes)
    expect('comoHacer' in ((await tareaGuardada()) ?? {})).toBe(false)
    // Nada se borró ni se movió solo a la instrucción.
    expect(campo('Acción de la microacción 1')?.value).toBe(UNICA.accion)
    expect(campo('Elemento de la microacción 1')?.value).toBe(UNICA.elemento)
    expect(campoInstruccion()).toBeDefined()

    // Lo resuelve quien escribe: la quita y lo lleva a la instrucción.
    await tocar(await esperarControl('Quitar la microacción 1'))
    expect(avisoUnaSola()).toBeNull()
    expect(textoPantalla()).not.toContain('Antes de guardar, corrige')
    await escribir(campoInstruccion() as HTMLInputElement, 'Selecciona «No, solo esta aplicación» al configurar la cuenta')
    await guardar()
    await esperarGuardado()
    const tarea = await tareaGuardada()
    expect(tarea?.texto).toBe('Selecciona «No, solo esta aplicación» al configurar la cuenta')
    expect('comoHacer' in (tarea ?? {})).toBe(false)
  })

  it('dos completas: sin aviso, y se guardan las dos', async () => {
    await sembrarCuenta()
    await abrirEditor()
    await seleccionarInstruccion()
    await tocar(await esperarControl(/^Cómo hacerlo · opcional$/))
    await rellenar(1, 'Abre', 'Configuración de la cuenta')
    expect(avisoUnaSola()).not.toBeNull()
    await tocar(await esperarControl('Añadir microacción'))
    // La segunda, vacía, todavía no cuenta: el aviso sigue.
    expect(avisoUnaSola()).not.toBeNull()
    await rellenar(2, UNICA.accion, UNICA.elemento)
    expect(avisoUnaSola()).toBeNull()

    await guardar()
    await esperarGuardado()
    expect((await tareaGuardada())?.comoHacer?.map(({ accion, elemento }) => `${accion} ${elemento}`)).toEqual([
      'Abre Configuración de la cuenta',
      'Selecciona No, solo esta aplicación',
    ])
  })

  it('una a medias: manda lo que le falta, sin un aviso de "al menos 2" que lo tape', async () => {
    await sembrarCuenta()
    await abrirEditor()
    await seleccionarInstruccion()
    await tocar(await esperarControl(/^Cómo hacerlo · opcional$/))
    await escribir(await esperar(() => campo('Acción de la microacción 1'), 'la acción 1'), UNICA.accion)
    expect(avisoDeFila(1)).toBe('Falta el elemento.')
    expect(avisoUnaSola()).toBeNull()

    const antes = await guardada()
    await guardar()
    await esperar(() => textoPantalla().includes('Antes de guardar, corrige esto:'), 'el aviso de arriba')
    expect(textoPantalla()).toContain(`A la microacción 1 de «${INSTRUCCION}» le falta el elemento.`)
    expect(textoPantalla()).not.toContain(AL_GUARDAR)
    expect(avisoUnaSola()).toBeNull()
    await esperar(() => document.activeElement === campo('Elemento de la microacción 1'), 'el foco en el elemento vacío')
    await comprobarQueNoGuardo(antes)

    // Completa, es una sola: ahora sí lo dice, y sigue sin guardar.
    await escribir(campo('Elemento de la microacción 1') as HTMLInputElement, UNICA.elemento)
    expect(avisoDeFila(1)).toBeNull()
    expect(avisoUnaSola()).not.toBeNull()
    expect(textoPantalla()).toContain(AL_GUARDAR)
    expect(textoPantalla()).not.toContain('le falta el elemento')
    await guardar()
    await esperar(() => document.activeElement === avisoUnaSola(), 'el foco en el aviso')
    await comprobarQueNoGuardo(antes)
  })

  it('una guía antigua con una sola: carga y se ejecuta sin ruta; al editarla, guardar obliga a resolverla', async () => {
    await sembrarCuenta([UNICA])
    // La ejecución no se rompe y no enseña la microacción.
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-cuenta')
    await esperar(() => textoPantalla().includes(INSTRUCCION), 'la instrucción')
    expect(textoPantalla()).not.toContain('Ruta rápida')
    expect(botonPasoAPaso()).toBeNull()
    expect(textoPantalla()).not.toContain(UNICA.elemento)
    await desmontarTodo()

    // El editor la carga tal cual. Guardar desde otra pestaña lleva al
    // bloque: "Pasos", su paso abierto y el foco en el aviso.
    await abrirEditor(false)
    expect(avisoUnaSola()).toBeNull()
    const antes = await guardada()
    await guardar()
    await esperar(() => document.activeElement === avisoUnaSola(), 'el foco en el aviso de la guía antigua')
    expect(textoPantalla()).toContain(AL_GUARDAR)
    expect(campo('Elemento de la microacción 1')?.value).toBe(UNICA.elemento)
    await comprobarQueNoGuardo(antes)
    expect((await tareaGuardada())?.comoHacer).toEqual([UNICA])

    // Lo resuelve quien escribe: añade la que faltaba y se guardan las dos.
    await tocar(await esperarControl('Añadir microacción'))
    await rellenar(2, 'Pulsa', 'Siguiente')
    expect(avisoUnaSola()).toBeNull()
    expect(textoPantalla()).not.toContain('Antes de guardar, corrige')
    await guardar()
    await esperarGuardado()
    const guardadas = (await tareaGuardada())?.comoHacer
    expect(guardadas).toHaveLength(2)
    expect(guardadas?.[0]).toEqual(UNICA)
  })

  it('dos o más con ubicación: se guardan y la ejecución sigue ofreciendo "Ver paso a paso"', async () => {
    await sembrarCuenta()
    await abrirEditor()
    await seleccionarInstruccion()
    await tocar(await esperarControl(/^Cómo hacerlo · opcional$/))
    await rellenar(1, 'Abre', 'Archivo', 'Esquina superior izquierda')
    await tocar(await esperarControl('Añadir microacción'))
    await rellenar(2, 'Selecciona', 'Configuración de la cuenta')
    expect(avisoUnaSola()).toBeNull()
    await guardar()
    await esperarGuardado()
    expect((await tareaGuardada())?.comoHacer).toHaveLength(2)
    await desmontarTodo()

    await montar(RUTAS, '/soluciones/cat-pruebas/guia-cuenta')
    await esperar(
      () => textoPantalla().includes('Ruta rápida: Abre Archivo › Selecciona Configuración de la cuenta'),
      'la ruta rápida de lo guardado',
    )
    expect(botonPasoAPaso()).not.toBeNull()
    await tocar(botonPasoAPaso() as HTMLButtonElement)
    await esperar(() => textoPantalla().includes('Ubicación: Esquina superior izquierda'), 'la ubicación en el paso a paso')
  })
})
