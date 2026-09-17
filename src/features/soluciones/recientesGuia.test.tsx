// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { obtenerRecientes, registrarVisita } from '../../lib/recientes'
import {
  campoBuscador,
  control,
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
  textoPantalla,
  tocar,
  ubicacionActual,
} from '../../pruebas/montaje'
import { InicioPage } from '../inicio/InicioPage'
import { AsistentePage } from './AsistentePage'
import { GuiaPage } from './GuiaPage'

// CUALQUIER USO REAL DE UNA GUÍA LA SUBE A RECIENTES (encargo del
// 2026-09-16, caso H de la sección 16).
//
// Antes solo lo anotaba la ficha de la guía, y el "Empezar" del buscador
// se la saltaba: la guía que de verdad se estaba ejecutando no aparecía en
// Inicio. Ahora la ejecución la anota también, con la misma clave, así
// que pasar por las dos pantallas no crea dos recientes. Desde el
// 2026-09-17 abrir la guía desde el resultado ES ejecutarla.

const RUTAS = [
  { ruta: '/', elemento: <InicioPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
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
  it('Buscar y abrir la guía la lleva a su paso 1 y la deja en Recientes', async () => {
    await montar(RUTAS, '/')
    const campo = await esperar(campoBuscador, 'el buscador de Inicio')
    await escribir(campo, 'impresora')

    // La fila del resultado es la única puerta: ya no hay botón "Empezar".
    expect(control(/^Empezar/)).toBeNull()
    await tocar(await esperarControl(/^Configurar la impresora de prueba/))

    await esperar(
      () => ubicacionActual().pathname === '/soluciones/cat-pruebas/guia-impresora',
      'la guía se abre en su propia dirección',
    )
    await esperar(() => textoPantalla().includes('Conectar el cable'), 'la guía abre directo en su paso 1')
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
