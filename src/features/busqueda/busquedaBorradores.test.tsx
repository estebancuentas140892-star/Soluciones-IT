// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import {
  campoBuscador,
  control,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  sembrarReferencia,
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { InicioPage } from '../inicio/InicioPage'
import { GuiaPage } from '../soluciones/GuiaPage'

// BUSCAR "DIAN" EN INICIO (encargo del 2026-09-20, tareas 1 y 3).
//
// El caso real: la guía "Actualizar la resolución DIAN para facturación
// electrónica en un POS" está en `borrador`, y el índice solo lleva lo
// publicado. Como "DIAN" SÍ encuentra la ficha de HKA Factura, había
// resultados, el aviso del borrador (que solo existía dentro de "Sin
// coincidencias") no se dibujaba nunca y la guía parecía no existir.
//
// Aquí se monta Inicio de verdad, con la ficha y la guía sembradas, para
// probar lo que ninguna función pura ve: que el bloque sale CON
// resultados oficiales delante, que el borrador no se confunde con una
// guía publicada, y que publicarla lo cambia todo sin tocar más nada.
//
// Todo lo que se siembra es INVENTADO: no hay ningún dato real de la
// resolución, de FrontRest ni de HKA.

const ID_DIAN = 'a1ac8d0a-72e7-4dd1-a377-afd2a2ca1cc0'
const TITULO_DIAN = 'Actualizar la resolución DIAN para facturación electrónica en un POS'

const RUTAS = [
  { ruta: '/', elemento: <InicioPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
]

async function sembrarGuiaDian(estado: 'borrador' | 'publicado' | 'obsoleto'): Promise<void> {
  await sembrarGuia({
    id: ID_DIAN,
    titulo: TITULO_DIAN,
    categoriaId: 'cat-pos',
    pasos: [
      pasoPrueba('dian-p1', 'Abrir la configuración de resoluciones', ['Entrar al módulo de ejemplo']),
      pasoPrueba('dian-p2', 'Registrar la resolución nueva', ['Escribir los datos de ejemplo']),
    ],
  })
  await db.categorias.update('cat-pos', { nombre: 'POS' })
  if (estado !== 'publicado') await db.articulos.update(ID_DIAN, { estado })
}

/** La ficha del Centro de consulta que hace que "DIAN" nunca quede sin resultados. */
async function sembrarFichaHka(): Promise<void> {
  await sembrarReferencia({
    id: 'hka',
    tipo: 'herramienta',
    titulo: 'HKA Factura',
    alias: ['HKA'],
    categoria: 'Facturación electrónica',
    definicion: 'Plataforma de ejemplo para facturación electrónica y secuenciales.',
    etiquetas: ['facturación electrónica', 'dian'],
  })
}

/** Escribe en el buscador de Inicio y espera a que la pantalla reaccione. */
async function buscarEnInicio(texto: string): Promise<void> {
  const campo = await esperar(campoBuscador, 'el buscador de Inicio')
  await escribir(campo, texto)
  await esperar(() => !textoPantalla().includes('Todo al día por hoy'), 'la pantalla pasa a resultados')
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('buscar "DIAN" con la guía en borrador', () => {
  it('pone la guía en borrador ANTES que la ficha de HKA Factura', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const texto = await esperar(
      () => (textoPantalla().includes(TITULO_DIAN) ? textoPantalla() : null),
      'la guía en borrador',
    )
    // Coincide en el TÍTULO, así que sube: es lo que se vino a hacer.
    expect(texto.indexOf(TITULO_DIAN)).toBeLessThan(texto.indexOf('HKA Factura'))
    // Y se sigue diciendo lo que es, sin presentarla como oficial.
    expect(texto).toContain('Borrador · contenido por confirmar')
    expect(texto).toContain('POS')
    // Promovida arriba, no se repite en el bloque de abajo.
    expect(texto).not.toContain('Borradores coincidentes')
  })

  it('la fila entera abre la GUÍA, no el editor', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const fila = await esperar(() => control(/^Abrir borrador/), 'la fila del borrador')
    expect(fila.getAttribute('href')).toBe(`/soluciones/cat-pos/${ID_DIAN}`)
    expect(fila.getAttribute('href')).not.toContain('/editar')
  })

  it('da igual la caja y las tildes', async () => {
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    for (const consulta of ['dian', 'RESOLUCIÓN DIAN', 'facturacion electronica']) {
      await buscarEnInicio(consulta)
      await esperar(
        () => textoPantalla().includes(TITULO_DIAN),
        `el borrador aparece buscando "${consulta}"`,
      )
    }
  })

  it('sin resultados oficiales no dice "Sin coincidencias" sino que no hay guía publicada', async () => {
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('resolución')

    const texto = await esperar(
      () => (textoPantalla().includes('No hay una guía publicada') ? textoPantalla() : null),
      'el aviso de que no hay guía publicada',
    )
    expect(texto).not.toContain('Sin coincidencias')
    expect(texto).toContain(TITULO_DIAN)
    expect(texto).toContain('Borrador · contenido por confirmar')
  })
})

