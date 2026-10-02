// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { registrarVisita } from '../../lib/recientes'
import {
  campoBuscador,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  PERFIL_PRUEBA,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
} from '../../pruebas/montaje'
import { bloquear } from '../boveda/sesionBoveda'
import { ResolverPage } from '../inicio/ResolverPage'
import { BuscadorGlobal } from './BuscadorGlobal'

// EL NOMBRE PRINCIPAL DE UN RESULTADO NO SE RECORTA (regla 23, tarea 288).
//
// El defecto: el título de las filas de Resolver tenía un tope de dos
// líneas (`line-clamp-2`), y a 390 px "Agregar una impresora al computador
// mediante su dirección IP" se leía "Agregar una impresora al computador
// mediante su…": justo sin la parte que dice de qué guía se trata. Desde
// entonces el nombre ocupa las líneas que necesite y la fila crece; el
// tipo, la categoría y el subtítulo sí pueden recortarse.
//
// happy-dom no aplica Tailwind, así que la prueba mira las CLASES: ni el
// título ni nada entre él y su sección puede llevar una regla que corte
// texto (`line-clamp-*`, `truncate`, `text-ellipsis`, `whitespace-nowrap`,
// `overflow-hidden`, una altura fija...), y el título lleva lo que le deja
// partir línea dentro de su columna (`min-w-0` y `overflow-wrap:anywhere`,
// como `FilaArticulo`). Se recorre cada forma en que Resolver pinta un
// nombre: lista mixta, lista homogénea, "Mejor coincidencia" y "Otras
// coincidencias", modo consulta, borradores, recientes y Atención.
//
// Todo lo sembrado es inventado.

const LARGO = 'Agregar una impresora al computador mediante su dirección IP'

const RUTAS = [{ ruta: '/', elemento: <ResolverPage /> }]

/** Clases de Tailwind que cortan o esconden el final de un texto. */
const CLASES_QUE_RECORTAN = [
  /^line-clamp-/,
  /^truncate$/,
  /^text-ellipsis$/,
  /^text-clip$/,
  /^whitespace-nowrap$/,
  /^text-nowrap$/,
  /^overflow-hidden$/,
  /^overflow-clip$/,
  /^max-h-/,
  /^h-(?!auto$|full$|fit$)/,
]
const ESTILO_QUE_RECORTA = /line-clamp|text-overflow|white-space:\s*nowrap|max-height|overflow:\s*(hidden|clip)/i

/**
 * Las reglas que cortarían este título, en él o en lo que lo contiene
 * hasta su sección (la columna y la fila tampoco pueden cortarlo).
 */
function reglasQueRecortan(titulo: HTMLElement): string[] {
  const halladas: string[] = []
  let nodo: HTMLElement | null = titulo
  for (let nivel = 0; nodo && nodo.tagName !== 'SECTION' && nodo !== document.body && nivel < 6; nivel++) {
    for (const clase of Array.from(nodo.classList)) {
      if (CLASES_QUE_RECORTAN.some((regla) => regla.test(clase))) halladas.push(`<${nodo.tagName.toLowerCase()}> ${clase}`)
    }
    const estilo = nodo.getAttribute('style') ?? ''
    if (ESTILO_QUE_RECORTA.test(estilo)) halladas.push(`<${nodo.tagName.toLowerCase()}> style="${estilo}"`)
    nodo = nodo.parentElement
  }
  return halladas
}

/** Todos los nombres principales que hay en pantalla. */
function nombres(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-nombre-principal]'))
}

/** El nombre principal cuyo texto completo es éste. */
function nombre(texto: string): HTMLElement | null {
  return nombres().find((elemento) => elemento.textContent === texto) ?? null
}

/** El rótulo de la sección que contiene a un elemento. */
function seccionDe(elemento: HTMLElement): string | null {
  return elemento.closest('section')?.querySelector('h2')?.textContent ?? null
}

/** El nombre se lee entero: sin regla que lo corte y con permiso para partir línea. */
function esperarEntero(titulo: HTMLElement): void {
  expect(reglasQueRecortan(titulo)).toEqual([])
  expect(titulo.classList.contains('min-w-0')).toBe(true)
  expect(titulo.classList.contains('[overflow-wrap:anywhere]')).toBe(true)
}

