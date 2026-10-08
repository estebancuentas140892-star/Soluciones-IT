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

// "CÓMO HACERLO" NUMERADO COMO ÚNICA REPRESENTACIÓN (tarea 310, AD-071),
// con las pantallas de verdad.
//
// La tarea 309 dejó dos lecturas de las mismas microacciones: la "Ruta
// rápida" en una línea ("Abre … › Copia … › Pega …") y "Ver paso a paso",
// plegado y solo con alguna ubicación. Probándolas en producción, la lista
// numerada se seguía mucho mejor: la línea se volvía un párrafo largo en
// cuanto había varios gestos. Ahora hay UNA sola forma:
//
//   - cero o una microacción: solo la instrucción (una sola pertenece a
//     ella, y el editor no deja guardarla así);
//   - dos o más: "Cómo hacerlo" y una lista ordenada a la vista, sin nada
//     que pulsar, cada microacción con su verbo (`fraseDeMicroPaso`) y su
//     punto (`llevaPuntoFinal`);
//   - la ubicación, debajo de su microacción y dentro de su número; no
//     decide si hay lista.
//
// Todo lo sembrado es inventado; el caso del respaldo copia la FORMA del
// caso real (tres microacciones: abrir la carpeta, copiar, pegar) y el de
// la impresión retenida, la de una configuración larga con ubicaciones.

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
const LISTA_RESPALDO = [
  'Abre o crea la carpeta de la persona.',
  'Copia el archivo .pst desde el equipo local.',
  'Pega el archivo .pst en la carpeta del servidor.',
]