describe('qué NO entra en "Borradores coincidentes"', () => {
  it('un artículo obsoleto no cuenta como borrador', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('obsoleto')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    await esperar(() => textoPantalla().includes('HKA Factura'), 'el resultado oficial')
    expect(textoPantalla()).not.toContain('Borradores coincidentes')
    expect(textoPantalla()).not.toContain(TITULO_DIAN)
  })

  it('un artículo eliminado no aparece en ningún sitio', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await db.articulos.update(ID_DIAN, { eliminadoEn: '2026-09-19T00:00:00.000Z' })
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    await esperar(() => textoPantalla().includes('HKA Factura'), 'el resultado oficial')
    expect(textoPantalla()).not.toContain(TITULO_DIAN)
    expect(textoPantalla()).not.toContain('Borradores coincidentes')
  })
})

describe('publicar la guía la pasa a los resultados oficiales', () => {
  it('el índice reactivo la recoge y deja de estar en el bloque de borradores', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')
    await esperar(
      () => textoPantalla().includes('Borrador · contenido por confirmar'),
      'la guía en borrador, arriba',
    )

    // Publicar es lo que hace el editor de la app: cambiar el estado.
    await db.articulos.update(ID_DIAN, { estado: 'publicado' })

    await esperar(
      () => !textoPantalla().includes('Borrador · contenido por confirmar'),
      'el aviso de borrador desaparece',
    )
    const texto = textoPantalla()
    expect(texto).toContain(TITULO_DIAN)
    expect(texto).not.toContain('Revisar borrador')
    expect(texto).not.toContain('Borradores coincidentes')
    // Sin duplicar: el título sale una sola vez.
    expect(texto.split(TITULO_DIAN)).toHaveLength(2)
    // Sigue conviviendo con la ficha de HKA Factura.
    expect(texto).toContain('HKA Factura')
  })

  it('el resultado oficial abre la guía', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('publicado')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const resultado = await esperar(
      () => control(new RegExp(TITULO_DIAN.slice(0, 25))),
      'el resultado oficial de la guía',
    )
    await tocar(resultado)
    expect(ubicacionActual().pathname).toContain(ID_DIAN)
  })
})

describe('el bloque secundario es solo para las coincidencias débiles', () => {
  /** Un borrador que NO nombra la consulta en el título: coincide por etiqueta. */
  async function sembrarBorradorPorEtiqueta(id: string, titulo: string): Promise<void> {
    await sembrarGuia({
      id,
      titulo,
      categoriaId: 'cat-pos',
      pasos: [pasoPrueba(`${id}-p1`, 'Un paso', ['Hacer algo'])],
    })
    await db.articulos.update(id, { estado: 'borrador', etiquetas: ['dian'] })
  }

  it('el promovido no se repite abajo y el débil se queda en el bloque', async () => {
    await sembrarGuiaDian('borrador')
    await sembrarBorradorPorEtiqueta('b-debil', 'Alta de un usuario en el POS')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const texto = await esperar(
      () => (textoPantalla().includes('Borradores coincidentes') ? textoPantalla() : null),
      'el bloque de borradores',
    )
    // El fuerte, arriba y una sola vez.
    expect(texto.split(TITULO_DIAN)).toHaveLength(2)
    expect(texto.indexOf(TITULO_DIAN)).toBeLessThan(texto.indexOf('Borradores coincidentes'))
    // El débil, abajo.
    expect(texto.indexOf('Alta de un usuario en el POS')).toBeGreaterThan(
      texto.indexOf('Borradores coincidentes'),
    )
    expect(texto).toContain('1 borrador coincide')
  })

  it('sin coincidencias débiles no queda un bloque vacío', async () => {
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    await esperar(() => textoPantalla().includes(TITULO_DIAN), 'la guía en borrador')
    expect(textoPantalla()).not.toContain('Borradores coincidentes')
  })

  it('"Ver el otro" concuerda en singular y se repliega al cambiar la búsqueda', async () => {
    for (const n of [1, 2, 3, 4]) await sembrarBorradorPorEtiqueta(`b${n}`, `Borrador de ejemplo ${n}`)
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    await esperar(() => textoPantalla().includes('Borradores coincidentes'), 'el bloque de borradores')
    expect(textoPantalla()).toContain('4 borradores coinciden')
    expect(textoPantalla()).not.toContain('Borrador de ejemplo 4')

    const verOtro = await esperar(() => control(/^Ver el otro/), 'el desplegable en singular')
    await tocar(verOtro)
    expect(textoPantalla()).toContain('Borrador de ejemplo 4')

    // Cambiar lo escrito repliega el bloque: la lista ya es otra.
    await buscarEnInicio('dia')
    await esperar(() => !textoPantalla().includes('Borrador de ejemplo 4'), 'el bloque vuelve a plegarse')
    expect(control(/^Ver el otro/)).not.toBeNull()
  })
})

