// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type BloquePaso, type MicroPasoComoHacer, type OpcionDecision, type PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  pausa,
  sembrarGuia,
  sembrarPerfil,
  sembrarReferencia,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { VistaContenidoAsistencia } from '../asistencia/VistaContenidoAsistencia'
import { ArticuloForm } from './ArticuloForm'
import { ArticuloPage } from './ArticuloPage'
import { GuiaPage } from './GuiaPage'

// "CÓMO HACERLO" DE UNA ACCIÓN (tarea 303), con las pantallas de verdad.
//
// Las microacciones de una tarea de acción (`comoHacer`) se enseñan de UNA
// sola forma desde la tarea 310: una lista numerada, a la vista justo
// debajo de la instrucción y sin nada que pulsar, cada una con su frase
// ("1. Abre Fichero.") y, si la tiene, su ubicación debajo. Sin "Ruta
// rápida" en una línea ni "Ver paso a paso" plegado (tarea 309). Igual en la
// acción a la vez, en el paso entero, en la lectura, en "Probar" y dentro
// de una guía reutilizada; junto a las decisiones de la tarea 302; sin red;
// se escriben en el editor y viajan al computador atendido.
//
// Todo lo sembrado es inventado: el caso del encargo.

const DONDE = 'Aplicación de ejemplo'
const ACCION = 'Abre un registro nuevo'
const MICRO: MicroPasoComoHacer[] = [
  { id: 'm1', accion: 'Abre', elemento: 'Fichero', ubicacion: 'Barra superior' },
  { id: 'm2', accion: 'Selecciona', elemento: 'Cliente' },
  { id: 'm3', accion: 'Abre', elemento: 'Fichero' },
  { id: 'm4', accion: 'Selecciona', elemento: 'Nuevo' },
]
const LISTA = ['Abre Fichero.', 'Selecciona Cliente.', 'Abre Fichero.', 'Selecciona Nuevo.']
const DATO = 'REG-EJEMPLO-001'
const DEBES_VER = 'El formulario del registro nuevo queda abierto'
const EXPLICACION = 'Texto inventado que ayuda a entender el registro'
const RIESGO = 'Riesgo ficticio: un registro duplicado de ejemplo no se puede deshacer'

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/detalles', elemento: <ArticuloPage comoDetalles /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

function aviso(id: string, tareaId: string, tono: BloquePaso['tono'], texto: string): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', texto, tono, alcance: 'tarea', tareaId }
}

/** Una acción con sus microacciones (o sin ellas, si no llegan). */
function conComo(tarea: BloquePaso, comoHacer?: MicroPasoComoHacer[]): BloquePaso {
  return comoHacer === undefined ? tarea : { ...tarea, comoHacer }
}

/** El caso del encargo: una acción con todos sus papeles; `comoHacer` decide si lleva microacciones. */
function pasoCompleto(id: string, comoHacer?: MicroPasoComoHacer[]): PasoProcedimiento {
  const base = pasoPrueba(id, 'Crear el registro de ejemplo', [ACCION])
  const tarea = base.bloques[0]
  return {
    ...base,
    lugar: DONDE,
    resultado: DEBES_VER,
    bloques: [
      aviso(`${id}-riesgo`, tarea.id, 'precaucion', RIESGO),
      conComo(tarea, comoHacer),
      aviso(`${id}-dato`, tarea.id, 'dato', DATO),
      aviso(`${id}-info`, tarea.id, 'info', EXPLICACION),
    ],
  }
}

function decision(id: string, texto: string, opciones: OpcionDecision[]): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto, tipoTarea: 'decision', opciones }
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

/** "Cómo hacerlo" entero: su rótulo y su lista. */
function bloqueComoHacerlo(dentro: ParentNode = document.body): HTMLElement {
  const lista = listasComoHacerlo(dentro)[0]
  if (!lista?.parentElement) throw new Error('Sin "Cómo hacerlo" en pantalla')
  return lista.parentElement
}

/** Nada de la tarea 309: ni la ruta en una línea ni el desplegable. */
function sinRutaNiDesplegable(dentro: ParentNode = document.body): void {
  const texto = textoDe(dentro as Element)
  expect(texto).not.toContain('Ruta rápida')
  expect(texto).not.toMatch(/(Ver|Ocultar) paso a paso/)
  for (const lista of listasComoHacerlo(dentro)) expect(textoDe(lista.parentElement as Element)).not.toContain('›')
}

/** La lista del encargo, a la vista y entera: frases en orden y la ubicación bajo la primera. */
function comprobarLista(dentro: ParentNode = document.body): HTMLOListElement {
  const listas = listasComoHacerlo(dentro)
  expect(listas).toHaveLength(1)
  const [lista] = listas
  expect(frases(lista)).toEqual(LISTA)
  expect(textoDe(lista.children[0].children[1])).toBe('Ubicación: Barra superior')
  expect(Array.from(lista.children).slice(1).every((li) => li.children.length === 1)).toBe(true)
  sinRutaNiDesplegable(dentro)
  return lista
}

