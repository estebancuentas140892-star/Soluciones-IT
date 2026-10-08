// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, type BloquePaso, type PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
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

// LA EJECUCIÓN MÍNIMA (tarea 307): la guía de la ruta trae los textos
// heredados del paso ("Dónde", "Para qué" y el "Debes ver" de texto). Se
// leen sin romper nada, pero ya no se muestran en ningún sitio de la
// ejecución.
describe('qué hacer, sin los textos heredados del paso (tarea 307)', () => {
  it('una guía con dónde, para qué y debes ver de texto carga y no los enseña en ninguna acción', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Presiona Windows + R'), 'la primera acción')

    expect(textoPantalla()).toContain('Qué hacer')
    expect(textoPantalla()).toContain('Credencial necesaria')
    expect(textoPantalla()).toContain('Acceso de prueba al equipo')
    for (const retirado of ['Dónde', 'Escritorio de Windows', 'Más información', 'Para qué', 'Llegar a la lista de impresoras de prueba']) {
      expect(textoPantalla()).not.toContain(retirado)
    }

    // La última acción del paso tampoco: sin imagen, no hay "Debes ver".
    await tocar(await esperar(() => control(/^Completar y seguir$/), 'completar y seguir'))
    await esperar(() => textoPantalla().includes('Escribe control printers'), 'la segunda acción')
    expect(textoPantalla()).not.toContain('Debes ver')
    expect(textoPantalla()).not.toContain('La ventana Dispositivos e impresoras')
  })

  it('el paso entero enseña su título, sus acciones y la credencial, sin dónde, para qué ni debes ver de texto', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 1 de 3'), 'el paso 1')

    await tocar(await esperar(() => control(/^Paso 1 de 3\. Abrir el índice de pasos$/), 'el contador que abre el índice'))
    await tocar(await esperar(() => control(/^Ver el paso entero$/), 'ver el paso entero'))
    await esperar(
      () => textoPantalla().includes('Presiona Windows + R') && textoPantalla().includes('Escribe control printers'),
      'las dos acciones del paso a la vez',
    )

    const texto = textoPantalla()
    for (const retirado of ['Dónde', 'Escritorio de Windows', 'Llegar a la lista de impresoras de prueba', 'Debes ver', 'La ventana Dispositivos e impresoras']) {
      expect(texto).not.toContain(retirado)
    }
    expect(texto.indexOf('Presiona Windows + R')).toBeLessThan(texto.indexOf('Credencial necesaria'))
  })

  it('una comprobación se anuncia con su palabra, no solo con un color', async () => {
    await sembrarRuta()
    // Los pasos 1 y 2 hechos: el 3, la comprobación, es el de trabajo.
    await db.progresoPasos.put({
      articuloId: 'guia-ruta',
      pasosHechos: ['ruta-p1', 'ruta-p2'],
      instruccionesHechas: ['ruta-p1-t1', 'ruta-p1-t2', 'ruta-p2-t1'],
      verificacionHecha: [],
      actualizadoEn: new Date().toISOString(),
    })
    await montar(RUTAS, RUTA)

    await esperar(() => textoPantalla().includes('Imprime una página de prueba'), 'la comprobación')
    expect(textoPantalla()).toContain('Comprueba')
    // El botón dice la consecuencia y no "Comprobado" (propuesta final de
    // Claude Design): es lo último que queda, así que termina.
    expect(control(/^Completar y terminar$/)).not.toBeNull()
    expect(control(/^Comprobado/)).toBeNull()
  })

  it('un riesgo real se lee con su palabra, ANTES de su acción y en su propia pantalla (tarea 311)', async () => {
    await sembrarRuta()
    await montar(RUTAS, RUTA)
    await esperar(() => textoPantalla().includes('Paso 1 de 3'), 'el paso 1')

    // También al consultar un paso: la acción de riesgo pendiente llega por su advertencia.
    await tocar(await esperar(() => control(/^Paso 2 de 3: Entrar a la intranet/), 'el nodo del paso 2'))
    await esperar(() => textoPantalla().includes('Antes de continuar'), 'la advertencia del paso 2')
    const texto = textoPantalla()
    expect(texto).toContain('Precaución. Antes de continuar')
    // El riesgo primero; la acción, como lo que sigue.
    expect(texto.indexOf('Precaución.')).toBeLessThan(texto.indexOf('Escribe la dirección'))
    expect(texto).toContain('Lo que sigue')
    // En la consulta, "Acción siguiente" pasa de la advertencia a su acción, que no la repite.
    await tocar(await esperarControl(/^Acción siguiente/))
    await esperar(() => textoPantalla().includes('Qué hacer'), 'la acción del paso 2')
    expect(textoPantalla()).not.toContain('Antes de continuar')
    expect(textoPantalla()).not.toContain('Precaución.')
  })
})
