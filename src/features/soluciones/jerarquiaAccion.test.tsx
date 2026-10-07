// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
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
import { GuiaPage } from './GuiaPage'

// JERARQUÍA DE UNA ACCIÓN (tarea 303, regla 27, AD-066).
//
// Una pantalla es una acción clara, y eso no significa meterlo todo en una
// caja: cada papel conserva su sitio y la pantalla hace evidente cuál manda.
// El caso es el de la referencia (exportar un buzón a un archivo), con
// textos inventados y TODOS los papeles en la misma acción:
//
//   Dónde            Aplicación de correo
//   Qué hacer        Abre la opción de exportación
//   Dato técnico     Backup_2026-10-07.pst
//   Debes ver        El asistente de exportación queda abierto
//   Más información  una explicación opcional
//   Advertencia      un riesgo real e independiente
//
// «Cómo hacerlo» (Archivo → Herramientas → Exportar) todavía no tiene sitio
// en el modelo: necesita un tono nuevo, que cambia el contrato de datos, y
// espera la decisión del usuario (TAREAS.md, tarea 303).
//
// happy-dom no aplica Tailwind, así que lo visual se comprueba por las
// CLASES, como en `nombresSinRecorte.test.tsx`. La medida real a 390 × 844 y
// 375 × 667, y con el texto al 130 %, se hizo en el navegador (CHANGELOG).

const RUTA = '/soluciones/cat-pruebas/guia-jerarquia'

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

const DONDE = 'Aplicación de correo'
const ACCION = 'Abre la opción de exportación'
const DATO = 'Backup_2026-10-07.pst'
const DEBES_VER = 'El asistente de exportación queda abierto'
const EXPLICACION = 'El archivo conserva carpetas, contactos y calendario de prueba'
const RIESGO = 'Si el disco de destino se llena, la exportación se corta y el archivo queda incompleto'

function aviso(id: string, tono: BloquePaso['tono'], texto: string): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', texto, tono, alcance: 'tarea', tareaId: 'jer-p1-t1' }
}

/** Un paso de una sola acción con todos los papeles; el riesgo va antes de la acción, como lo pondría el autor. */
async function sembrarCaso() {
  const base = pasoPrueba('jer-p1', 'Exportar el buzón de prueba', [ACCION])
  const paso: PasoProcedimiento = {
    ...base,
    lugar: DONDE,
    resultado: DEBES_VER,
    bloques: [
      aviso('jer-riesgo', 'precaucion', RIESGO),
      ...base.bloques,
      aviso('jer-dato', 'dato', DATO),
      aviso('jer-info', 'info', EXPLICACION),
    ],
  }
  await sembrarGuia({ id: 'guia-jerarquia', titulo: 'Exportar un buzón de prueba', pasos: [paso] })
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

/** El bloque de una señal: el aviso o el párrafo que la contiene entera. */
function bloqueDe(texto: string): HTMLElement {
  const elemento = elementoCon(texto)
  return elemento.closest<HTMLElement>('[role="note"]') ?? elemento.closest<HTMLElement>('p') ?? elemento
}

/** El dato técnico: su rótulo y su valor, juntos en el mismo bloque. */
function datoTecnico(valor: string): { bloque: HTMLElement; valor: HTMLElement } {
  const elementoValor = elementoCon(valor)
  const bloque = elementoValor.parentElement
  if (!bloque || !Array.from(bloque.children).some((hijo) => hijo !== elementoValor && hijo.textContent === 'Dato técnico')) {
    throw new Error(`El dato ${valor} no lleva su rótulo`)
  }
  return { bloque, valor: elementoValor }
}

/** Todas las clases del elemento y de lo que lleva dentro. */
function clasesDe(elemento: Element): string[] {
  return [elemento, ...Array.from(elemento.querySelectorAll('*'))].flatMap((e) => Array.from(e.classList))
}

/** La instrucción de la acción: el encabezado que recibe el foco. */
function instruccion(): HTMLElement {
  const h2 = document.body.querySelector<HTMLElement>('h2[data-foco-lectura]')
  if (!h2) throw new Error('No hay instrucción en pantalla')
  return h2
}

/** El ancestro común más cercano de dos elementos. */
function ancestroComun(a: Element, b: Element): Element {
  let nodo: Element | null = a
  while (nodo && !nodo.contains(b)) nodo = nodo.parentElement
  if (!nodo) throw new Error('Sin ancestro común')
  return nodo
}

/** Lo que se lee en la pantalla de la acción: sin la cabecera ni el pie fijo. */
function contenidoDeLaAccion(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('*')).filter(
    (e) => !e.closest('.sticky') && !e.closest('header'),
  )
}

