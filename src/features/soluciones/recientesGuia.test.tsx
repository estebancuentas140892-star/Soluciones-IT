// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { obtenerRecientes, registrarVisita } from '../../lib/recientes'
import {
  campoBuscador,
  desmontarTodo,
  escribir,
  esperar,
  esperarControl,
  esperarQue,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { InicioPage } from '../inicio/InicioPage'
import { AsistentePage } from './AsistentePage'

// CUALQUIER USO REAL DE UNA GUÍA LA SUBE A RECIENTES (encargo del
// 2026-09-16, caso H de la sección 16).
//
// Antes solo lo anotaba la ficha de la guía, y el "Empezar" del buscador
// se la salta: la guía que de verdad se estaba ejecutando no aparecía en
// Inicio. Ahora la ejecución la anota también, con la misma clave, así
// que pasar por las dos pantallas no crea dos recientes.

const RUTAS = [
  { ruta: '/', elemento: <InicioPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/ejecutar', elemento: <AsistentePage /> },
]

const recientesDe = (articuloId: string) => db.recientes.where('clave').equals(`articulo:${articuloId}`).count()

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(true)
  await sembrarGuia({
    id: 'guia-impresora',
    titulo: 'Configurar la impresora de prueba',
    pasos: [pasoPrueba('imp-p1', 'Conectar la impresora de prueba', ['Conectar el cable'])],
  })
})

afterEach(async () => {
  await desmontarTodo()
})

describe('caso H: recientes de una guía que se empieza desde la búsqueda', () => {
  it('Buscar y Empezar, sin pasar por la ficha, deja la guía en Recientes', async () => {
    await montar(RUTAS, '/')
    const campo = await esperar(campoBuscador, 'el buscador de Inicio')
    await escribir(campo, 'impresora')

    await tocar(await esperarControl(/^Empezar: "Configurar la impresora de prueba"/))

    await esperar(() => ubicacionActual().pathname.endsWith('/ejecutar'), 'la ejecución se abre')
    await esperarQue(async () => (await recientesDe('guia-impresora')) === 1, 'la guía queda en recientes')
    const recientes = await obtenerRecientes()
    expect(recientes.map((reciente) => reciente.titulo)).toContain('Configurar la impresora de prueba')
  })

  it('entrar directo a la ejecución también la anota', async () => {
    await montar(RUTAS, '/soluciones/cat-pruebas/guia-impresora/ejecutar')
    await esperarQue(async () => (await recientesDe('guia-impresora')) === 1, 'la guía queda en recientes')
  })

  it('pasar por la ficha y luego por la ejecución actualiza el mismo reciente, no crea otro', async () => {
    // Lo que hace `ArticuloPage` al abrir la ficha.
    await registrarVisita('articulo', 'guia-impresora')
    const antes = (await db.recientes.get('articulo:guia-impresora'))?.visitadoEn ?? ''
    await new Promise((resolver) => setTimeout(resolver, 5))

    await montar(RUTAS, '/soluciones/cat-pruebas/guia-impresora/ejecutar')
    await esperarQue(
      async () => ((await db.recientes.get('articulo:guia-impresora'))?.visitadoEn ?? '') > antes,
      'la fecha del reciente se actualiza',
    )
    expect(await recientesDe('guia-impresora')).toBe(1)
    expect(await db.recientes.count()).toBe(1)
  })
})
