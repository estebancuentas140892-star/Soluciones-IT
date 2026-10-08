// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type MicroPasoComoHacer, type PasoProcedimiento } from '../../lib/db'
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
//     una ubicación), decidido por estructura.
//
// Todo lo sembrado es inventado; el caso del respaldo copia la FORMA del
// caso real (tres microacciones: abrir la carpeta, copiar, pegar).

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/editar', elemento: <ArticuloForm /> },
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
