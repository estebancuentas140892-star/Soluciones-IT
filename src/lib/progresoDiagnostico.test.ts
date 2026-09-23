import { beforeEach, describe, expect, it } from 'vitest'
import { db, type NodoDiagnostico, type OpcionDiagnostico } from './db'
import {
  duracionSegundos,
  eliminarProgresoDiagnostico,
  iniciarDiagnostico,
  raizDelProcedimiento,
  responderOpcion,
  terminarEjecucionArticulo,
  volverAtras,
} from './progresoDiagnostico'

function opcion(cambios: Partial<OpcionDiagnostico> & { id: string; etiqueta: string }): OpcionDiagnostico {
  return { siguienteNodoId: null, articuloId: null, articuloTitulo: '', mensajeFinal: '', resultado: '', ...cambios }
}

const nodo1: NodoDiagnostico = {
  id: 'n1',
  tituloInterno: '',
  pregunta: '¿Está encendida?',
  descripcion: '',
  opciones: [
    opcion({ id: 'o1', etiqueta: 'Sí', siguienteNodoId: 'n2' }),
    opcion({ id: 'o2', etiqueta: 'No', mensajeFinal: 'Enciéndela.' }),
  ],
}

const nodo2: NodoDiagnostico = {
  id: 'n2',
  tituloInterno: '',
  pregunta: '¿Aparece instalada?',
  descripcion: '',
  opciones: [
    opcion({
      id: 'o3',
      etiqueta: 'No',
      articuloId: 'art-1',
      articuloTitulo: 'Conectar impresora',
      siguienteNodoId: 'n1',
    }),
    opcion({ id: 'o4', etiqueta: 'Instalar y terminar', articuloId: 'art-2', articuloTitulo: 'Instalar driver' }),
  ],
}

beforeEach(async () => {
  await db.progresoDiagnostico.clear()
  await db.progresoPasos.clear()
})