describe('abrir el borrador desde Inicio es hacerlo', () => {
  it('un toque lleva a la ejecución, en el primer paso pendiente', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    // Avance guardado: el paso 1 ya está hecho.
    await db.progresoPasos.put({
      articuloId: ID_DIAN,
      pasosHechos: ['dian-p1'],
      instruccionesHechas: ['dian-p1-t1'],
      verificacionHecha: [],
      actualizadoEn: '2026-09-20T12:00:00.000Z',
    })
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const fila = await esperar(() => control(/^Abrir borrador/), 'la fila del borrador')
    await tocar(fila)

    expect(ubicacionActual().pathname).toBe(`/soluciones/cat-pos/${ID_DIAN}`)
    // Está EJECUTÁNDOSE (no en la ficha ni en el editor) y en el paso pendiente.
    const texto = await esperar(
      () => (textoPantalla().includes('Registrar la resolución nueva') ? textoPantalla() : null),
      'el paso 2, que es el pendiente',
    )
    expect(texto).toContain('Paso 2 de 2')
    expect(texto).toContain('Retomas en el paso 2')
    expect(ubicacionActual().pathname).not.toContain('/editar')
    expect(ubicacionActual().pathname).not.toContain('/detalles')
  })

  it('la ejecución de un borrador avisa sin bloquear, y la de una publicada no', async () => {
    await sembrarGuiaDian('borrador')
    const montaje = await montar(RUTAS, `/soluciones/cat-pos/${ID_DIAN}`)
    const texto = await esperar(
      () => (textoPantalla().includes('Borrador · algunos datos') ? textoPantalla() : null),
      'el aviso de borrador en la ejecución',
    )
    expect(texto).toContain('Borrador · algunos datos todavía están por confirmar.')
    // No es un paso ni una confirmación: el trabajo del paso 1 está a la vista.
    expect(texto).toContain('Abrir la configuración de resoluciones')
    await montaje.desmontar()

    await db.articulos.update(ID_DIAN, { estado: 'publicado' })
    await montar(RUTAS, `/soluciones/cat-pos/${ID_DIAN}`)
    await esperar(
      () => textoPantalla().includes('Abrir la configuración de resoluciones'),
      'la guía publicada en ejecución',
    )
    expect(textoPantalla()).not.toContain('Borrador · algunos datos')
  })

  it('salir de la guía vuelve a Inicio con la búsqueda escrita', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')
    await tocar(await esperar(() => control(/^Abrir borrador/), 'la fila del borrador'))
    await esperar(() => textoPantalla().includes('Abrir la configuración de resoluciones'), 'la ejecución')

    await tocar(await esperar(() => control('Salir de la guía'), 'la salida de la guía'))
    expect(ubicacionActual().pathname).toBe('/')
    const campo = await esperar(campoBuscador, 'el buscador de Inicio')
    expect(campo.value).toBe('DIAN')
  })

  it('una guía publicada que coincide en el título manda sobre el borrador', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await sembrarGuia({
      id: 'guia-oficial',
      titulo: 'Resolución DIAN: revisión mensual publicada',
      categoriaId: 'cat-pos',
      pasos: [pasoPrueba('of-p1', 'Un paso', ['Hacer algo'])],
    })
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const texto = await esperar(
      () => (textoPantalla().includes('Resolución DIAN: revisión mensual') ? textoPantalla() : null),
      'la guía publicada',
    )
    expect(texto.indexOf('Resolución DIAN: revisión mensual')).toBeLessThan(texto.indexOf(TITULO_DIAN))
    // El borrador sigue visible, detrás y marcado.
    expect(texto).toContain('Borrador · contenido por confirmar')
  })
})