/** El cuerpo de la acción: lo que reúne del riesgo al "Debes ver". */
function cuerpoDeLaAccion(): Element {
  return ancestroComun(bloqueDe(`Precaución. ${RIESGO}`), bloqueDe(`Debes ver: ${DEBES_VER}`))
}

async function abrirLaAccion() {
  await sembrarCaso()
  await montar(RUTAS, RUTA)
  await esperar(() => textoPantalla().includes(ACCION), 'la acción')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('una acción con todos sus papeles', () => {
  it('todos conviven en la misma pantalla y se leen en el orden en que se usan', async () => {
    await abrirLaAccion()
    const texto = textoPantalla()

    const posiciones = [
      texto.indexOf(`Precaución. ${RIESGO}`),
      texto.indexOf(`Dónde: ${DONDE}`),
      texto.indexOf('Qué hacer'),
      texto.indexOf(ACCION),
      texto.indexOf('Dato técnico'),
      texto.indexOf(DATO),
      texto.indexOf(`Debes ver: ${DEBES_VER}`),
      texto.indexOf('Más información'),
    ]
    // Todos están, y en ese orden: el riesgo antes de actuar, dónde estar,
    // qué hacer con el valor que necesita, qué comprobar y, al final, lo
    // opcional.
    expect(posiciones.every((p) => p >= 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
  })

  it('solo la instrucción domina: es el encabezado y el único texto grande', async () => {
    await abrirLaAccion()

    const h2 = instruccion()
    expect(h2.textContent).toBe(ACCION)
    expect(h2.classList.contains('text-[26px]')).toBe(true)
    // Nunca se recorta: parte la línea dentro de su columna (regla 23).
    expect(h2.classList.contains('min-w-0')).toBe(true)
    expect(h2.classList.contains('[overflow-wrap:anywhere]')).toBe(true)
    expect(Array.from(h2.classList).some((c) => /^line-clamp-|^truncate$/.test(c))).toBe(false)

    // Nada más en la pantalla de la acción usa una letra de ese tamaño.
    const grandes = contenidoDeLaAccion().filter(
      (e) => e !== h2 && Array.from(e.classList).some((c) => /^text-\[(2[0-9]|[3-9][0-9])px\]$|^text-(xl|[2-9]xl)$/.test(c)),
    )
    expect(grandes).toEqual([])
  })

  it('Dónde orienta: neutro, con su palabra y su icono, sin parecer una advertencia', async () => {
    await abrirLaAccion()

    const donde = bloqueDe(`Dónde: ${DONDE}`)
    const clases = clasesDe(donde)
    // Ni amarillo ni ámbar: el ámbar con texto es "requiere atención".
    expect(clases.filter((c) => /lugar|precaucion|amber|yellow|error/.test(c))).toEqual([])
    // Ni fondo ni barra lateral: no es una caja ni un aviso.
    expect(clases.filter((c) => /^bg-|^border-l/.test(c))).toEqual([])
    expect(donde.querySelector('svg')).not.toBeNull()
    // Separado de la acción: no comparte su encabezado.
    expect(donde.contains(instruccion())).toBe(false)
  })

  it('el dato técnico va con su instrucción y no parece una segunda acción', async () => {
    await abrirLaAccion()

    // Con su rótulo, que dice qué es (lo comprueba `datoTecnico`).
    const { valor } = datoTecnico(DATO)
    // Un valor que se escribe tal cual, más pequeño que la instrucción.
    expect(valor.classList.contains('font-mono')).toBe(true)
    expect(valor.closest('h1, h2, h3')).toBeNull()
    expect(clasesDe(valor).filter((c) => /^text-\[(2[0-9]|[3-9][0-9])px\]$/.test(c))).toEqual([])
    // Agrupado con la instrucción: lo más cercano que los contiene a los
    // dos no contiene también el "Dónde" ni el "Debes ver".
    const grupo = ancestroComun(instruccion(), valor)
    expect(grupo.contains(bloqueDe(`Dónde: ${DONDE}`))).toBe(false)
    expect(grupo.contains(bloqueDe(`Debes ver: ${DEBES_VER}`))).toBe(false)
  })

  it('Debes ver comprueba: verde en su palabra, sin caja que compita con la acción', async () => {
    await abrirLaAccion()

    const debesVer = bloqueDe(`Debes ver: ${DEBES_VER}`)
    const rotulo = elementoCon('Debes ver:')
    expect(rotulo.classList.contains('text-noct-exito')).toBe(true)
    expect(clasesDe(debesVer).filter((c) => /^bg-|^border-l/.test(c))).toEqual([])
  })

  it('Más información queda cerrado y guarda solo lo que no hace falta para actuar', async () => {
    await abrirLaAccion()

    const boton = await esperarControl(/^Más información/)
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(textoPantalla()).not.toContain(EXPLICACION)
    // Lo necesario para hacer la acción está a la vista sin abrir nada.
    expect(textoPantalla()).toContain(DATO)
    expect(textoPantalla()).toContain(DONDE)

    await tocar(boton)
    await esperar(() => textoPantalla().includes(EXPLICACION), 'la explicación opcional')
    expect(control(/^Menos información/)?.getAttribute('aria-expanded')).toBe('true')
  })

  it('la advertencia es la excepción: un riesgo antes de actuar y el único bloque con fondo de color', async () => {
    await abrirLaAccion()

    const alerta = bloqueDe(`Precaución. ${RIESGO}`)
    expect(alerta.getAttribute('role')).toBe('note')
    expect(clasesDe(alerta).some((c) => /^bg-noct-error/.test(c))).toBe(true)

    // Ningún otro papel de la acción lleva fondo de color de estado.
    const conFondoDeEstado = Array.from(cuerpoDeLaAccion().querySelectorAll('*')).filter(
      (e) => !alerta.contains(e) && Array.from(e.classList).some((c) => /^bg-noct-(error|exito|precaucion|lugar|accion)/.test(c)),
    )
    expect(conFondoDeEstado).toEqual([])
  })
})

describe('la misma jerarquía en la vista de paso entero', () => {
  it('dónde neutro, el dato con su rótulo, debes ver sin caja y el riesgo en rojo', async () => {
    await abrirLaAccion()

    await tocar(await esperarControl(/^Paso 1 de 1\. Abrir el índice de pasos$/))
    await tocar(await esperarControl(/^Ver el paso entero$/))
    // En el paso entero la acción es una fila con su casilla.
    await esperar(() => document.body.querySelector('button[role="checkbox"]'), 'la vista de paso entero')

    const texto = textoPantalla()
    expect(texto).toContain(`Dónde: ${DONDE}`)
    expect(texto).toContain(`Debes ver: ${DEBES_VER}`)
    expect(texto).toContain(ACCION)

    expect(clasesDe(bloqueDe(`Dónde: ${DONDE}`)).filter((c) => /lugar|precaucion|^bg-|^border-l/.test(c))).toEqual([])
    expect(datoTecnico(DATO).valor.classList.contains('font-mono')).toBe(true)
    expect(clasesDe(bloqueDe(`Debes ver: ${DEBES_VER}`)).filter((c) => /^bg-|^border-l/.test(c))).toEqual([])
    const riesgo = elementoCon(RIESGO).closest('div')
    expect(riesgo && clasesDe(riesgo).some((c) => /^bg-noct-error/.test(c))).toBe(true)
  })
})
