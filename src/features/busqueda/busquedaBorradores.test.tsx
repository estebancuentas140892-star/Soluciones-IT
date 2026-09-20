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
  it('muestra la ficha de HKA Factura Y el borrador en su propio bloque', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const texto = await esperar(
      () => (textoPantalla().includes('Borradores coincidentes') ? textoPantalla() : null),
      'el bloque de borradores coincidentes',
    )
    // El resultado oficial sigue ahí: el bloque no lo sustituye.
    expect(texto).toContain('HKA Factura')
    // Y el borrador, con su título, su pastilla y su acción.
    expect(texto).toContain(TITULO_DIAN)
    expect(texto).toContain('Borrador')
    expect(texto).toContain('Revisar borrador')
    expect(texto).toContain('POS')
    // No se presenta como guía oficial.
    expect(control(new RegExp(`^Revisar borrador ${TITULO_DIAN.slice(0, 20)}`))).not.toBeNull()
  })

  it('"Revisar borrador" abre el editor del artículo, no su ejecución', async () => {
    await sembrarFichaHka()
    await sembrarGuiaDian('borrador')
    await montar(RUTAS, '/')
    await buscarEnInicio('DIAN')

    const fila = await esperar(() => control(/^Revisar borrador/), 'la fila del borrador')
    expect(fila.getAttribute('href')).toBe(`/soluciones/cat-pos/${ID_DIAN}/editar`)
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
      () => (textoPantalla().includes('Borradores coincidentes') ? textoPantalla() : null),
      'el bloque de borradores',
    )
    expect(texto).toContain('No hay una guía publicada con esta búsqueda.')
    expect(texto).not.toContain('Sin coincidencias')
    expect(texto).toContain(TITULO_DIAN)
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
    await esperar(() => textoPantalla().includes('Borradores coincidentes'), 'el bloque de borradores')

    // Publicar es lo que hace el editor de la app: cambiar el estado.
    await db.articulos.update(ID_DIAN, { estado: 'publicado' })

    await esperar(
      () => !textoPantalla().includes('Borradores coincidentes'),
      'el bloque de borradores desaparece',
    )
    const texto = textoPantalla()
    expect(texto).toContain(TITULO_DIAN)
    expect(texto).not.toContain('Revisar borrador')
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
