// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  campoBuscador,
  desmontarTodo,
  escribir,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarEquipo,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
} from '../../pruebas/montaje'
import { ResolverPage } from '../inicio/ResolverPage'

// RESOLVER Y SUS RESULTADOS SEGÚN LA PROPUESTA FINAL DE CLAUDE DESIGN
// (2026-10-01), con la pantalla de verdad:
//
//   - con el primer carácter la pregunta se pliega (y el lector de
//     pantalla deja de leerla); al borrar, vuelve;
//   - LISTA HOMOGÉNEA: varios equipos que empiezan por lo buscado llevan
//     ese comienzo atenuado y el tipo sube al encabezado ("· 3 equipos");
//   - LISTA MIXTA: cada fila dice su tipo;
//   - ningún título real cambia.
//
// Todo lo sembrado es inventado.

const RUTAS = [{ ruta: '/', elemento: <ResolverPage /> }]

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

async function buscar(texto: string): Promise<void> {
  const campo = await esperar(campoBuscador, 'el buscador de Resolver')
  await escribir(campo, texto)
}

/** El bloque de la pregunta (lo que se pliega). */
function pliegueDeLaPregunta(): HTMLElement | null {
  const pregunta = Array.from(document.body.querySelectorAll('p')).find(
    (p) => p.textContent === '¿Qué necesitas resolver?',
  )
  return (pregunta?.parentElement?.parentElement as HTMLElement | null) ?? null
}

describe('Resolver mientras se escribe', () => {
  it('la pregunta se pliega con el primer carácter y vuelve al borrar', async () => {
    await montar(RUTAS, '/')
    const pliegue = await esperar(pliegueDeLaPregunta, 'la pregunta')
    expect(pliegue.getAttribute('aria-hidden')).not.toBe('true')

    await buscar('i')
    expect(pliegueDeLaPregunta()?.getAttribute('aria-hidden')).toBe('true')

    await buscar('')
    expect(pliegueDeLaPregunta()?.getAttribute('aria-hidden')).not.toBe('true')
  })
})

describe('la lista de resultados', () => {
  it('homogénea: lo buscado se atenúa, lo que distingue queda en claro y el tipo sube al encabezado', async () => {
    await sembrarEquipo({ id: 'imp-1', nombre: 'Impresora Mercadeo', marca: 'KYOCERA', modelo: 'ECOSYS M3655' })
    await sembrarEquipo({ id: 'imp-2', nombre: 'Impresora Logística', marca: 'RICOH', modelo: 'MP 501' })
    await sembrarEquipo({ id: 'imp-3', nombre: 'Impresora Caja PN', marca: 'HP', modelo: 'LaserJet M527' })
    await montar(RUTAS, '/')
    await buscar('Impresora')

    await esperar(() => textoPantalla().includes('Mejores resultados'), 'los mejores resultados')
    expect(textoPantalla()).toContain('· 3 equipos')
    // El título real no cambia: se lee entero, solo pintado en dos tramos.
    for (const nombre of ['Impresora Mercadeo', 'Impresora Logística', 'Impresora Caja PN']) {
      expect(textoPantalla()).toContain(nombre)
    }
    const atenuados = Array.from(document.body.querySelectorAll('span.decoration-dotted')).map((s) => s.textContent)
    expect(atenuados).toEqual(['Impresora', 'Impresora', 'Impresora'])
    // Sin el tipo repetido en cada fila.
    expect(textoPantalla()).not.toContain('Equipo · ')
  })

  it('mixta: cada fila dice su tipo y la coincidencia se resalta, sin atenuar nada', async () => {
    await sembrarEquipo({ id: 'fac-1', nombre: 'Servidor de facturación' })
    await sembrarGuia({
      id: 'guia-fac',
      titulo: 'Reiniciar la facturación de prueba',
      pasos: [pasoPrueba('fac-p1', 'Reiniciar', ['Pulsar Reiniciar'])],
    })
    await montar(RUTAS, '/')
    await buscar('facturación')

    await esperar(() => textoPantalla().includes('Mejores resultados'), 'los mejores resultados')
    expect(textoPantalla()).toMatch(/Guía/)
    expect(textoPantalla()).toMatch(/Equipo/)
    expect(document.body.querySelectorAll('span.decoration-dotted')).toHaveLength(0)
  })
})