// La forma de una configuración de impresora: seis gestos, dos con ubicación.
const IMPRESION: MicroPasoComoHacer[] = [
  { id: 'i1', accion: 'Abre', elemento: 'Preferencias de impresión de prueba' },
  { id: 'i2', accion: 'Abre', elemento: 'Ajustes más frecuentes' },
  { id: 'i3', accion: 'Selecciona', elemento: 'Impresión retenida', ubicacion: 'Tipo de trabajo de prueba' },
  { id: 'i4', accion: 'Abre', elemento: 'Detalles' },
  {
    id: 'i5',
    accion: 'Selecciona',
    elemento: 'la opción que usa el nombre de inicio de sesión de la persona',
    ubicacion: 'Identificador de usuario de prueba',
  },
  { id: 'i6', accion: 'Pulsa', elemento: 'Aceptar' },
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

/** Las listas de "Cómo hacerlo" en pantalla: las listas ordenadas que nombra su rótulo. */
function listasComoHacerlo(dentro: ParentNode = document.body): HTMLOListElement[] {
  return Array.from(dentro.querySelectorAll<HTMLOListElement>('ol[aria-labelledby]')).filter(
    (ol) => document.getElementById(ol.getAttribute('aria-labelledby') ?? '')?.textContent === 'Cómo hacerlo',
  )
}

/** Las frases de la lista, sin la ubicación de debajo. */
function frases(lista: HTMLOListElement): string[] {
  return Array.from(lista.children).map((li) => textoDe(li.firstElementChild as Element))
}

/** La ubicación que cuelga de cada número, o null si no tiene. */
function ubicaciones(lista: HTMLOListElement): (string | null)[] {
  return Array.from(lista.children).map((li) => (li.children[1] ? textoDe(li.children[1]) : null))
}

function clasesDe(elemento: Element): string[] {
  return [elemento, ...Array.from(elemento.querySelectorAll('*'))].flatMap((e) => Array.from(e.classList))
}

/** Nada de la tarea 309: ni la ruta en una línea, ni su separador, ni el desplegable. */
function sinRutaNiDesplegable(dentro: ParentNode = document.body): void {
  const texto = textoDe(dentro as Element)
  expect(texto).not.toContain('Ruta rápida')
  expect(texto).not.toMatch(/(Ver|Ocultar) paso a paso/)
  for (const lista of listasComoHacerlo(dentro)) {
    const bloque = lista.parentElement as HTMLElement
    expect(textoDe(bloque)).not.toContain('›')
    expect(bloque.querySelector('button, [aria-expanded]')).toBeNull()
  }
}

/** Lo que tiene que cumplir el caso del respaldo en cualquier vista. */
function comprobarRespaldo(dentro: ParentNode = document.body): HTMLOListElement {
  const listas = listasComoHacerlo(dentro)
  expect(listas).toHaveLength(1)
  expect(frases(listas[0])).toEqual(LISTA_RESPALDO)
  expect(frases(listas[0]).map((frase) => frase.split(' ')[0])).toEqual(['Abre', 'Copia', 'Pega'])
  expect(ubicaciones(listas[0])).toEqual([null, null, null])
  sinRutaNiDesplegable(dentro)
  return listas[0]
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('cuántas microacciones (Modo Foco)', () => {
  it('cero: solo la instrucción, sin "Cómo hacerlo"', async () => {
    await abrirCon()
    expect(listasComoHacerlo()).toEqual([])
    expect(textoPantalla()).not.toContain('Cómo hacerlo')
    sinRutaNiDesplegable()
  })

  it('una: solo la instrucción; la microacción no se repite en una lista de un solo número', async () => {
    await abrirCon([{ id: 's1', accion: 'Selecciona', elemento: 'Guardar' }])
    expect(listasComoHacerlo()).toEqual([])
    expect(textoPantalla()).not.toContain('Cómo hacerlo')
    expect(textoPantalla()).not.toContain('Selecciona Guardar')
    sinRutaNiDesplegable()
    // El dato sigue en la guía: no se borra ni se convierte.
    const tarea = (await db.articulos.get('guia-rr'))?.procedimiento?.pasos[0].bloques[0]
    expect(tarea?.comoHacer).toEqual([{ id: 's1', accion: 'Selecciona', elemento: 'Guardar' }])
  })

  it('dos sin ubicación: "Cómo hacerlo" y su lista con acción más elemento, sin ruta ni paso a paso', async () => {
    await abrirCon([
      { id: 'd1', accion: 'Copia', elemento: 'el archivo de prueba' },
      { id: 'd2', accion: 'Pega', elemento: 'el archivo en la carpeta de prueba' },
    ])
    const [lista] = listasComoHacerlo()
    expect(lista.children).toHaveLength(2)
    expect(frases(lista)).toEqual(['Copia el archivo de prueba.', 'Pega el archivo en la carpeta de prueba.'])
    sinRutaNiDesplegable()
  })

  it('tres, el caso del respaldo: los verbos se quedan, un gesto por número y en orden', async () => {
    await abrirCon(RESPALDO)
    const lista = comprobarRespaldo()
    // La numeración es la de la lista, sin saltos ni números escritos a mano.
    expect(lista.hasAttribute('start')).toBe(false)
    expect(lista.hasAttribute('reversed')).toBe(false)
    expect(Array.from(lista.children).some((li) => li.hasAttribute('value'))).toBe(false)
    expect(textoDe(lista)).not.toMatch(/^\d/)
  })

  it('seis, una configuración larga: todas en su orden, cada una con su número', async () => {
    await abrirCon(IMPRESION)
    const [lista] = listasComoHacerlo()
    expect(frases(lista)).toEqual([
      'Abre Preferencias de impresión de prueba.',
      'Abre Ajustes más frecuentes.',
      'Selecciona Impresión retenida.',
      'Abre Detalles.',
      'Selecciona la opción que usa el nombre de inicio de sesión de la persona.',
      'Pulsa Aceptar.',
    ])
    sinRutaNiDesplegable()
  })

  it('con ubicación: debajo de SU microacción y dentro de su número, a la vista y sin abrir nada', async () => {
    await abrirCon(IMPRESION)
    const [lista] = listasComoHacerlo()
    expect(ubicaciones(lista)).toEqual([
      null,
      null,
      'Ubicación: Tipo de trabajo de prueba',
      null,
      'Ubicación: Identificador de usuario de prueba',
      null,
    ])
    // Debajo de la frase (un bloque propio tras ella) y en voz más baja.
    const tercera = lista.children[2]
    expect(tercera.children[0].nextElementSibling).toBe(tercera.children[1])
    expect(tercera.children[1].classList.contains('block')).toBe(true)
    expect(tercera.children[1].classList.contains('text-noct-neutral-400')).toBe(true)
    expect(textoPantalla()).toContain('Tipo de trabajo de prueba')
    sinRutaNiDesplegable()
  })

  it('sin ubicación: ni huecos ni rótulos vacíos', async () => {
    await abrirCon(RESPALDO)
    const [lista] = listasComoHacerlo()
    for (const li of Array.from(lista.children)) {
      expect(li.children).toHaveLength(1)
      expect(textoDe(li)).not.toContain('Ubicación')
    }
    const vacios = Array.from((lista.parentElement as HTMLElement).querySelectorAll('*')).filter(
      (e) => textoDe(e) === '' && e.tagName !== 'svg' && !e.closest('svg'),
    )
    expect(vacios).toEqual([])
  })

  it('puntuación: cada frase cierra con su punto, sin duplicar el signo que ya trae', async () => {
    await abrirCon([
      { id: 'p1', accion: 'Pulsa', elemento: '«Aceptar»' },
      { id: 'p2', accion: 'Responde', elemento: '¿Guardar los cambios?' },
      { id: 'p3', accion: 'Escribe', elemento: 'la ruta de prueba.' },
      { id: 'p4', accion: 'Espera', elemento: 'a que termine…' },
      { id: 'p5', accion: 'Pulsa', elemento: 'Aceptar' },
    ])
    const [lista] = listasComoHacerlo()
    expect(frases(lista)).toEqual([
      'Pulsa «Aceptar».',
      'Responde ¿Guardar los cambios?',
      'Escribe la ruta de prueba.',
      'Espera a que termine…',
      'Pulsa Aceptar.',
    ])
    expect(frases(lista).some((frase) => /\.\.$|\?\.$|…\.$/.test(frase))).toBe(false)
  })

  it('accesible: una lista ordenada de verdad, nombrada por su rótulo, con la ubicación dicha', async () => {
    await abrirCon(IMPRESION)
    const [lista] = listasComoHacerlo()
    // `ol` con sus `li`, sin un `role` que le quite la semántica: el orden y
    // la posición ("3 de 6") llegan al lector de pantalla.
    expect(lista.tagName).toBe('OL')
    expect(lista.hasAttribute('role')).toBe(false)
    expect(Array.from(lista.children).map((li) => li.tagName)).toEqual(['LI', 'LI', 'LI', 'LI', 'LI', 'LI'])
    expect(lista.classList.contains('list-decimal')).toBe(true)
    const rotulo = document.getElementById(lista.getAttribute('aria-labelledby') ?? '') as HTMLElement
    expect(rotulo.textContent).toBe('Cómo hacerlo')
    expect(rotulo.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // La palabra "Ubicación" no se pinta; solo la oye quien usa lector.
    const oculta = lista.children[2].querySelector('.sr-only')
    expect(oculta?.textContent).toBe('Ubicación: ')
  })

  it('un texto largo envuelve en varias líneas: nada se recorta ni se sale del ancho, y no hay separadores', async () => {
    const larga: MicroPasoComoHacer[] = [
      { id: 'l1', accion: 'Abre o crea', elemento: 'la carpeta con el nombre completo de la persona dentro de PST-365_Backups' },
      { id: 'l2', accion: 'Copia', elemento: 'el archivo \\\\servidor-de-prueba\\respaldos\\buzon-de-una-persona-con-nombre-largo.pst' },
      { id: 'l3', accion: 'Pega', elemento: 'el archivo .pst dentro de la carpeta de la persona en el servidor de respaldos de prueba' },
    ]
    await abrirCon(larga)
    const [lista] = listasComoHacerlo()
    expect(frases(lista)).toEqual(larga.map((m) => `${m.accion} ${m.elemento}.`))
    const bloque = lista.parentElement as HTMLElement
    const clases = clasesDe(bloque)
    // Parte la línea dentro de su columna, incluso una ruta sin espacios.
    expect(bloque.classList.contains('min-w-0')).toBe(true)
    expect(Array.from(lista.children).every((li) => li.firstElementChild?.classList.contains('[overflow-wrap:anywhere]'))).toBe(true)
    expect(clases).toContain('text-pretty')
    // Una frase por línea: la lista no fluye en línea como un párrafo.
    expect(lista.classList.contains('inline')).toBe(false)
    expect(Array.from(lista.children).some((li) => li.classList.contains('inline'))).toBe(false)
    // Nunca se recorta, se abrevia ni se desplaza en horizontal.
    expect(clases.filter((c) => /^line-clamp-|^truncate$|^whitespace-nowrap$|^overflow-x-|^overflow-hidden$/.test(c))).toEqual([])
    sinRutaNiDesplegable()
  })
})

describe('las demás vistas, con el caso del respaldo', () => {
  beforeEach(async () => {
    await sembrarGuia({ id: 'guia-rr', titulo: 'Respaldar el correo de prueba', pasos: [pasoCon(RESPALDO)] })
  })

  it('la acción a la vez: la variante "accion", bajo la instrucción de 26 px', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr')
    await esperar(() => listasComoHacerlo()[0], 'la lista')
    const lista = comprobarRespaldo()
    expect(lista.classList.contains('text-[16px]')).toBe(true)
  })

  it('la vista de paso entero: la variante "fila"', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr')
    await esperar(() => textoPantalla().includes(ACCION), 'la instrucción')
    await tocar(await esperarControl(/^Paso 1 de 1\. Abrir el índice de pasos$/))
    await tocar(await esperarControl(/^Ver el paso entero$/))
    await esperar(() => document.body.querySelector('button[role="checkbox"]'), 'la vista de paso entero')
    const lista = comprobarRespaldo()
    expect(lista.classList.contains('text-[14px]')).toBe(true)
  })

  it('la lectura de la guía entera (la vista previa del editor)', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr/editar')
    await tocar(await esperarControl(/^Vista previa$/))
    await esperar(() => listasComoHacerlo()[0], 'la lista en la lectura')
    comprobarRespaldo()
  })

  it('"Probar" desde el editor', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr/editar')
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(new RegExp(`^${TITULO_PASO}`))
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
    await tocar(await esperarControl(/^Probar$/))
    await tocar(await esperarControl(/^Ver como técnico$/))
    await esperar(() => textoPantalla().includes('Como lo ve el técnico') && listasComoHacerlo()[0], 'la prueba del paso')
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

  it('al leer el paso que la reutiliza (consulta): la variante "lectura"', async () => {
    await sembrarGuia({
      id: 'guia-que-consulta',
      titulo: 'Cambiar el equipo de una persona de prueba más tarde',
      pasos: [
        pasoPrueba('qc-p1', 'Preparar', ['Prepara el equipo de prueba']),
        { ...pasoPrueba('qc-p2', 'Respaldar el correo', []), subArticuloId: 'guia-rr', subArticuloTitulo: 'Respaldar el correo de prueba' },
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-que-consulta')
    await esperar(() => textoPantalla().includes('Prepara el equipo de prueba'), 'el paso 1')
    await tocar(await esperarControl(/^Paso 2 de 2: /))
    const lectura = await esperar(
      () => document.body.querySelector<HTMLElement>('[aria-label="Lo que se hace en este paso"]'),
      'la lectura de lo reutilizado',
    )
    const lista = comprobarRespaldo(lectura)
    expect(lista.classList.contains('text-[13px]')).toBe(true)
  })

  it('sin conexión, desde la base local', async () => {
    const red = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', red)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      await montar(RUTAS, '/soluciones/cat-pruebas/guia-rr')
      await esperar(() => listasComoHacerlo()[0], 'la lista sin red')
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

  it('una guía antigua con una sola: carga y se ejecuta sin "Cómo hacerlo"; al editarla, guardar obliga a resolverla', async () => {
    await sembrarCuenta([UNICA])
    // La ejecución no se rompe y no enseña la microacción.
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-cuenta')
    await esperar(() => textoPantalla().includes(INSTRUCCION), 'la instrucción')
    expect(listasComoHacerlo()).toEqual([])
    expect(textoPantalla()).not.toContain('Cómo hacerlo')
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

  it('dos o más con ubicación: se guardan y la ejecución las enseña numeradas, con la ubicación a la vista', async () => {
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
    const lista = await esperar(() => listasComoHacerlo()[0], 'la lista de lo guardado')
    expect(frases(lista)).toEqual(['Abre Archivo.', 'Selecciona Configuración de la cuenta.'])
    expect(ubicaciones(lista)).toEqual(['Ubicación: Esquina superior izquierda', null])
    sinRutaNiDesplegable()
  })
})
