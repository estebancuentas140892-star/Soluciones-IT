// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso, type PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  control,
  desmontarTodo,
  esperar,
  limpiarBase,
  montar,
  pasoPrueba,
  sembrarGuia,
  sembrarPerfil,
  textoPantalla,
  tocar,
} from '../../pruebas/montaje'
import { GuiaPage } from './GuiaPage'

// LA GUÍA SE ENTIENDE LEYENDO POCO (encargo del 2026-09-22, secciones 3
// a 6). Lo que se comprueba con la pantalla de verdad:
//
//   - la RUTA del procedimiento orienta: de dónde vengo, dónde estoy y
//     qué viene, con el estado de cada paso;
//   - cada paso responde QUÉ HACER, DÓNDE HACERLO y QUÉ DEBO VER;
//   - el lugar sale con la PRIMERA acción del paso y lo que debe verse,
//     con la ÚLTIMA;
//   - "Debes ver" es el `resultado` del paso, nunca su `objetivo`, que
//     sigue plegado como "Para qué";
//   - el dato protegido del paso se anuncia como "Credencial necesaria";
//   - una comprobación se distingue por icono y palabra, no por color.
//
// Todo lo sembrado es inventado.

const RUTA = '/soluciones/cat-pruebas/guia-ruta'

const RUTAS = [
  { ruta: '/soluciones/:categoriaId/:articuloId', elemento: <GuiaPage /> },
  { ruta: '/soluciones', elemento: <p>LISTA DE GUÍAS</p> },
]

function conCampos(paso: PasoProcedimiento, campos: Partial<PasoProcedimiento>): PasoProcedimiento {
  return { ...paso, ...campos }
}

function aviso(id: string, tareaId: string, tono: BloquePaso['tono'], texto: string): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', texto, tono, alcance: 'tarea', tareaId }
}

/**
 * Tres pasos: uno con objetivo, lugar, resultado y credencial, uno con
 * riesgo y uno de comprobación.
 */
async function sembrarRuta() {
  const p1 = conCampos(
    pasoPrueba('ruta-p1', 'Abrir Ejecutar', ['Presiona Windows + R', 'Escribe control printers']),
    {
      objetivo: 'Llegar a la lista de impresoras de prueba',
      lugar: 'Escritorio de Windows',
      resultado: 'La ventana Dispositivos e impresoras',
      vinculoProtegido: { tipo: 'credencial', id: 'cred-ruta', titulo: 'Acceso de prueba al equipo' },
    },
  )
  const p2 = conCampos(pasoPrueba('ruta-p2', 'Entrar a la intranet', ['Escribe la dirección']), {
    bloques: [
      ...pasoPrueba('ruta-p2', 'Entrar a la intranet', ['Escribe la dirección']).bloques,
      aviso('ruta-p2-av', 'ruta-p2-t1', 'precaucion', 'Puede cortar el servicio de prueba'),
    ],
  })
  const p3 = pasoPrueba('ruta-p3', 'Comprobar la impresora', ['Imprime una página de prueba'])
  p3.bloques[0] = { ...p3.bloques[0], tipoTarea: 'verificacion' }
  await sembrarGuia({ id: 'guia-ruta', titulo: 'Guía con ruta de prueba', pasos: [p1, p2, p3] })
}

beforeEach(async () => {
  await limpiarBase()
  await sembrarPerfil(false)
})

afterEach(async () => {
  await desmontarTodo()
})

describe('la ruta del procedimiento', () => {
  it('dice dónde estoy y qué viene, con el nombre corto de cada paso', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 1 de 3'), 'el paso 1')

    // El nodo actual es la cabecera del paso: no se repite en la vista.
    expect(textoPantalla().split('Paso 1 de 3').length - 1).toBeLessThanOrEqual(2)
    // El nombre corto del paso siguiente, sin el verbo de navegación, y
    // su riesgo anunciado antes de llegar.
    expect(control(/^Paso 2 de 3: Entrar a la intranet \(pendiente, con un riesgo que atender\)$/)).not.toBeNull()
    expect(control(/^Paso 3 de 3: Comprobar la impresora \(pendiente\)$/)).not.toBeNull()
  })

  it('un nodo mueve la vista a su paso y no marca nada', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 1 de 3'), 'el paso 1')

    await tocar(await esperar(() => control(/^Paso 3 de 3: Comprobar la impresora/), 'el nodo del paso 3'))
    await esperar(() => textoPantalla().includes('Paso 3 de 3'), 'el paso 3')
    // Nada quedó marcado: el paso 1 sigue pendiente.
    expect(control(/^Paso 1 de 3: Abrir Ejecutar \(pendiente\)/)).not.toBeNull()
  })

  it('el paso hecho se marca en la ruta', async () => {
    await sembrarRuta()
    await db.progresoPasos.put({
      articuloId: 'guia-ruta',
      pasosHechos: ['ruta-p1'],
      instruccionesHechas: ['ruta-p1-t1', 'ruta-p1-t2'],
      verificacionHecha: [],
      actualizadoEn: new Date().toISOString(),
    })
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 2 de 3'), 'el paso 2')

    expect(control(/^Paso 1 de 3: Abrir Ejecutar \(hecho\)/)).not.toBeNull()
  })
})