async function buscar(texto: string): Promise<void> {
  await escribir(await esperar(campoBuscador, 'el buscador'), texto)
}

async function sembrarGuiaLarga(id = 'guia-ip', titulo = LARGO): Promise<void> {
  await sembrarGuia({
    id,
    titulo,
    pasos: [pasoPrueba(`${id}-p1`, 'Agregar la impresora', ['Escribir la dirección IP de ejemplo'])],
  })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

describe('la regla de la prueba', () => {
  it('reconoce el tope de dos líneas y el recorte de una línea (si no, no probaría nada)', () => {
    const fila = document.createElement('section')
    fila.innerHTML = `
      <a class="flex min-h-14"><span class="flex min-w-0 flex-col">
        <span id="dos" class="line-clamp-2 text-[15px]">${LARGO}</span>
        <span id="una" class="block truncate">${LARGO}</span>
        <span id="estilo" style="-webkit-line-clamp: 2">${LARGO}</span>
        <span id="entero" class="min-w-0 [overflow-wrap:anywhere]">${LARGO}</span>
      </span></a>`
    document.body.append(fila)
    expect(reglasQueRecortan(fila.querySelector<HTMLElement>('#dos')!)).toEqual(['<span> line-clamp-2'])
    expect(reglasQueRecortan(fila.querySelector<HTMLElement>('#una')!)).toEqual(['<span> truncate'])
    expect(reglasQueRecortan(fila.querySelector<HTMLElement>('#estilo')!)).toHaveLength(1)
    expect(reglasQueRecortan(fila.querySelector<HTMLElement>('#entero')!)).toEqual([])
    fila.remove()
  })
})

describe('Resolver: el nombre principal de un resultado se lee entero', () => {
  it('lista mixta, en "Mejores resultados": la guía larga no lleva tope de líneas', async () => {
    await sembrarGuiaLarga()
    await sembrarEquipo({ id: 'imp-mercadeo', nombre: 'Impresora Mercadeo', marca: 'Ricoh', ubicacion: 'Mercadeo' })
    await sembrarEquipo({ id: 'imp-conta', nombre: 'Impresora Contabilidad', marca: 'HP', ubicacion: 'Contabilidad' })
    await montar(RUTAS, '/')
    await buscar('impresora')

    const guia = await esperar(() => nombre(LARGO), 'la guía con su título completo')
    expect(seccionDe(guia)).toBe('Mejores resultados')
    esperarEntero(guia)
    // Los equipos de la misma lista, también; el tipo de cada fila sigue
    // en su línea de contexto, que sí puede recortarse.
    for (const titulo of nombres()) esperarEntero(titulo)
    expect(guia.nextElementSibling?.classList.contains('truncate')).toBe(true)
  })

  it('"Mejor coincidencia" y "Otras coincidencias": la fila destacada tampoco corta el nombre', async () => {
    await sembrarGuiaLarga()
    await sembrarGuia({
      id: 'guia-red',
      titulo: 'Conectar una impresora de red',
      pasos: [pasoPrueba('red-p1', 'Conectar', ['Conectar el cable de red'])],
    })
    await sembrarEquipo({ id: 'imp-mercadeo', nombre: 'Impresora Mercadeo', marca: 'Ricoh', ubicacion: 'Mercadeo' })
    await montar(RUTAS, '/')
    await buscar('agregar una impresora al computador mediante su direccion ip')

    const guia = await esperar(() => nombre(LARGO), 'la guía con su título completo')
    expect(seccionDe(guia)).toBe('Mejor coincidencia')
    esperarEntero(guia)
    const otras = nombres().filter((titulo) => seccionDe(titulo) === 'Otras coincidencias')
    expect(otras.length).toBeGreaterThan(0)
    for (const titulo of otras) esperarEntero(titulo)
  })

  it('lista homogénea: el comienzo atenuado y lo que distingue, sin recorte', async () => {
    await sembrarGuiaLarga()
    await sembrarGuiaLarga('guia-compartida', 'Agregar una impresora compartida desde el servidor de impresión de la sede')
    await sembrarGuiaLarga('guia-usb', 'Agregar una impresora USB cuando Windows no encuentra el controlador')
    await montar(RUTAS, '/')
    await buscar('Agregar una impresora')

    const guia = await esperar(() => nombre(LARGO), 'la guía con su título completo')
    // Es la forma homogénea: el comienzo buscado va atenuado...
    expect(guia.querySelector('.decoration-dotted')?.textContent).toBe('Agregar una impresora')
    // ...y el título se lee entero, igual que sus vecinas.
    for (const titulo of nombres()) esperarEntero(titulo)
    expect(nombre('Agregar una impresora USB cuando Windows no encuentra el controlador')).not.toBeNull()
  })

  it('un nombre excepcionalmente largo, con una ruta sin espacios, parte línea en vez de salirse', async () => {
    const excepcional =
      'Agregar una impresora al computador mediante su dirección IP cuando el controlador del fabricante no aparece en la lista de Windows y hay que instalarlo desde \\\\servidor-impresion-sede-principal\\controladores-impresoras-segundo-piso'
    await sembrarGuiaLarga('guia-excepcional', excepcional)
    await montar(RUTAS, '/')
    await buscar('controlador del fabricante')

    const guia = await esperar(() => nombre(excepcional), 'el nombre excepcional completo')
    esperarEntero(guia)
  })

  it('modo consulta dentro de una guía: la referencia y la fila que se despliega tampoco recortan', async () => {
    await sembrarGuiaLarga()
    await sembrarEquipo({
      id: 'imp-mercadeo',
      nombre: 'Impresora multifuncional del segundo piso de Mercadeo junto a la sala de juntas',
      marca: 'Ricoh',
      ubicacion: 'Mercadeo',
    })
    await montar([{ ruta: '/', elemento: <BuscadorGlobal abierto modo="consulta" onCerrar={() => undefined} /> }], '/')
    await buscar('impresora')

    const guia = await esperar(() => nombre(LARGO), 'la guía como referencia')
    // La guía se nombra sin poder tocarse; el equipo se despliega aquí.
    expect(guia.closest('a, button')).toBeNull()
    const equipo = nombre('Impresora multifuncional del segundo piso de Mercadeo junto a la sala de juntas')
    expect(equipo?.closest('button[aria-expanded]')).not.toBeNull()
    for (const titulo of nombres()) esperarEntero(titulo)
  })

  it('borradores: el que coincide en el título y el del bloque de abajo', async () => {
    await sembrarGuiaLarga('borrador-ip', LARGO)
    await db.articulos.update('borrador-ip', { estado: 'borrador', updatedBy: PERFIL_PRUEBA.id })
    const otro = 'Reinstalar el controlador de una impresora de red que se queda en cola sin imprimir'
    await sembrarGuiaLarga('borrador-cola', otro)
    await db.articulos.update('borrador-cola', {
      estado: 'borrador',
      updatedBy: PERFIL_PRUEBA.id,
      etiquetas: ['spooler'],
    })
    await montar(RUTAS, '/')

    await buscar('direccion ip')
    esperarEntero(await esperar(() => nombre(LARGO), 'el borrador destacado'))

    await buscar('spooler')
    const deAbajo = await esperar(() => nombre(otro), 'el borrador del bloque de coincidencias')
    expect(seccionDe(deAbajo)).toBe('Borradores coincidentes')
    esperarEntero(deAbajo)
  })
})

describe('Resolver sin escribir: Recientes y Atención', () => {
  it('Recientes no recorta el título de la guía', async () => {
    await sembrarGuiaLarga()
    await registrarVisita('articulo', 'guia-ip')
    await montar(RUTAS, '/')

    const guia = await esperar(() => nombre(LARGO), 'la guía reciente')
    esperarEntero(guia)
  })

  it('Atención no recorta el nombre de lo que vence', async () => {
    const acceso = 'Certificado digital del servidor de facturación electrónica de la sede principal'
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    await db.credenciales.put({
      id: 'c-certificado',
      titulo: acceso,
      categoria: 'Pruebas',
      tipo: 'cuenta',
      datosCifrados: '',
      venceEn: `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`,
      dispositivos: [],
      archivo: null,
      updatedAt: '2026-09-20T12:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })
    await montar(RUTAS, '/')

    const fila = await esperar(() => nombre(acceso), 'el acceso vencido en Atención')
    expect(seccionDe(fila)).toBe('Atención')
    esperarEntero(fila)
  })
})
