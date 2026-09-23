// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso } from '../../lib/db'
import { guardarModoEjecucion } from '../../lib/preferenciasEjecucion'
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
  sembrarReferencia,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { AsistentePage } from '../soluciones/AsistentePage'

// "¿QUÉ HACE?" DENTRO DE UNA GUÍA (tarea 270, sección 14 del encargo del
// 2026-09-23). Con la ejecución de verdad, en sus dos vistas:
//
//   - una tarea que ESCRIBE un comando con ficha en el Centro de
//     consulta ofrece "¿Qué hace «…»?", que abre la ficha en la hoja de
//     siempre sin tocar el avance;
//   - un comando que el autor ya enlazó en el paso no se ofrece otra vez:
//     su tarjeta ya está a la vista.
//
// Todo lo sembrado es INVENTADO.

const RUTA = '/soluciones/cat-pruebas/guia-dns/ejecutar'
const RUTAS = [{ ruta: '/soluciones/:categoriaId/:articuloId/ejecutar', elemento: <AsistentePage /> }]

const TAREA_DNS = 'Abrir la consola y ejecutar ipconfig /flushdns'
const TAREA_PING = 'Hacer ping al servidor de prueba'
const ROTULO_DNS = '¿Qué hace «ipconfig /flushdns»?'

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
  await sembrarReferencia({
    id: 'ref-dns',
    tipo: 'comando',
    titulo: 'Limpiar la caché DNS de prueba',
    valor: 'ipconfig /flushdns',
    cuandoUsar: 'Cuando un nombre de prueba resuelve a una IP vieja.',
  })
  await sembrarReferencia({ id: 'ref-ping', tipo: 'comando', titulo: 'Comprobar la conexión de prueba', valor: 'ping' })
  const paso = pasoPrueba('dns-p1', 'Limpiar y comprobar', [TAREA_DNS, TAREA_PING])
  // El autor enlazó la ficha de "ping" a su tarea: ya se ve su tarjeta.
  const enlace: BloquePaso = {
    ...paso.bloques[1],
    id: 'dns-p1-ref-ping',
    tipo: 'referencia',
    texto: '',
    tipoTarea: null,
    tareaId: paso.bloques[1].id,
    referenciaId: 'ref-ping',
    referenciaTitulo: 'Comprobar la conexión de prueba',
    referenciaTipo: 'comando',
  }
  await sembrarGuia({ id: 'guia-dns', titulo: 'Limpiar la caché DNS de prueba', pasos: [{ ...paso, bloques: [...paso.bloques, enlace] }] })
})

afterEach(async () => {
  await desmontarTodo()
})

describe('¿Qué hace? en la vista de una acción a la vez', () => {
  it('abre la ficha del comando que la instrucción escribe, sin tocar el avance', async () => {
    await guardarModoEjecucion('foco')
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(TAREA_DNS), 'la primera acción')

    await tocar(await esperarControl(ROTULO_DNS))
    const hoja = await esperar(() => document.body.querySelector('[role=dialog]'), 'la hoja de la ficha')
    expect(hoja.textContent).toContain('Limpiar la caché DNS de prueba')
    expect(hoja.textContent).toContain('Cuando un nombre de prueba resuelve a una IP vieja.')
    // Leer la ficha no es trabajo hecho.
    const avance = await db.progresoPasos.get('guia-dns')
    expect(avance?.instruccionesHechas ?? []).not.toContain('dns-p1-t1')
  })
})

describe('¿Qué hace? en la vista del paso entero', () => {
  it('se ofrece para el comando escrito y no para el que el autor ya enlazó', async () => {
    await guardarModoEjecucion('pasoEntero')
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes(TAREA_PING), 'el paso entero')

    expect(control(ROTULO_DNS)).not.toBeNull()
    expect(control('¿Qué hace «ping»?')).toBeNull()
    // La tarjeta del comando enlazado sigue a la vista, con su valor.
    expect(textoPantalla()).toContain('Comprobar la conexión de prueba')
  })
})