describe('qué hacer, dónde y qué debo ver', () => {
  it('el lugar acompaña a la primera acción y lo que debe verse, a la última', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Presiona Windows + R'), 'la primera acción')

    // Primera acción: dónde sí, debes ver todavía no.
    expect(textoPantalla()).toContain('Dónde:')
    expect(textoPantalla()).toContain('Escritorio de Windows')
    expect(textoPantalla()).toContain('Qué hacer')
    expect(textoPantalla()).not.toContain('Debes ver:')
    expect(textoPantalla()).toContain('Credencial necesaria')
    expect(textoPantalla()).toContain('Acceso de prueba al equipo')

    // Última acción del paso: al revés.
    await tocar(await esperar(() => control(/^Siguiente$/), 'siguiente'))
    await esperar(() => textoPantalla().includes('Escribe control printers'), 'la segunda acción')
    expect(textoPantalla()).toContain('Debes ver:')
    expect(textoPantalla()).toContain('La ventana Dispositivos e impresoras')
    expect(textoPantalla()).not.toContain('Dónde:')
  })

  it('el objetivo no se pinta como "Debes ver": queda plegado como "Para qué"', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Presiona Windows + R'), 'la primera acción')

    // Plegado: no está a la vista hasta que se pide.
    expect(textoPantalla()).not.toContain('Llegar a la lista de impresoras de prueba')
    await tocar(await esperar(() => control(/^Más información$/), 'más información'))
    await esperar(() => textoPantalla().includes('Para qué:'), 'el para qué')
    expect(textoPantalla()).toContain('Llegar a la lista de impresoras de prueba')

    // Y en la última acción, "Debes ver" dice el resultado, no el objetivo.
    await tocar(await esperar(() => control(/^Siguiente$/), 'siguiente'))
    await esperar(() => textoPantalla().includes('Debes ver:'), 'debes ver')
    const texto = textoPantalla()
    expect(texto).toContain('Debes ver: La ventana Dispositivos e impresoras')
    expect(texto).not.toContain('Debes ver: Llegar a la lista')
  })

  it('el paso entero enseña dónde, para qué, la credencial y lo que debe verse, en ese orden', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 1 de 3'), 'el paso 1')

    await tocar(await esperar(() => control(/^Ver la ruta completa/), 'ver la ruta completa'))
    await tocar(await esperar(() => control(/^Ver el paso entero$/), 'ver el paso entero'))
    await esperar(
      () => textoPantalla().includes('Presiona Windows + R') && textoPantalla().includes('Escribe control printers'),
      'las dos acciones del paso a la vez',
    )

    const texto = textoPantalla()
    // El objetivo se lee entero bajo la cabecera, sin rótulo de color.
    expect(texto).toContain('Llegar a la lista de impresoras de prueba')
    expect(texto).not.toContain('Debes ver: Llegar a la lista')
    const donde = texto.indexOf('Dónde:')
    const primeraAccion = texto.indexOf('Presiona Windows + R')
    const credencial = texto.indexOf('Credencial necesaria')
    const debesVer = texto.indexOf('Debes ver: La ventana Dispositivos e impresoras')
    expect(donde).toBeGreaterThan(-1)
    expect(donde).toBeLessThan(primeraAccion)
    expect(primeraAccion).toBeLessThan(credencial)
    expect(credencial).toBeLessThan(debesVer)
  })

  it('una comprobación se anuncia con su palabra, no solo con un color', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 1 de 3'), 'el paso 1')

    await tocar(await esperar(() => control(/^Paso 3 de 3: Comprobar la impresora/), 'el nodo del paso 3'))
    await esperar(() => textoPantalla().includes('Imprime una página de prueba'), 'la comprobación')
    expect(textoPantalla()).toContain('Comprueba')
    expect(control(/^Comprobado · terminar$/)).not.toBeNull()
  })

  it('un riesgo real se lee antes de la instrucción, con su palabra', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 1 de 3'), 'el paso 1')

    await tocar(await esperar(() => control(/^Paso 2 de 3: Entrar a la intranet/), 'el nodo del paso 2'))
    await esperar(() => textoPantalla().includes('Escribe la dirección'), 'la acción del paso 2')
    const texto = textoPantalla()
    expect(texto).toContain('Precaución.')
    expect(texto.indexOf('Precaución.')).toBeLessThan(texto.indexOf('Escribe la dirección'))
  })
})
