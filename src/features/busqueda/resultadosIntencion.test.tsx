// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  anclarMaestra,
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
import { bloquear } from '../boveda/sesionBoveda'
import { ResolverPage } from '../inicio/ResolverPage'
import { BuscadorGlobal } from './BuscadorGlobal'

// "MEJOR COINCIDENCIA" SOLO CON UNA OPCIÓN CLARAMENTE SUPERIOR (tarea 288,
// fase 8), con la pantalla de verdad:
//
//   - una consulta que identifica una sola cosa la dice como "Mejor
//     coincidencia" y deja el resto en "Otras coincidencias";
//   - una consulta ambigua sigue en "Mejores resultados": no se finge
//     certeza;
//   - el puente a la Bóveda va detrás del bloque entero, no en medio;
//   - en modo consulta, la mejor coincidencia tampoco saca de la tarea.
//
// La regla y sus pesos se prueban en `mejores.test.ts`; aquí, lo que se ve.
// Todo lo sembrado es inventado.

const RUTAS = [
  { ruta: '/', elemento: <ResolverPage /> },
  { ruta: '/dispositivos/:dispositivoId', elemento: <p>FICHA DEL EQUIPO</p> },
]

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
  bloquear()
})

async function sembrarImpresoras(): Promise<void> {
  await sembrarEquipo({
    id: 'imp-mercadeo',
    nombre: 'Impresora Mercadeo',
    marca: 'Ricoh',
    modelo: 'MP 501',
    ubicacion: 'Mercadeo',
    ip: '10.10.6.8',
  })
  await sembrarEquipo({ id: 'imp-conta', nombre: 'Impresora Contabilidad', marca: 'HP', ubicacion: 'Contabilidad' })
  await sembrarEquipo({ id: 'sw-mercadeo', nombre: 'Switch Mercadeo', ubicacion: 'Mercadeo' })
  await sembrarGuia({
    id: 'guia-red',
    titulo: 'Conectar una impresora de red',
    pasos: [pasoPrueba('red-p1', 'Agregar la impresora', ['Agregar la impresora por su IP'])],
  })
}

async function buscar(texto: string): Promise<void> {
  await escribir(await esperar(campoBuscador, 'el buscador'), texto)
}

/** Los rótulos de las secciones de resultados, en orden. */
function secciones(): string[] {
  return Array.from(document.body.querySelectorAll('h2')).map((h) => h.textContent ?? '')
}

/** La sección cuyo rótulo es éste. */
function seccion(rotulo: string): HTMLElement | null {
  const titulo = Array.from(document.body.querySelectorAll('h2')).find((h) => h.textContent === rotulo)
  return titulo?.closest('section') ?? null
}

describe('la confianza en pantalla', () => {
  it('una opción claramente superior se dice: "Mejor coincidencia" y debajo "Otras coincidencias"', async () => {
    await sembrarImpresoras()
    await montar(RUTAS, '/')
    await buscar('impresora mercadeo')

    await esperar(() => seccion('Mejor coincidencia'), 'la mejor coincidencia')
    const rotulos = secciones()
    expect(rotulos.indexOf('Mejor coincidencia')).toBeLessThan(rotulos.indexOf('Otras coincidencias'))
    expect(rotulos).not.toContain('Mejores resultados')
    // Una sola fila, el equipo de Mercadeo, con su tipo y sin cuenta.
    const mejor = seccion('Mejor coincidencia')!
    expect(mejor.querySelectorAll('a[href^="/dispositivos/"]')).toHaveLength(1)
    expect(mejor.textContent).toContain('Impresora Mercadeo')
    expect(mejor.textContent).toContain('Equipo')
    expect(mejor.textContent).not.toContain('Impresora Contabilidad')
  })

  it('una consulta ambigua no finge certeza: sigue siendo "Mejores resultados"', async () => {
    await sembrarImpresoras()
    await montar(RUTAS, '/')
    await buscar('impresora')

    await esperar(() => seccion('Mejores resultados'), 'los mejores resultados')
    expect(secciones()).not.toContain('Mejor coincidencia')
    expect(secciones()).not.toContain('Otras coincidencias')
  })

  it('el puente a la Bóveda va detrás del bloque entero, no entre "Mejor" y "Otras"', async () => {
    await sembrarPerfil(true)
    await anclarMaestra()
    bloquear()
    await sembrarImpresoras()
    await montar(RUTAS, '/')
    await buscar('impresora mercadeo')

    await esperar(() => textoPantalla().includes('en Bóveda'), 'el puente a la Bóveda')
    const texto = textoPantalla()
    expect(texto.indexOf('Mejor coincidencia')).toBeLessThan(texto.indexOf('Otras coincidencias'))
    expect(texto.indexOf('Otras coincidencias')).toBeLessThan(texto.indexOf('Buscar "impresora mercadeo" en Bóveda'))
  })

  it('en modo consulta, la mejor coincidencia tampoco saca de la tarea', async () => {
    await sembrarImpresoras()
    await montar([{ ruta: '/', elemento: <BuscadorGlobal abierto modo="consulta" onCerrar={() => undefined} /> }], '/')
    await buscar('impresora mercadeo')

    await esperar(() => seccion('Mejor coincidencia'), 'la mejor coincidencia en modo consulta')
    // Ninguna fila es un enlace: el equipo se consulta en su vista rápida.
    expect(document.body.querySelector('a[href^="/dispositivos/"]')).toBeNull()
    expect(seccion('Mejor coincidencia')?.querySelector('button[aria-expanded]')).not.toBeNull()
  })
})
