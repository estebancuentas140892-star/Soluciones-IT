// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type Articulo, type Categoria } from '../../lib/db'
import {
  control,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  pausa,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { SolucionesPage } from './SolucionesPage'

// EL CATÁLOGO DE GUÍAS EN EL TELÉFONO (tarea 358, catálogo A2 de Claude
// Design). Las pruebas corren a 375 px: la rama del teléfono. La cabecera de
// dos filas con el «+», los chips con el icono de su categoría, los grupos por
// categoría con su cuenta, la hoja que acota la búsqueda, «Para empezar»
// plegado, «Guías con preguntas» al final, la guía a medias y la palabra
// repetida atenuada. Todo lo sembrado es inventado.

const AHORA = '2026-10-26T12:00:00.000Z'

const RUTAS = [
  { ruta: '/soluciones', elemento: <SolucionesPage /> },
  { ruta: '/soluciones/:categoriaId/nuevo', elemento: <p>EL EDITOR</p> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <p>LA GUÍA</p> },
  { ruta: '/diagnostico', elemento: <p>LAS GUÍAS CON PREGUNTAS</p> },
]

function categoria(id: string, nombre: string, orden: number): Categoria {
  return { id, nombre, icono: '', orden, esRed: false, color: null, updatedAt: AHORA, updatedBy: null, eliminadoEn: null }
}

async function guia(
  id: string,
  titulo: string,
  categoriaId: string,
  extra: Partial<Articulo> = {},
  pasos = 1,
  descripcion = '',
): Promise<void> {
  await sembrarGuia({
    id,
    titulo,
    categoriaId,
    pasos: Array.from({ length: pasos }, (_, i) => pasoPrueba(`${id}-p${i + 1}`, `Paso ${i + 1}`, ['Hacer algo de prueba'])),
    procedimiento: { descripcion },
  })
  if (Object.keys(extra).length > 0) await db.articulos.update(id, extra)
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await guia('g-inst', 'Instalar impresora por IP', 'cat-imp', { tipo: 'instalacion', aplicaA: { marca: 'Zebra', modelo: 'ZT411' } }, 1, 'Usa esta guía cuando la impresora es nueva')
  await guia('g-conf', 'Configurar impresora de red', 'cat-imp', { tipo: 'configuracion' }, 2)
  await guia('g-atasco', 'Atasco en las impresoras', 'cat-imp', { tipo: 'problema_frecuente', sintomas: ['Sale la hoja arrugada'] })
  await guia('g-manual', 'Manual del tóner', 'cat-imp', { tipo: 'manual' }, 0)
  await guia('g-caja', 'Configurar la caja', 'cat-pos', { tipo: 'configuracion', esRutaInicio: true })
  // `sembrarGuia` nombra «Pruebas» a toda categoría: los nombres reales, después.
  await db.categorias.bulkPut([categoria('cat-imp', 'Impresoras', 1), categoria('cat-pos', 'POS', 2)])
  // Configurar impresora de red, a medias en este teléfono: paso 1 de 2 hecho.
  await db.progresoPasos.put({
    articuloId: 'g-conf',
    pasosHechos: ['g-conf-p1'],
    instruccionesHechas: [],
    verificacionHecha: [],
    actualizadoEn: AHORA,
  })
})

afterEach(async () => {
  await desmontarTodo()
})

const tarjetas = () => Array.from(document.body.querySelectorAll<HTMLAnchorElement>('main a[data-tarjeta-guia]'))
const grupo = (id: string) => document.body.querySelector<HTMLElement>(`section[data-grupo-categoria="${id}"]`)
const chipCategoria = () => document.body.querySelector<HTMLButtonElement>('[data-chip-categoria]')
const campo = () => document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar en Guías"]')