function clasesDe(elemento: Element): string[] {
  return [elemento, ...Array.from(elemento.querySelectorAll('*'))].flatMap((e) => Array.from(e.classList))
}

function ancestroComun(a: Element, b: Element): Element {
  let nodo: Element | null = a
  while (nodo && !nodo.contains(b)) nodo = nodo.parentElement
  if (!nodo) throw new Error('Sin ancestro común')
  return nodo
}

/** La instrucción de la acción: el encabezado que recibe el foco. */
function instruccion(): HTMLElement {
  const h2 = document.body.querySelector<HTMLElement>('h2[data-foco-lectura]')
  if (!h2) throw new Error('No hay instrucción en pantalla')
  return h2
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('una acción a la vez (Modo Foco)', () => {
  it('una guía de antes, sin "Cómo hacerlo", se ve como siempre', async () => {
    await sembrarGuia({ id: 'guia-vieja', titulo: 'Guía de prueba sin el campo', pasos: [pasoCompleto('vieja-p1')] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-vieja')
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    expect(listasComoHacerlo()).toEqual([])
    expect(textoPantalla()).not.toContain('Cómo hacerlo')
    expect(textoPantalla()).toContain(DATO)
    // Su "Dónde" heredado ya no se enseña (tarea 307), pero la guía carga.
    expect(textoPantalla()).not.toContain(DONDE)
  })

  it('la lista del encargo va justo debajo de la instrucción y cada papel queda en su sitio', async () => {
    await sembrarGuia({ id: 'guia-como', titulo: 'Guía de prueba con microacciones', pasos: [pasoCompleto('como-p1', MICRO)] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-como')
    await esperar(() => listasComoHacerlo()[0], 'la lista de "Cómo hacerlo"')

    // El orden de la ejecución mínima (tarea 307): Qué hacer, el riesgo,
    // "Cómo hacerlo" con su lista y el dato técnico. Ni "Dónde", ni el
    // "Debes ver" de texto, ni "Más información".
    const texto = textoPantalla()
    const posiciones = [
      texto.indexOf('Qué hacer'),
      texto.indexOf(ACCION),
      texto.indexOf(RIESGO),
      texto.indexOf('Cómo hacerlo'),
      texto.indexOf('Abre Fichero.'),
      texto.indexOf('Selecciona Nuevo.'),
      texto.indexOf('Dato técnico'),
      texto.indexOf(DATO),
    ]
    expect(posiciones.every((p) => p >= 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
    expect(texto).not.toContain(DONDE)
    expect(texto).not.toContain(DEBES_VER)
    expect(texto).not.toContain('Más información')

    // Una lista de verdad, con las frases en orden: cada una con su verbo.
    const lista = comprobarLista()

    // En el grupo de la instrucción: lo más cercano que contiene a las dos
    // es de la acción, no de la pantalla entera (el pie no está dentro).
    expect(instruccion().textContent).toBe(ACCION)
    const grupo = ancestroComun(instruccion(), lista)
    expect(grupo.querySelector('.sticky')).toBeNull()
  })

  it('la lista llega a la vista, sin nada que pulsar, numerada y con la ubicación bajo su número', async () => {
    await sembrarGuia({ id: 'guia-como', titulo: 'Guía de prueba con microacciones', pasos: [pasoCompleto('como-p1', MICRO)] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-como')
    const lista = await esperar(() => listasComoHacerlo()[0], 'la lista de "Cómo hacerlo"')
    // A la vista sin tocar nada: la ubicación ya se lee.
    expect(textoPantalla()).toContain('Barra superior')
    const como = bloqueComoHacerlo()
    expect(como.querySelector('button')).toBeNull()
    expect(como.querySelector('[aria-expanded]')).toBeNull()

    // Numerada, sin tarjetas: una lista ordenada con sus elementos.
    expect(lista.tagName).toBe('OL')
    expect(Array.from(lista.children).every((li) => li.tagName === 'LI')).toBe(true)
    expect(lista.classList.contains('list-decimal')).toBe(true)
    expect(clasesDe(lista).filter((c) => /^bg-|^rounded|^shadow|^border/.test(c))).toEqual([])
    // La ubicación vive DENTRO de su número, en una línea propia, más
    // pequeña y en gris; la palabra solo la oye el lector de pantalla.
    const ubicacion = lista.children[0].children[1] as HTMLElement
    expect(ubicacion.classList.contains('block')).toBe(true)
    expect(ubicacion.classList.contains('text-noct-neutral-400')).toBe(true)
    expect(ubicacion.classList.contains('text-[13px]')).toBe(true)
    expect(ubicacion.querySelector('.sr-only')?.textContent).toBe('Ubicación: ')
  })

  it('una sola microacción no es "Cómo hacerlo": ni lista ni rótulo, y el dato sigue ahí (tarea 309)', async () => {
    await sembrarGuia({ id: 'guia-una', titulo: 'Guía de prueba con una microacción', pasos: [pasoCompleto('una-p1', [MICRO[0]])] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-una')
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    expect(listasComoHacerlo()).toEqual([])
    expect(textoPantalla()).not.toContain('Cómo hacerlo')
    expect(textoPantalla()).not.toContain('Barra superior')
    sinRutaNiDesplegable()
    // La instrucción sigue mandando, y el dato no se tocó.
    expect(instruccion().textContent).toBe(ACCION)
    const guardada = (await db.articulos.get('guia-una'))?.procedimiento?.pasos[0].bloques.find((b) => b.tipo === 'tarea')
    expect(guardada?.comoHacer).toEqual([MICRO[0]])
  })

  it('es apoyo operativo y la instrucción sigue mandando', async () => {
    await sembrarGuia({ id: 'guia-como', titulo: 'Guía de prueba con microacciones', pasos: [pasoCompleto('como-p1', MICRO)] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-como')
    await esperar(() => listasComoHacerlo()[0], 'la lista de "Cómo hacerlo"')

    const como = bloqueComoHacerlo()
    const clases = clasesDe(como)
    // Sin rojo, ámbar ni verde, sin fondo ni monoespaciada: no es un aviso
    // ni un valor.
    expect(clases.filter((c) => /noct-(error|precaucion|exito|lugar|accion)/.test(c))).toEqual([])
    expect(clases.filter((c) => /^bg-/.test(c))).toEqual([])
    expect(clases).not.toContain('font-mono')
    expect(como.closest('h1, h2, h3')).toBeNull()
    // Nunca se recorta ni se abrevia: parte la línea dentro de su columna.
    expect(clases.filter((c) => /^line-clamp-|^truncate$/.test(c))).toEqual([])
    expect(clases).toContain('[overflow-wrap:anywhere]')
    // Más pequeña que la instrucción (16 px frente a 26 px), con un rótulo
    // pequeño como el de "Dato técnico".
    expect(clases).toContain('text-[16px]')
    expect(clases.filter((c) => /^text-\[(2[0-9]|[3-9][0-9])px\]$|^text-(xl|[2-9]xl)$/.test(c))).toEqual([])
    expect(instruccion().classList.contains('text-[26px]')).toBe(true)
    const rotulo = como.firstElementChild as HTMLElement
    expect(rotulo.textContent).toBe('Cómo hacerlo')
    expect(rotulo.classList.contains('uppercase')).toBe(true)
    expect(rotulo.classList.contains('text-[12px]')).toBe(true)
  })

  it('la acción siguiente enseña su propia lista, con su ubicación, sin pulsar nada', async () => {
    const base = pasoPrueba('dos-p1', 'Crear dos registros de ejemplo', [ACCION, 'Abre otro registro de ejemplo'])
    await sembrarGuia({
      id: 'guia-dos',
      titulo: 'Guía de prueba con dos acciones',
      pasos: [
        {
          ...base,
          bloques: [
            conComo(base.bloques[0], MICRO),
            conComo(base.bloques[1], [
              { id: 'o1', accion: 'Pulsa', elemento: 'Otro', ubicacion: 'Menú de ejemplo' },
              { id: 'o2', accion: 'Selecciona', elemento: 'Guardar' },
            ]),
          ],
        },
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-dos')
    await esperar(() => listasComoHacerlo()[0], 'la lista de la primera acción')
    comprobarLista()

    await tocar(await esperarControl(/^Completar y seguir$/))
    const siguiente = await esperar(
      () => listasComoHacerlo().find((ol) => frases(ol)[0] === 'Pulsa Otro.'),
      'la lista de la acción siguiente',
    )
    expect(frases(siguiente)).toEqual(['Pulsa Otro.', 'Selecciona Guardar.'])
    expect(textoDe(siguiente.children[0].children[1])).toBe('Ubicación: Menú de ejemplo')
    expect(listasComoHacerlo()).toHaveLength(1)
  })

  it('un comando escrito como elemento conserva su "¿Qué hace?" del Centro de consulta', async () => {
    await sembrarReferencia({ id: 'ref-ejemplo', tipo: 'comando', titulo: 'Comando de ejemplo', valor: 'comando-ejemplo' })
    const atajo: MicroPasoComoHacer[] = [
      { id: 'a1', accion: 'Pulsa', elemento: 'Windows + R' },
      { id: 'a2', accion: 'Escribe', elemento: 'comando-ejemplo' },
      { id: 'a3', accion: 'Pulsa', elemento: 'Enter' },
    ]
    const base = pasoPrueba('cmd-p1', 'Abrir la herramienta de ejemplo', ['Abre la herramienta de ejemplo'])
    await sembrarGuia({ id: 'guia-cmd', titulo: 'Guía de prueba con atajo', pasos: [{ ...base, bloques: [conComo(base.bloques[0], atajo)] }] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-cmd')
    const lista = await esperar(() => listasComoHacerlo()[0], 'la lista del atajo')
    expect(frases(lista)).toEqual(['Pulsa Windows + R.', 'Escribe comando-ejemplo.', 'Pulsa Enter.'])
    await esperarControl('¿Qué hace «comando-ejemplo»?')
  })

  it('una microacción a medias del dato no se enseña ni se completa inventando nada', async () => {
    // Un dato externo con dos microacciones a medias entre dos completas: no
    // rompe la guía, no se completa inventando nada y no aparece.
    const conAMedias = [
      MICRO[0],
      { id: 'sin-elemento', accion: 'Reinicia', elemento: '' },
      { id: 'sin-accion', accion: '', elemento: 'Ayuda', ubicacion: 'Menú de ejemplo' },
      MICRO[3],
    ]
    await sembrarGuia({ id: 'guia-a-medias', titulo: 'Guía de prueba con datos a medias', pasos: [pasoCompleto('med-p1', conAMedias)] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-a-medias')
    const lista = await esperar(() => listasComoHacerlo()[0], 'la lista de las completas')
    expect(frases(lista)).toEqual(['Abre Fichero.', 'Selecciona Nuevo.'])
    for (const ausente of ['Reinicia', 'Ayuda', 'Menú de ejemplo']) expect(textoPantalla()).not.toContain(ausente)
    // El resto de la acción, como siempre.
    expect(textoPantalla()).toContain(ACCION)
    expect(textoPantalla()).toContain(DATO)
  })
})

describe('las demás vistas enseñan lo mismo', () => {
  beforeEach(async () => {
    await sembrarGuia({ id: 'guia-como', titulo: 'Guía de prueba con microacciones', pasos: [pasoCompleto('como-p1', MICRO)] })
  })

  it('el paso entero, bajo la tarea y antes del dato, en el tamaño de su fila', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-como')
    await esperar(() => textoPantalla().includes(ACCION), 'la acción')
    await tocar(await esperarControl(/^Paso 1 de 1\. Abrir el índice de pasos$/))
    await tocar(await esperarControl(/^Ver el paso entero$/))
    await esperar(() => document.body.querySelector('button[role="checkbox"]'), 'la vista de paso entero')

    const lista = comprobarLista()
    const texto = textoPantalla()
    expect(texto.indexOf(ACCION)).toBeLessThan(texto.indexOf('Abre Fichero.'))
    expect(texto.indexOf('Selecciona Nuevo.')).toBeLessThan(texto.indexOf(DATO))
    expect(clasesDe(bloqueComoHacerlo()).filter((c) => /^bg-|font-mono|noct-(error|precaucion|exito)/.test(c))).toEqual([])
    // La variante de la fila: la lista (14 px) por debajo de su tarea (16 px).
    expect(lista.classList.contains('text-[14px]')).toBe(true)
  })

  it('la lectura de la guía entera (la vista previa del editor)', async () => {
    // "Detalles de la guía" ya no enseña los pasos (tarea 2 del encargo del
    // 2026-09-10): la lectura de todos los pasos es la vista previa.
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-como/editar')
    await tocar(await esperarControl(/^Vista previa$/))
    await esperar(() => listasComoHacerlo()[0], 'la lista en la lectura')
    expect(textoPantalla().indexOf(ACCION)).toBeLessThan(textoPantalla().indexOf('Abre Fichero.'))
    comprobarLista()
  })

  it('"Probar" desde el editor', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-como/editar')
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(/^Crear el registro de ejemplo/)
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
    await tocar(await esperarControl(/^Probar$/))
    await tocar(await esperarControl(/^Ver como técnico$/))
    await esperar(() => textoPantalla().includes('Como lo ve el técnico') && listasComoHacerlo()[0], 'la prueba del paso')
    comprobarLista()
  })
})

describe('dentro de una guía reutilizada', () => {
  beforeEach(async () => {
    const base = pasoPrueba('reu-p1', 'Abrir el registro', [ACCION])
    await sembrarGuia({
      id: 'guia-reutilizada',
      titulo: 'Abrir un registro de ejemplo',
      pasos: [{ ...base, bloques: [conComo(base.bloques[0], MICRO)] }],
    })
  })

  it('se ve en el flujo de la guía que la reutiliza', async () => {
    await sembrarGuia({
      id: 'guia-que-reutiliza',
      titulo: 'Registrar un cliente de ejemplo',
      pasos: [
        { ...pasoPrueba('qr-p1', 'Entrar al registro', []), subArticuloId: 'guia-reutilizada', subArticuloTitulo: 'Abrir un registro de ejemplo' },
        pasoPrueba('qr-p2', 'Revisar', ['Revisa el registro de ejemplo']),
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-que-reutiliza')
    await esperar(() => textoPantalla().includes(ACCION), 'la acción reutilizada, en el sitio')
    comprobarLista()
  })

  it('y al leer el paso que la reutiliza (consulta), en el tamaño de la lectura compacta', async () => {
    await sembrarGuia({
      id: 'guia-que-consulta',
      titulo: 'Registrar un cliente de ejemplo más tarde',
      pasos: [
        pasoPrueba('qc-p1', 'Preparar', ['Prepara los datos de ejemplo']),
        { ...pasoPrueba('qc-p2', 'Entrar al registro', []), subArticuloId: 'guia-reutilizada', subArticuloTitulo: 'Abrir un registro de ejemplo' },
      ],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-que-consulta')
    await esperar(() => textoPantalla().includes('Prepara los datos de ejemplo'), 'el paso 1')
    // El nodo del paso 2 de la ruta lo abre en consulta: se lee, nada se marca.
    await tocar(await esperarControl(/^Paso 2 de 2: /))
    const lectura = await esperar(
      () => document.body.querySelector<HTMLElement>('[aria-label="Lo que se hace en este paso"]'),
      'la lectura de lo reutilizado',
    )
    expect(lectura.textContent).toContain(ACCION)
    const lista = comprobarLista(lectura)
    // La variante de la lectura: la lista (13 px) por debajo de su tarea (14 px).
    expect(lista.classList.contains('text-[13px]')).toBe(true)
  })
})

describe('con las decisiones de la tarea 302', () => {
  it('una decisión con opciones lleva por su camino, y la acción de ese camino enseña su "Cómo hacerlo"', async () => {
    const opciones: OpcionDecision[] = [
      { id: 'op-a', titulo: 'Versión de prueba A', descripcion: '', destino: { tipo: 'paso', pasoId: 'dec-p2' } },
      { id: 'op-b', titulo: 'Versión de prueba B', descripcion: '', destino: { tipo: 'paso', pasoId: 'dec-p3' } },
    ]
    const p1 = pasoPrueba('dec-p1', 'Identificar la versión', [])
    // Una decisión no tiene "Cómo hacerlo": si el dato lo trajera, no se lee.
    p1.bloques = [{ ...decision('dec-pregunta', '¿Qué versión de prueba usas?', opciones), comoHacer: [{ id: 'x', accion: 'Abre', elemento: 'Ayuda' }] }]
    const p2 = pasoPrueba('dec-p2', 'Registrar en la versión A', [ACCION])
    p2.bloques = [conComo(p2.bloques[0], MICRO)]
    await sembrarGuia({
      id: 'guia-decision',
      titulo: 'Guía de prueba con pregunta',
      pasos: [p1, { ...p2, alTerminar: { tipo: 'fin' } }, pasoPrueba('dec-p3', 'Registrar en la versión B', ['Sigue con la versión B'])],
    })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-decision')
    await esperar(() => textoPantalla().includes('¿Qué versión de prueba usas?'), 'la pregunta')
    expect(listasComoHacerlo()).toEqual([])

    await tocar(await esperarControl(/^Versión de prueba A/))
    await esperar(() => listasComoHacerlo()[0], 'la acción del camino A con su lista')
    expect(textoPantalla()).not.toContain('Sigue con la versión B')
    comprobarLista()
  })

  it('una decisión de Sí/No de las de antes se responde como siempre y la acción siguiente enseña su lista', async () => {
    const p1 = pasoPrueba('sn-p1', 'Comprobar el registro', ['¿Existe ya el registro de ejemplo?'])
    p1.bloques[0] = { ...p1.bloques[0], tipoTarea: 'decision', comoHacer: [{ id: 'x', accion: 'Abre', elemento: 'Lista' }] }
    const p2 = pasoPrueba('sn-p2', 'Crear el registro', [ACCION])
    p2.bloques = [conComo(p2.bloques[0], MICRO)]
    await sembrarGuia({ id: 'guia-si-no', titulo: 'Guía de prueba con Sí y No', pasos: [p1, p2] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-si-no')
    await esperar(() => textoPantalla().includes('¿Existe ya el registro de ejemplo?'), 'la pregunta')
    expect(listasComoHacerlo()).toEqual([])
    await tocar(await esperarControl('Sí: seguir con la guía'))
    await esperar(() => listasComoHacerlo()[0], 'la acción siguiente con su lista')
    comprobarLista()
  })
})

describe('sin conexión', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('la lista sale de la base local, sin pedir nada a la red', async () => {
    const red = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', red)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await sembrarGuia({ id: 'guia-como', titulo: 'Guía de prueba con microacciones', pasos: [pasoCompleto('como-p1', MICRO)] })
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-como')
    await esperar(() => listasComoHacerlo()[0], 'la lista sin red')
    comprobarLista()
    expect(red).not.toHaveBeenCalled()
  })
})

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

async function tareaGuardada(): Promise<BloquePaso | undefined> {
  return (await db.articulos.get('guia-editor'))?.procedimiento?.pasos[0]?.bloques.find((b) => b.tipo === 'tarea')
}

describe('en el editor', () => {
  async function abrirElEditor(): Promise<void> {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-editor/editar')
    await tocar(await esperarControl(/^Pasos/))
    const plegado = control(/^Crear el registro de ejemplo/)
    if (plegado && !control(/^Añadir una tarea al paso/)) await tocar(plegado)
  }

  /** Selecciona la tarea como lo hace el autor: tocándola. */
  async function seleccionar(texto: string): Promise<void> {
    const entrada = await esperar(
      () => Array.from(document.body.querySelectorAll<HTMLInputElement>('input')).find((i) => i.value === texto),
      `el campo de la tarea «${texto}»`,
    )
    await act(async () => {
      entrada.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    await pausa()
  }

  async function sembrarEditor(comoHacer?: MicroPasoComoHacer[]): Promise<void> {
    const base = pasoPrueba('ed-p1', 'Crear el registro de ejemplo', [ACCION, 'Comprueba el registro de ejemplo'])
    base.bloques = [conComo(base.bloques[0], comoHacer), { ...base.bloques[1], tipoTarea: 'verificacion' }]
    await sembrarGuia({ id: 'guia-editor', titulo: 'Guía de prueba para el editor', pasos: [base] })
  }

  it('se ofrece en la acción que se está escribiendo, no en una verificación', async () => {
    await sembrarEditor()
    await abrirElEditor()
    await seleccionar('Comprueba el registro de ejemplo')
    expect(control(/^Cómo hacerlo/)).toBeNull()
    await seleccionar(ACCION)
    expect(await esperarControl(/^Cómo hacerlo · opcional$/)).not.toBeNull()
  })

  it('se escriben las microacciones bajo la acción, con su ayuda, y se guardan dentro de la tarea', async () => {
    await sembrarEditor()
    await abrirElEditor()
    await seleccionar(ACCION)
    await tocar(await esperarControl(/^Cómo hacerlo · opcional$/))

    // La primera microacción nace con el foco en su acción.
    const primera = await esperar(() => campo('Acción de la microacción 1'), 'la primera microacción')
    expect(document.activeElement).toBe(primera)
    // La ayuda dice cómo se verá (tarea 310): una lista numerada, con la
    // ubicación debajo de su acción. Nada de "Ruta rápida" ni "Ver paso a paso".
    expect(textoPantalla()).toContain(
      'Divide aquí una acción cuando requiere varios gestos. Con dos o más se mostrará Cómo hacerlo como una lista numerada.',
    )
    expect(textoPantalla()).toContain('Añade Ubicación solo cuando ayude a encontrar un elemento. Se mostrará debajo de esa acción.')
    expect(textoPantalla()).not.toContain('Ruta rápida')
    expect(textoPantalla()).not.toContain('Ver paso a paso')
    expect(textoPantalla()).not.toContain('Se usarán para mostrar una ruta rápida y un paso a paso.')
    // Sin ejemplos dentro de los campos: el contenido lo decide quien escribe.
    expect(primera.placeholder).toBe('')

    await rellenar(1, '  Abre ', ' Fichero', ' Barra superior ')
    for (const [numero, accion, elemento] of [
      [2, 'Selecciona', 'Cliente'],
      [3, 'Abre', 'Fichero'],
      [4, 'Selecciona', 'Nuevo'],
    ] as const) {
      await tocar(await esperarControl('Añadir microacción'))
      expect(document.activeElement).toBe(campo(`Acción de la microacción ${numero}`))
      await rellenar(numero, accion, elemento)
    }
    // Una fila vacía al final no se guarda.
    await tocar(await esperarControl('Añadir microacción'))

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => ((await tareaGuardada())?.comoHacer?.length ?? 0) === 4, 'las cuatro microacciones guardadas')
    const guardada = await tareaGuardada()
    expect(guardada?.comoHacer?.map(({ accion, elemento, ubicacion }) => ({ accion, elemento, ubicacion }))).toEqual([
      { accion: 'Abre', elemento: 'Fichero', ubicacion: 'Barra superior' },
      { accion: 'Selecciona', elemento: 'Cliente', ubicacion: undefined },
      { accion: 'Abre', elemento: 'Fichero', ubicacion: undefined },
      { accion: 'Selecciona', elemento: 'Nuevo', ubicacion: undefined },
    ])
    expect(new Set(guardada?.comoHacer?.map((m) => m.id)).size).toBe(4)
    // Lo demás de la tarea no cambió.
    expect(guardada?.texto).toBe(ACCION)
  })

  /** El aviso de lo que le falta a la fila N ("Falta el elemento."), o null. */
  function avisoDeFila(numero: number): string | null {
    const fila = campo(`Acción de la microacción ${numero}`)?.closest('li')
    const aviso = fila ? Array.from(fila.querySelectorAll('p')).find((p) => /^Faltan? /.test(textoDe(p))) : undefined
    return aviso ? textoDe(aviso) : null
  }

  it('acción y elemento son obligatorios: la fila dice cuál falta, marca el campo y corregirlo quita el aviso', async () => {
    await sembrarEditor()
    await abrirElEditor()
    await seleccionar(ACCION)
    await tocar(await esperarControl(/^Cómo hacerlo · opcional$/))
    // Recién creada y vacía todavía no es una microacción: no le falta nada.
    expect(avisoDeFila(1)).toBeNull()
    expect(campo('Acción de la microacción 1')?.getAttribute('aria-required')).toBe('true')
    expect(campo('Elemento de la microacción 1')?.getAttribute('aria-required')).toBe('true')

    // Solo el elemento: falta la acción, y su campo lo dice.
    await escribir(await esperar(() => campo('Elemento de la microacción 1'), 'el elemento'), 'Fichero')
    const accion = campo('Acción de la microacción 1') as HTMLInputElement
    expect(avisoDeFila(1)).toBe('Falta la acción.')
    expect(accion.getAttribute('aria-invalid')).toBe('true')
    expect(accion.classList.contains('border-noct-error')).toBe(true)
    expect(document.getElementById(accion.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Falta la acción.')
    expect(campo('Elemento de la microacción 1')?.hasAttribute('aria-invalid')).toBe(false)

    // Con la acción, completa: el aviso y la marca se van.
    await escribir(accion, 'Abre')
    expect(avisoDeFila(1)).toBeNull()
    expect(accion.hasAttribute('aria-invalid')).toBe(false)

    // Sin el elemento (los espacios no cuentan): falta el elemento.
    await escribir(campo('Elemento de la microacción 1') as HTMLInputElement, '   ')
    expect(avisoDeFila(1)).toBe('Falta el elemento.')
    expect(campo('Elemento de la microacción 1')?.getAttribute('aria-invalid')).toBe('true')
    expect(accion.hasAttribute('aria-invalid')).toBe(false)

    // Solo la ubicación: faltan los dos.
    await escribir(accion, '')
    await escribir(campo('Ubicación (opcional) de la microacción 1') as HTMLInputElement, 'Barra superior')
    expect(avisoDeFila(1)).toBe('Faltan la acción y el elemento.')

    // Completa y sin ubicación: válida. La ubicación vacía nunca es un error.
    await rellenar(1, 'Abre', 'Fichero')
    await escribir(campo('Ubicación (opcional) de la microacción 1') as HTMLInputElement, '')
    expect(avisoDeFila(1)).toBeNull()
    expect(campo('Ubicación (opcional) de la microacción 1')?.hasAttribute('aria-invalid')).toBe(false)
    expect(campo('Ubicación (opcional) de la microacción 1')?.hasAttribute('aria-required')).toBe(false)
  })

  it('con una microacción a medias no se guarda: lo dice arriba, conserva lo escrito y lleva el foco al campo vacío', async () => {
    await sembrarEditor([MICRO[0]])
    await abrirElEditor()
    const antes = await db.articulos.get('guia-editor')
    // Una segunda, solo con la acción.
    await tocar(await esperarControl('Añadir microacción'))
    await escribir(await esperar(() => campo('Acción de la microacción 2'), 'la acción 2'), 'Selecciona')
    expect(avisoDeFila(2)).toBe('Falta el elemento.')

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperar(() => textoPantalla().includes('Antes de guardar, corrige esto:'), 'el aviso de lo que falta')
    expect(textoPantalla()).toContain('A la microacción 2 de «Abre un registro nuevo» le falta el elemento.')
    // El foco, en el campo que falta; lo escrito sigue ahí.
    await esperar(() => document.activeElement === campo('Elemento de la microacción 2'), 'el foco en el elemento vacío')
    expect(campo('Acción de la microacción 2')?.value).toBe('Selecciona')
    // Nada se guardó: ni la microacción a medias como válida, ni nada más.
    await pausa(150)
    const despues = await db.articulos.get('guia-editor')
    expect(despues?.updatedAt).toBe(antes?.updatedAt)
    expect(despues?.procedimiento?.pasos[0].bloques[0].comoHacer).toEqual([MICRO[0]])

    // El aviso de arriba también lleva a ese campo.
    ;(campo('Acción de la microacción 1') as HTMLInputElement).focus()
    await tocar(await esperarControl(/^Paso 1A la microacción 2 de «Abre un registro nuevo» le falta el elemento\./))
    await esperar(() => document.activeElement === campo('Elemento de la microacción 2'), 'el foco de vuelta en el elemento')

    // Corregido, se guarda entero y el aviso se va.
    await escribir(campo('Elemento de la microacción 2') as HTMLInputElement, 'Cliente')
    expect(textoPantalla()).not.toContain('Antes de guardar, corrige')
    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => (await tareaGuardada())?.comoHacer?.length === 2, 'las dos guardadas')
    expect((await tareaGuardada())?.comoHacer?.[1]).toMatchObject({ accion: 'Selecciona', elemento: 'Cliente' })
  })

  it('al volver a abrir la guía aparecen como se guardaron; reordenar y quitar conservan los ids', async () => {
    await sembrarEditor(MICRO)
    await abrirElEditor()
    // Con microacciones se ven siempre, sin seleccionar la tarea.
    expect((await esperar(() => campo('Elemento de la microacción 1'), 'la lista guardada')).value).toBe('Fichero')
    expect(campo('Ubicación (opcional) de la microacción 1')?.value).toBe('Barra superior')
    expect(campo('Elemento de la microacción 4')?.value).toBe('Nuevo')
    expect(control('Subir la microacción 1')?.hasAttribute('disabled')).toBe(true)
    expect(control('Bajar la microacción 4')?.hasAttribute('disabled')).toBe(true)

    // Bajar la primera: el foco sigue en su flecha, en su sitio nuevo.
    await tocar(control('Bajar la microacción 1') as HTMLElement)
    expect(campo('Elemento de la microacción 1')?.value).toBe('Cliente')
    expect(document.activeElement).toBe(control('Bajar la microacción 2'))
    // Quitar la tercera (la segunda "Abre Fichero"): el foco pasa a la que ocupa su sitio.
    await tocar(control('Quitar la microacción 3') as HTMLElement)
    expect(campo('Elemento de la microacción 4')).toBeNull()
    expect(document.activeElement).toBe(control('Quitar la microacción 3'))

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => (await tareaGuardada())?.comoHacer?.length === 3, 'la lista reordenada guardada')
    expect((await tareaGuardada())?.comoHacer).toEqual([MICRO[1], MICRO[0], MICRO[3]])
  })

  it('quitarlas todas borra la clave, y el foco vuelve a "Cómo hacerlo"', async () => {
    await sembrarEditor([MICRO[0], MICRO[1]])
    await abrirElEditor()
    await seleccionar(ACCION)
    await tocar(await esperarControl('Quitar la microacción 2'))
    await tocar(await esperarControl('Quitar la microacción 1'))
    const anadir = await esperarControl(/^Cómo hacerlo · opcional$/)
    expect(document.activeElement).toBe(anadir)

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => {
      const tarea = await tareaGuardada()
      return tarea !== undefined && !('comoHacer' in tarea)
    }, 'la tarea guardada sin la clave')
  })

  it('pasar la acción a verificación suelta el "Cómo hacerlo" y lo dice', async () => {
    await sembrarEditor(MICRO)
    await abrirElEditor()
    await seleccionar(ACCION)
    await tocar(await esperarControl('Tipo de línea: Acción. Tocar para cambiarlo'))
    await tocar(await esperarControl(/^Verificación/))
    await esperar(
      () => textoPantalla().includes('Al pasar a «Verificación» se soltó «Cómo hacerlo» (4 microacciones).'),
      'el aviso de lo que se soltó',
    )
    expect(campo('Acción de la microacción 1')).toBeNull()

    await tocar(await esperarControl('Guardar procedimiento'))
    await esperarQue(async () => (await tareaGuardada())?.tipoTarea === 'verificacion', 'la tarea guardada como verificación')
    expect('comoHacer' in ((await tareaGuardada()) ?? {})).toBe(false)
  })
})

describe('en el computador atendido (asistencia)', () => {
  it('llega el paso a paso numerado con su nombre, y no como una información', async () => {
    await montar(
      [
        {
          ruta: '/portal',
          elemento: (
            <VistaContenidoAsistencia
              contenido={{
                v: 1,
                titulo: 'Paso 1 · Crear el registro de ejemplo',
                bloques: [
                  { tipo: 'accion', texto: ACCION },
                  {
                    tipo: 'nota',
                    texto: '1. Abre Fichero (Barra superior).\n2. Selecciona Cliente.\n3. Abre Fichero.\n4. Selecciona Nuevo.',
                    etiqueta: 'Cómo hacerlo',
                  },
                ],
              }}
            />
          ),
        },
      ],
      '/portal',
    )
    await esperar(() => textoPantalla().includes('Selecciona Nuevo.'), 'el "Cómo hacerlo" en el portal')
    expect(textoPantalla()).not.toContain('Información:')
    const parrafo = elementoCon('1. Abre Fichero (Barra superior).')
    // Cada microacción en su línea, como llegó.
    expect(parrafo.classList.contains('whitespace-pre-line')).toBe(true)
    expect(parrafo.previousElementSibling?.textContent).toBe('Cómo hacerlo')
    expect(textoPantalla().indexOf(ACCION)).toBeLessThan(textoPantalla().indexOf('1. Abre Fichero'))
  })
})
