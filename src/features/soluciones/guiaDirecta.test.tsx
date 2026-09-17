// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso, type PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  control,
  desmontarTodo,
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
import { GuiaPage, RedireccionAGuia } from './GuiaPage'

// RESOLVER RÁPIDO CON GUÍAS (encargo del 2026-09-17, secciones 3 a 8 y
// 13). Lo que se comprueba es el RECORRIDO, con la pantalla de verdad:
//
//   - abrir una guía es estar en su paso 1, sin portada ni "Empecemos";
//   - "Antes de empezar" solo aparece si hay requisitos, y solo al empezar;
//   - un aviso acompaña a su acción y no detiene nada: sin "Entendido";
//   - la información secundaria queda plegada;
//   - una guía terminada se abre en un caso nuevo, y una a medias se
//     retoma con la opción de empezar de nuevo;
//   - "Anterior" cruza de paso.
//
// Todo lo sembrado es inventado.

const RUTA = '/soluciones/cat-pruebas/guia-caja'

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones/:categoriaId/:articuloId/ejecutar', elemento: <RedireccionAGuia /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

function aviso(id: string, tareaId: string, tono: BloquePaso['tono'], texto: string): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', texto, tono, alcance: 'tarea', tareaId }
}

function conBloques(paso: PasoProcedimiento, extra: BloquePaso[]): PasoProcedimiento {
  return { ...paso, bloques: [...paso.bloques, ...extra] }
}