describe('la cabecera del teléfono (D7)', () => {
  it('el campo y una fila de chips sin número; «+» en la barra; «guías», no «artículos»', async () => {
    await montar(RUTAS, '/soluciones')
    await esperar(() => tarjetas().length === 5, 'las cinco guías')
    expect(campo()).not.toBeNull()
    expect(chipCategoria()?.textContent).toBe('Categorías')
    // El nombre accesible contiene el texto visible (WCAG 2.5.3).
    expect(chipCategoria()?.getAttribute('aria-label')).toBe('Elegir categorías')
    expect(document.body.querySelector('[data-chip-tipo]')?.textContent).toBe('Tipo')
    for (const chip of [chipCategoria(), document.body.querySelector('[data-chip-tipo]')]) {
      expect(chip?.className).toContain('toque-amplio')
      expect(chip?.textContent).not.toMatch(/\d/)
    }
    const texto = textoPantalla()
    expect(texto).not.toMatch(/artículo/i)
    // Sin pastilla de frescura: al día no se dibuja nada.
    expect(texto).not.toContain('al día')
    expect(document.body.querySelector('[data-cambios-sin-subir]')).toBeNull()

    // Sin categoría, el «+» pregunta en cuál nace la guía.
    await tocar(await esperar(() => control('Crear guía'), 'el «+»'))
    await esperar(() => textoPantalla().includes('¿En qué categoría?'), 'la hoja de crear')
    await tocar(await esperar(() => control(/^POS/), 'la opción POS'))
    expect(ubicacionActual().pathname).toBe('/soluciones/cat-pos/nuevo')
  })

  it('con una categoría, el chip activo lleva su icono y el «+» va directo a su editor', async () => {
    await montar(RUTAS, '/soluciones?categoria=cat-imp')
    const chip = await esperar(() => (chipCategoria()?.getAttribute('aria-label') === 'Categoría: Impresoras' ? chipCategoria() : null), 'el chip activo')
    expect(chip.className).toContain('bg-noct-text')
    expect(chip.querySelector('[data-icono-categoria]')?.getAttribute('data-icono-categoria')).toBe('impresora')
    expect(chip.textContent).toBe('Impresoras')
    expect(control('Crear guía')?.getAttribute('href')).toBe('/soluciones/cat-imp/nuevo')
  })
})

describe('los grupos por categoría (D3, D4, D5, D9)', () => {
  it('cada categoría con su icono y su número; las guías por tipo y cada una con su forma', async () => {
    await montar(RUTAS, '/soluciones')
    await esperar(() => tarjetas().length === 5, 'las cinco guías')
    const impresoras = grupo('cat-imp') as HTMLElement
    expect(impresoras.querySelector('h2')?.textContent).toBe('Impresoras')
    expect(impresoras.querySelector('[data-icono-categoria]')?.getAttribute('data-icono-categoria')).toBe('impresora')
    // Las de pasos y las de leer, contadas como en Resolver.
    expect(impresoras.textContent).toContain('3 guías · 1 para leer')
    expect(grupo('cat-pos')?.textContent).toContain('1 guía')
    // El orden de los grupos es el de las categorías; dentro, por tipo.
    expect(Array.from(document.body.querySelectorAll('section[data-grupo-categoria]')).map((s) => s.getAttribute('data-grupo-categoria'))).toEqual([
      'cat-imp',
      'cat-pos',
    ])
    const tipos = Array.from(impresoras.querySelectorAll('[data-glifo-tipo]')).map((g) => g.getAttribute('data-glifo-tipo'))
    expect(tipos).toEqual(['instalacion', 'configuracion', 'problema_frecuente', 'manual'])
    // Cada guía es su propia tarjeta, a 8 px, sin contenedor ni divisores.
    expect(impresoras.className).toContain('gap-2')
    for (const tarjeta of tarjetas()) expect(tarjeta.className).toContain('border-[1.5px]')
    // En el catálogo la categoría no se repite en la tarjeta: ya es el grupo.
    const instalar = tarjetas()[0]
    expect(instalar.querySelector('[data-medida] [data-icono-categoria]')).toBeNull()
    expect(instalar.querySelector('[data-medida]')?.textContent).toBe('Zebra ZT411 · Instalación · 1 paso · ~10 min')
    expect(instalar.querySelector('[data-situacion]')?.textContent).toBe('La impresora es nueva')
  })

  it('una guía a medias dice «Vas en el paso N de M» con «Continuar»', async () => {
    await montar(RUTAS, '/soluciones?categoria=cat-imp')
    const aMedias = await esperar(
      () => tarjetas().find((t) => t.getAttribute('aria-label')?.startsWith('Continuar "Configurar impresora de red"')),
      'la guía a medias',
    )
    expect(aMedias.getAttribute('aria-label')).toBe('Continuar "Configurar impresora de red": vas en el paso 2 de 2')
    expect(aMedias.textContent).toContain('Vas en el paso 2 de 2')
    expect(aMedias.textContent).toContain('Continuar')
    expect(aMedias.querySelector('[data-medida]')).toBeNull()
  })
})

