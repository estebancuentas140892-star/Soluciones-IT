// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Persona } from '../../lib/db'
import {
  control,
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  sembrarEquipo,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { DispositivoPage } from '../dispositivos/DispositivoPage'
import { asignarEquipo } from './operaciones'

// EL RESPONSABLE SE LEE ENTERO EN EL TELÉFONO (tarea 316).
//
// El defecto: en la ficha del equipo el nombre vivía en `block truncate`,
// en la misma fila que el icono, la flecha y "Cambiar" (`shrink-0`). A
// 320 o 375 px se leía "Responsable: Daniela…" y no se sabía quién era.
// Lo mismo con "Último responsable" de un equipo de baja, y peor con una
// persona retirada, cuya pastilla también quitaba ancho al lado.
//
// La regla: el nombre es el dato principal y puede ocupar hasta dos
// líneas antes de recortarse; la fila crece en altura. happy-dom no aplica
// Tailwind ni mide, así que la prueba mira lo que decide el recorte: el
// nombre va en su propio elemento (el rótulo no le gasta líneas), con el
// tope de dos líneas y permiso para partir palabras, y nada entre él y su
// fila lo corta a una línea. La medida real a 320, 375, 390 y 1280 px se
// comprobó en el navegador (TAREAS, tarea 316).
//
// Todo lo sembrado es inventado.

const AHORA = '2026-10-09T12:00:00.000Z'

const RUTAS = [
  { ruta: '/dispositivos/:dispositivoId', elemento: <DispositivoPage /> },
  { ruta: '/personas/:personaId', elemento: <p>FICHA DE LA PERSONA</p> },
]

/** Lo que corta un texto a UNA línea: el recorte que tenía el nombre. */
const RECORTE_DE_UNA_LINEA = [/^truncate$/, /^text-ellipsis$/, /^whitespace-nowrap$/, /^text-nowrap$/, /^line-clamp-1$/]

/** Los recortes de una línea en el elemento o en lo que lo contiene, hasta su fila. */
function recortesDeUnaLinea(elemento: HTMLElement): string[] {
  const hallados: string[] = []
  let nodo: HTMLElement | null = elemento
  while (nodo && nodo.tagName !== 'SECTION' && nodo !== document.body) {
    for (const clase of Array.from(nodo.classList)) {
      if (RECORTE_DE_UNA_LINEA.some((regla) => regla.test(clase))) hallados.push(`<${nodo.tagName.toLowerCase()}> ${clase}`)
    }
    nodo = nodo.parentElement
  }
  return hallados
}

/** El nombre se lee: hasta dos líneas propias, sin nada que lo corte a una. */
function esperarHastaDosLineas(nombre: HTMLElement): void {
  expect(recortesDeUnaLinea(nombre)).toEqual([])
  expect(nombre.classList.contains('line-clamp-2')).toBe(true)
  expect(nombre.classList.contains('break-words')).toBe(true)
  // Su columna puede encogerse con la fila: sin `min-w-0` el nombre la
  // empujaría hacia fuera en vez de partir línea.
  expect(nombre.parentElement?.classList.contains('min-w-0')).toBe(true)
}

/** El bloque de "Datos para trabajar" de la ficha. */
function datos(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('section[aria-label="Datos para trabajar"]')
}

/** El elemento que dice exactamente este nombre, sin su rótulo. */
function nombreEnFila(nombre: string): HTMLElement | null {
  return Array.from(datos()?.querySelectorAll<HTMLElement>('span') ?? []).find((s) => s.textContent === nombre) ?? null
}

function persona(id: string, nombre: string, cambios: Partial<Persona> = {}): Persona {
  return {
    id,
    nombre,
    area: '',
    notas: '',
    estado: 'activa',
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

async function sembrarCategoria() {
  await db.categorias.put({
    id: 'cat-equipos',
    nombre: 'Computadores',
    icono: '',
    orden: 1,
    esRed: false,
    color: null,
    updatedAt: AHORA,
    updatedBy: null,
    eliminadoEn: null,
  })
}

/** Un equipo asignado a una persona activa por la operación de siempre (deja "Desde el"). */
async function equipoAsignadoA(nombre: string): Promise<void> {
  await sembrarCategoria()
  await db.personas.put(persona('per-1', nombre))
  await sembrarEquipo({ id: 'pc', nombre: 'PC Contabilidad de prueba', estado: 'operativo' })
  await asignarEquipo('pc', 'per-1')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('la regla de la prueba', () => {
  it('reconoce el recorte de una línea que tenía el nombre (si no, no probaría nada)', () => {
    const fila = document.createElement('section')
    fila.innerHTML = `
      <a class="flex min-h-12"><span class="min-w-0 flex-1">
        <span id="antes" class="block truncate">Daniela Andrea González Pérez</span>
        <span id="ahora" class="line-clamp-2 break-words">Daniela Andrea González Pérez</span>
      </span></a>`
    document.body.append(fila)
    expect(recortesDeUnaLinea(fila.querySelector<HTMLElement>('#antes')!)).toEqual(['<span> truncate'])
    expect(recortesDeUnaLinea(fila.querySelector<HTMLElement>('#ahora')!)).toEqual([])
    fila.remove()
  })
})

describe('el responsable en la ficha del equipo (tarea 316)', () => {
  it.each(['Daniela Gómez', 'Daniela Andrea González Pérez', 'María Fernanda Restrepo Echeverri'])(
    'el responsable actual "%s" se lee entero, con hasta dos líneas y desde cuándo lo tiene',
    async (nombre) => {
      await equipoAsignadoA(nombre)
      await montar(RUTAS, '/dispositivos/pc')
      const elemento = await esperar(() => nombreEnFila(nombre), 'el nombre del responsable')

      esperarHastaDosLineas(elemento)
      // El rótulo sigue diciendo qué es, y el texto se lee igual que antes.
      expect(textoPantalla()).toContain(`Responsable: ${nombre}`)
      expect(textoPantalla()).toMatch(/Desde el \d{1,2} \S+ \d{4}/)
      // "Cambiar" sigue en la fila, con su blanco de 44 px.
      expect(control('Cambiar')?.classList.contains('min-h-11')).toBe(true)
    },
  )

  it('una persona retirada: "Retirada" y su aviso van bajo el nombre, sin quitarle ancho', async () => {
    const nombre = 'María Fernanda Restrepo Echeverri'
    await sembrarCategoria()
    await db.personas.put(persona('per-1', nombre, { estado: 'retirada', fechaRetiro: '2026-09-30' }))
    await sembrarEquipo({ id: 'pc', nombre: 'PC Contabilidad de prueba', responsable: nombre, responsableId: 'per-1' })
    await montar(RUTAS, '/dispositivos/pc')
    const elemento = await esperar(() => nombreEnFila(nombre), 'el nombre de la persona retirada')

    esperarHastaDosLineas(elemento)
    expect(textoPantalla()).toContain('Se retiró: reasignar o liberar este equipo')
    // La pastilla vive en la columna del nombre, no a su lado en la fila.
    const pastilla = Array.from(datos()!.querySelectorAll('span')).find((s) => s.textContent === 'Retirada')
    expect(pastilla).toBeDefined()
    expect(elemento.parentElement?.contains(pastilla!)).toBe(true)
    expect(control('Cambiar')).not.toBeNull()
  })

  it('un equipo de baja dice su último responsable entero, sin "Cambiar"', async () => {
    const nombre = 'Daniela Andrea González Pérez'
    await sembrarCategoria()
    await db.personas.put(persona('per-1', nombre))
    await sembrarEquipo({ id: 'pc', nombre: 'PC de baja de prueba', estado: 'De baja', responsable: nombre, responsableId: 'per-1' })
    await montar(RUTAS, '/dispositivos/pc')
    const elemento = await esperar(() => nombreEnFila(nombre), 'el último responsable')

    esperarHastaDosLineas(elemento)
    expect(textoPantalla()).toContain(`Último responsable: ${nombre}`)
    expect(elemento.closest('a')?.getAttribute('href')).toBe('/personas/per-1')
    expect(control('Cambiar')).toBeNull()
  })

  it('un nombre anotado sigue "por validar", sin recorte de una línea y con "Asignar"', async () => {
    await sembrarCategoria()
    await sembrarEquipo({ id: 'pc', nombre: 'PC Archivo de prueba', responsable: 'Archivo de la sede de prueba' })
    await montar(RUTAS, '/dispositivos/pc')
    const anotado = await esperar(
      () =>
        Array.from(datos()?.querySelectorAll<HTMLElement>('span') ?? []).find(
          (s) => s.textContent === 'Anotado: «Archivo de la sede de prueba» · por validar',
        ),
      'el nombre anotado',
    )

    expect(recortesDeUnaLinea(anotado)).toEqual([])
    expect(textoPantalla()).not.toContain('Responsable: ')
    expect(control('Asignar')).not.toBeNull()
  })

  it('sin responsable: lo dice la línea de identidad, con "Asignar", y la fila no se dibuja', async () => {
    await sembrarCategoria()
    await sembrarEquipo({ id: 'pc', nombre: 'PC Libre de prueba', estado: 'operativo', ip: '10.9.9.40' })
    await montar(RUTAS, '/dispositivos/pc')
    await esperar(() => textoPantalla().includes('sin responsable'), 'la línea de identidad')

    expect(control('Asignar un responsable')).not.toBeNull()
    expect(textoPantalla()).not.toContain('Responsable: ')
    expect(textoPantalla()).not.toContain('Sin responsable')
  })

  it('"Cambiar" sigue abriendo qué pasa con el equipo', async () => {
    await equipoAsignadoA('Daniela Andrea González Pérez')
    await montar(RUTAS, '/dispositivos/pc')
    await tocar(await esperar(() => control('Cambiar'), '"Cambiar"'))

    await esperar(() => textoPantalla().includes('¿Qué pasa con PC Contabilidad de prueba?'), 'la hoja de cambiar')
  })

  it('el nombre sigue abriendo la ficha de la persona', async () => {
    const nombre = 'Daniela Andrea González Pérez'
    await equipoAsignadoA(nombre)
    await montar(RUTAS, '/dispositivos/pc')
    const enlace = await esperar(() => nombreEnFila(nombre)?.closest('a'), 'el enlace del responsable')

    expect(enlace.getAttribute('href')).toBe('/personas/per-1')
    await tocar(enlace)
    expect(ubicacionActual().pathname).toBe('/personas/per-1')
    await esperar(() => textoPantalla().includes('FICHA DE LA PERSONA'), 'la ficha de la persona')
  })
})