async function sembrarCaja(requisitos: string[] = []) {
  const p1 = pasoPrueba('caja-p1', 'Preparar la caja de prueba', ['Abrir el programa de caja', 'Entrar en Administración'])
  const p2 = conBloques(pasoPrueba('caja-p2', 'Guardar la configuración de prueba', ['Pulsar Guardar']), [
    aviso('av-riesgo', 'caja-p2-t1', 'importante', 'Guardar reemplaza la configuración anterior'),
    aviso('av-info', 'caja-p2-t1', 'info', 'Explicación de por qué se guarda aquí'),
  ])
  await sembrarGuia({ id: 'guia-caja', titulo: 'Configurar la caja de prueba', pasos: [p1, p2] })
  if (requisitos.length > 0) {
    const articulo = await db.articulos.get('guia-caja')
    await db.articulos.put({ ...articulo!, procedimiento: { ...articulo!.procedimiento!, requisitos } })
  }
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

/** El botón grande del pie, por su texto visible. */
function principal(texto: string): HTMLElement | null {
  return control(new RegExp(`^${texto}$`))
}

describe('abrir una guía', () => {
  it('entra directo al paso 1, sin portada, sin "Empecemos" y sin "Antes de empezar" vacío', async () => {
    await sembrarCaja()
    await montar(RUTAS, RUTA)

    await esperar(() => textoPantalla().includes('Abrir el programa de caja'), 'la primera acción a la vista')
    expect(textoPantalla()).toContain('Paso 1 de 2')
    expect(textoPantalla()).not.toContain('Empecemos')
    expect(textoPantalla()).not.toContain('Antes de empezar')
    expect(principal('Siguiente')).not.toBeNull()
  })

  it('la dirección antigua /ejecutar lleva a la misma guía', async () => {
    await sembrarCaja()
    await montar(RUTAS, `${RUTA}/ejecutar`)
    await esperar(() => ubicacionActual().pathname === RUTA, 'redirige a la guía')
    await esperar(() => textoPantalla().includes('Abrir el programa de caja'), 'y abre en el paso 1')
  })

  it('con requisitos, los muestra en el paso 1 y desaparecen al empezar el trabajo', async () => {
    await sembrarCaja(['Resolución de prueba en PDF'])
    await montar(RUTAS, RUTA)

    await esperar(() => textoPantalla().includes('Resolución de prueba en PDF'), 'el requisito a la vista')
    expect(textoPantalla()).toContain('Antes de empezar')

    await tocar((await esperar(() => principal('Siguiente'), 'el botón Siguiente')) as HTMLElement)
    await esperar(() => textoPantalla().includes('Entrar en Administración'), 'la segunda acción')
    expect(textoPantalla()).not.toContain('Resolución de prueba en PDF')
  })
})

describe('los avisos acompañan, no detienen', () => {
  it('el riesgo se ve junto a su acción, sin "Entendido", y la información queda plegada', async () => {
    await sembrarCaja()
    await montar(RUTAS, RUTA)

    // Paso 1: dos acciones, ningún aviso.
    await tocar((await esperar(() => principal('Siguiente'), 'Siguiente en la acción 1')) as HTMLElement)
    await esperar(() => textoPantalla().includes('Entrar en Administración'), 'la acción 2')
    expect(textoPantalla()).not.toContain('Guardar reemplaza')
    await tocar((await esperar(() => principal('Siguiente'), 'Siguiente en la acción 2')) as HTMLElement)

    // Paso 2: la alerta y la instrucción en la MISMA pantalla.
    await esperar(() => textoPantalla().includes('Pulsar Guardar'), 'la acción del paso 2')
    expect(textoPantalla()).toContain('Paso 2 de 2')
    expect(textoPantalla()).toContain('Guardar reemplaza la configuración anterior')
    expect(control(/Entendido/)).toBeNull()
    // La explicación no está a la vista hasta que se pide.
    expect(textoPantalla()).not.toContain('Explicación de por qué se guarda aquí')
    await tocar(await esperarControl('Más información'))
    expect(textoPantalla()).toContain('Explicación de por qué se guarda aquí')

    // Y la acción se hace sin confirmar nada antes: es la última, así que termina.
    await tocar((await esperar(() => principal('Terminar'), 'Terminar en la última acción')) as HTMLElement)
    await esperar(() => textoPantalla().includes('Guía terminada'), 'la guía queda terminada')
    expect(control('Salir de la guía')).not.toBeNull()
  })
})

describe('retomar y volver a empezar', () => {
  it('una guía terminada se abre en un caso nuevo, desde el paso 1', async () => {
    await sembrarCaja()
    await db.progresoPasos.put({
      articuloId: 'guia-caja',
      pasosHechos: ['caja-p1', 'caja-p2'],
      instruccionesHechas: ['caja-p1-t1', 'caja-p1-t2', 'caja-p2-t1'],
      verificacionHecha: [],
      actualizadoEn: '2026-09-16T12:00:00.000Z',
    })
    await montar(RUTAS, RUTA)

    await esperar(() => textoPantalla().includes('Abrir el programa de caja'), 'el paso 1')
    expect(textoPantalla()).not.toContain('Guía terminada')
    await esperarQue(async () => (await db.progresoPasos.get('guia-caja')) === undefined, 'el avance viejo se borra')
  })

  it('una guía a medias se retoma donde iba y ofrece empezar de nuevo', async () => {
    await sembrarCaja()
    await db.progresoPasos.put({
      articuloId: 'guia-caja',
      pasosHechos: ['caja-p1'],
      instruccionesHechas: ['caja-p1-t1', 'caja-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: '2026-09-16T12:00:00.000Z',
    })
    await montar(RUTAS, RUTA)

    await esperar(() => textoPantalla().includes('Pulsar Guardar'), 'retoma en el paso 2')
    expect(textoPantalla()).toContain('Retomas en el paso 2')

    await tocar(await esperarControl('Empezar de nuevo'))
    await esperar(() => textoPantalla().includes('Abrir el programa de caja'), 'vuelve al paso 1')
    expect(textoPantalla()).not.toContain('Retomas en el paso')
  })

  it('"Anterior" desde la primera acción de un paso lleva a la última del paso anterior', async () => {
    await sembrarCaja()
    await db.progresoPasos.put({
      articuloId: 'guia-caja',
      pasosHechos: ['caja-p1'],
      instruccionesHechas: ['caja-p1-t1', 'caja-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: '2026-09-16T12:00:00.000Z',
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Pulsar Guardar'), 'el paso 2')

    await tocar(await esperarControl(/^Anterior/))
    await esperar(() => textoPantalla().includes('Entrar en Administración'), 'la última acción del paso 1')
    expect(textoPantalla()).toContain('Paso 1 de 2')
  })
})