describe('la búsqueda en el catálogo (D8, D12)', () => {
  it('la hoja de categorías acota la búsqueda con texto escrito, y se vuelve a todas', async () => {
    await montar(RUTAS, '/soluciones')
    await escribir(await esperar(campo, 'el campo'), 'configurar')
    await esperar(() => grupo('cat-imp') && grupo('cat-pos'), 'los dos grupos')
    expect(textoPantalla()).toContain('2 coinciden')

    await tocar(chipCategoria() as HTMLElement)
    const opcion = await esperar(
      () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('[aria-pressed]')).find((b) => b.textContent?.startsWith('Impresoras')),
      'Impresoras en la hoja',
    )
    // Con su icono y su número dicho como en el grupo.
    expect(opcion.querySelector('[data-icono-categoria]')).not.toBeNull()
    expect(opcion.textContent).toContain('1 guía')
    await tocar(opcion)

    await esperar(() => grupo('cat-pos') === null, 'solo Impresoras')
    const alcance = document.body.querySelector('[data-alcance-busqueda]') as HTMLElement
    expect(alcance.textContent).toContain('Solo en Impresoras')
    await tocar(await esperar(() => control('Buscar en todas'), 'buscar en todas'))
    await esperar(() => grupo('cat-pos'), 'de nuevo en todas')
    expect(alcance.textContent).toContain('En todas las categorías')
  })

  it('buscando «impresora» con 3 o más guías, la palabra va atenuada y nada se resalta en acento', async () => {
    await montar(RUTAS, '/soluciones')
    await escribir(await esperar(campo, 'el campo'), 'impresora')
    const atenuados = await esperar(() => {
      const hallados = Array.from(document.body.querySelectorAll<HTMLElement>('[data-tramo="atenuado"]'))
      return hallados.length >= 3 ? hallados : null
    }, 'las palabras atenuadas')
    expect(atenuados.map((tramo) => tramo.textContent?.toLowerCase())).toEqual(['impresora', 'impresora', 'impresoras'])
    expect(document.body.querySelector('[data-tramo="resaltado"]')).toBeNull()
    // El título accesible sigue entero.
    expect(tarjetas().some((t) => t.getAttribute('aria-label') === 'Abrir la guía "Atasco en las impresoras"')).toBe(true)
  })

  it('la guía abierta vuelve a la misma categoría y búsqueda', async () => {
    await montar(RUTAS, '/soluciones?categoria=cat-imp')
    await escribir(await esperar(campo, 'el campo'), 'atasco')
    await esperar(() => ubicacionActual().search.includes('q=atasco'), 'el término en la dirección')
    await pausa(50)
    const atasco = await esperar(() => tarjetas().find((t) => t.textContent?.includes('Atasco')), 'la guía')
    await tocar(atasco)
    expect(ubicacionActual().pathname).toBe('/soluciones/cat-imp/g-atasco')
    expect(ubicacionActual().state).toEqual({ origen: { to: '/soluciones?categoria=cat-imp&q=atasco', etiqueta: 'Guías' } })
  })
})

describe('«Para empezar» y «Guías con preguntas» (D6)', () => {
  it('«Para empezar» va plegado y solo en «Todas» sin filtros', async () => {
    await montar(RUTAS, '/soluciones')
    const boton = await esperar(() => document.body.querySelector<HTMLButtonElement>('[data-para-empezar] button'), 'Para empezar')
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(boton.textContent).toContain('Ruta del equipo · 1 guía')
    expect(document.body.querySelector('[data-para-empezar] ol')).toBeNull()
    await tocar(boton)
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.querySelector('[data-para-empezar] ol')?.textContent).toContain('Configurar la caja')
  })

  it('con una categoría elegida no se interpone', async () => {
    await montar(RUTAS, '/soluciones?categoria=cat-imp')
    await esperar(() => tarjetas().length === 4, 'las guías de Impresoras')
    expect(document.body.querySelector('[data-para-empezar]')).toBeNull()
  })

  it('«Guías con preguntas» va al final, después de la última guía', async () => {
    await montar(RUTAS, '/soluciones?categoria=cat-imp')
    await esperar(() => tarjetas().length === 4, 'las guías de Impresoras')
    const puerta = document.body.querySelector('a[data-puerta-guias-con-preguntas]') as HTMLElement
    const ultima = tarjetas()[tarjetas().length - 1]
    expect(ultima.compareDocumentPosition(puerta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(puerta.getAttribute('href')).toBe('/diagnostico?categoria=cat-imp')
  })
})