describe('flujo del diagnóstico', () => {
  it('inicia en la primera pregunta con el camino vacío', async () => {
    await iniciarDiagnostico('diag-1', 'n1')
    const progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({ tipo: 'pregunta', nodoId: 'n1' })
    expect(progreso?.camino).toEqual([])
  })

  it('responder avanza a la siguiente pregunta y guarda el paso con sus textos', async () => {
    await iniciarDiagnostico('diag-1', 'n1')
    await responderOpcion('diag-1', nodo1, nodo1.opciones[0])
    const progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({ tipo: 'pregunta', nodoId: 'n2' })
    expect(progreso?.camino).toEqual([
      { nodoId: 'n1', pregunta: '¿Está encendida?', opcionId: 'o1', etiqueta: 'Sí' },
    ])
  })

  it('una rama terminal sin procedimiento pasa directo al resultado final', async () => {
    await iniciarDiagnostico('diag-1', 'n1')
    await responderOpcion('diag-1', nodo1, nodo1.opciones[1])
    const progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({
      tipo: 'final',
      mensajeFinal: 'Enciéndela.',
      articuloId: null,
      articuloTitulo: '',
      resultado: '',
    })
  })

  // Tarea 263: el procedimiento dentro del recorrido guarda su avance en
  // la raíz propia del recorrido; la fila de la guía NO se toca.
  it('una opción con procedimiento pasa a ejecutarlo sin tocar el avance propio de la guía', async () => {
    const avancePropio = {
      articuloId: 'art-1',
      pasosHechos: ['p1'],
      instruccionesHechas: [],
      actualizadoEn: new Date().toISOString(),
    }
    await db.progresoPasos.put(avancePropio)
    // Y un avance viejo en la raíz del recorrido, de otro procedimiento.
    await db.progresoPasos.put({ ...avancePropio, articuloId: raizDelProcedimiento('diag-1'), pasosHechos: ['viejo'] })

    await iniciarDiagnostico('diag-1', 'n2')
    await responderOpcion('diag-1', nodo2, nodo2.opciones[0])

    const progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({
      tipo: 'articulo',
      articuloId: 'art-1',
      articuloTitulo: 'Conectar impresora',
      siguienteNodoId: 'n1',
      mensajeFinal: '',
      resultado: '',
    })
    expect(progreso?.procedimientoEnCurso).toBe('art-1')
    // La guía conserva lo que el técnico llevaba hecho por su cuenta...
    expect((await db.progresoPasos.get('art-1'))?.pasosHechos).toEqual(['p1'])
    // ...y el procedimiento arranca de cero dentro del recorrido.
    expect(await db.progresoPasos.get(raizDelProcedimiento('diag-1'))).toBeUndefined()
  })

  it('retroceder y volver a elegir el mismo procedimiento conserva lo hecho en él', async () => {
    await iniciarDiagnostico('diag-1', 'n2')
    await responderOpcion('diag-1', nodo2, nodo2.opciones[0])
    await db.progresoPasos.put({
      articuloId: raizDelProcedimiento('diag-1'),
      pasosHechos: ['p1'],
      instruccionesHechas: [],
      actualizadoEn: new Date().toISOString(),
    })
    await volverAtras('diag-1')
    await responderOpcion('diag-1', nodo2, nodo2.opciones[0])
    expect((await db.progresoPasos.get(raizDelProcedimiento('diag-1')))?.pasosHechos).toEqual(['p1'])
  })

  it('al terminar el procedimiento continúa en la siguiente pregunta y lo anota como ejecutado', async () => {
    await iniciarDiagnostico('diag-1', 'n2')
    await responderOpcion('diag-1', nodo2, nodo2.opciones[0])
    await terminarEjecucionArticulo('diag-1')

    const progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({ tipo: 'pregunta', nodoId: 'n1' })
    expect(progreso?.articulosEjecutados).toEqual([{ id: 'art-1', titulo: 'Conectar impresora' }])
  })

  it('al terminar el procedimiento de una rama terminal pasa al resultado final', async () => {
    await iniciarDiagnostico('diag-1', 'n2')
    await responderOpcion('diag-1', nodo2, nodo2.opciones[1])
    await terminarEjecucionArticulo('diag-1')

    const progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({
      tipo: 'final',
      mensajeFinal: '',
      articuloId: 'art-2',
      articuloTitulo: 'Instalar driver',
      resultado: '',
    })
  })

  it('terminar la ejecución reinicia el avance del procedimiento dentro del recorrido, no el de la guía', async () => {
    await iniciarDiagnostico('diag-1', 'n2')
    await responderOpcion('diag-1', nodo2, nodo2.opciones[1])
    const fila = { pasosHechos: ['p1'], instruccionesHechas: [], actualizadoEn: new Date().toISOString() }
    await db.progresoPasos.put({ ...fila, articuloId: raizDelProcedimiento('diag-1') })
    await db.progresoPasos.put({ ...fila, articuloId: 'art-2' })
    await terminarEjecucionArticulo('diag-1')
    expect(await db.progresoPasos.get(raizDelProcedimiento('diag-1'))).toBeUndefined()
    expect((await db.progresoPasos.get('art-2'))?.pasosHechos).toEqual(['p1'])
    expect((await db.progresoDiagnostico.get('diag-1'))?.procedimientoEnCurso).toBeNull()
  })

  it('descartar el recorrido borra también el avance de su procedimiento', async () => {
    await iniciarDiagnostico('diag-1', 'n2')
    await responderOpcion('diag-1', nodo2, nodo2.opciones[0])
    await db.progresoPasos.put({
      articuloId: raizDelProcedimiento('diag-1'),
      pasosHechos: ['p1'],
      instruccionesHechas: [],
      actualizadoEn: new Date().toISOString(),
    })
    await eliminarProgresoDiagnostico('diag-1')
    expect(await db.progresoDiagnostico.get('diag-1')).toBeUndefined()
    expect(await db.progresoPasos.get(raizDelProcedimiento('diag-1'))).toBeUndefined()
  })

  it('volver atrás deshace la última respuesta, incluso desde una ejecución', async () => {
    await iniciarDiagnostico('diag-1', 'n1')
    await responderOpcion('diag-1', nodo1, nodo1.opciones[0])
    await responderOpcion('diag-1', nodo2, nodo2.opciones[0])

    await volverAtras('diag-1')
    let progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({ tipo: 'pregunta', nodoId: 'n2' })
    expect(progreso?.camino).toHaveLength(1)

    await volverAtras('diag-1')
    progreso = await db.progresoDiagnostico.get('diag-1')
    expect(progreso?.estado).toEqual({ tipo: 'pregunta', nodoId: 'n1' })
    expect(progreso?.camino).toHaveLength(0)

    // Sin camino no hay nada que deshacer.
    await volverAtras('diag-1')
    expect((await db.progresoDiagnostico.get('diag-1'))?.estado).toEqual({ tipo: 'pregunta', nodoId: 'n1' })
  })

  it('eliminar el progreso borra la sesión', async () => {
    await iniciarDiagnostico('diag-1', 'n1')
    await eliminarProgresoDiagnostico('diag-1')
    expect(await db.progresoDiagnostico.get('diag-1')).toBeUndefined()
  })

  it('la duración se mide desde el inicio de la sesión', async () => {
    await iniciarDiagnostico('diag-1', 'n1')
    const progreso = await db.progresoDiagnostico.get('diag-1')
    const inicio = Date.parse(progreso!.iniciadoEn)
    expect(duracionSegundos(progreso!, inicio + 90_000)).toBe(90)
    expect(duracionSegundos({ ...progreso!, iniciadoEn: 'no es fecha' })).toBe(0)
  })
})
