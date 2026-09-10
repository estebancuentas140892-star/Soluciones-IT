import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  alternarInstruccionHecha,
  alternarVerificacionFinal,
  avanceDe,
  contarHechos,
  contarInstruccionesHechas,
  claveVistaPrevia,
  ejecucionAbierta,
  empezarEjecucion,
  limpiarProgresoVistaPrevia,
  establecerPasoHecho,
  leerAvance,
  marcarPasoSaltado,
  quitarPasoSaltado,
  registrarEvidenciaPaso,
  reiniciarProgreso,
  verificacionFinalCompleta,
} from './progresoPasos'

beforeEach(async () => {
  await db.progresoPasos.clear()
})

describe('establecerPasoHecho', () => {
  it('marca y desmarca un paso', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])

    await establecerPasoHecho('articulo-1', 'paso-a', false)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })

  it('arrastra las tareas del paso al marcarlo y desmarcarlo', async () => {
    const tareas = ['t1', 't2', 't3']

    await establecerPasoHecho('articulo-1', 'paso-a', true, tareas)
    let fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual(tareas)

    await establecerPasoHecho('articulo-1', 'paso-a', false, tareas)
    fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosHechos).toEqual([])
    expect(fila?.instruccionesHechas).toEqual([])
  })

  it('no toca las tareas de otros pasos', async () => {
    await alternarInstruccionHecha('articulo-1', 'paso-b', 'tb1', ['tb1', 'tb2'])
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['ta1', 'ta2'])
    await establecerPasoHecho('articulo-1', 'paso-a', false, ['ta1', 'ta2'])

    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual(['tb1'])
  })

  it('conserva la verificación final al marcar un paso', async () => {
    await alternarVerificacionFinal('articulo-1', 0)
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['ta1'])
    expect((await db.progresoPasos.get('articulo-1'))?.verificacionHecha).toEqual([0])
  })

  it('lleva el avance por artículo, sin mezclarlos', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    await establecerPasoHecho('articulo-2', 'paso-b', true)

    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual(['paso-a'])
    expect((await db.progresoPasos.get('articulo-2'))?.pasosHechos).toEqual(['paso-b'])
  })
})

describe('alternarInstruccionHecha', () => {
  it('marca y desmarca una tarea sin completar el paso', async () => {
    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 't1', ['t1', 't2', 't3'])
    expect(quedaCompleto).toBe(false)

    let fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual(['t1'])
    expect(fila?.pasosHechos).toEqual([])

    await alternarInstruccionHecha('articulo-1', 'paso-a', 't1', ['t1', 't2', 't3'])
    fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.instruccionesHechas).toEqual([])
  })

  it('devuelve true al marcar la última tarea, pero NO marca el paso (lo decide la vista)', async () => {
    // El paso es un contenedor: completar las tareas no basta, aun puede
    // quedar un subprocedimiento o una solución. Por eso aquí no se
    // agrega a pasosHechos; la señal (true) la usa la vista.
    await alternarInstruccionHecha('articulo-1', 'paso-a', 't1', ['t1', 't2'])
    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 't2', ['t1', 't2'])

    expect(quedaCompleto).toBe(true)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })

  it('desmarcar una tarea vuelve pendiente un paso completado', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['t1', 't2'])

    const quedaCompleto = await alternarInstruccionHecha('articulo-1', 'paso-a', 't2', ['t1', 't2'])
    expect(quedaCompleto).toBe(false)
    expect((await db.progresoPasos.get('articulo-1'))?.pasosHechos).toEqual([])
  })
})

describe('saltar un paso', () => {
  // La garantía que pide el encargo del 2026-09-09 (cambio 3): saltar
  // es avanzar SIN resolver, así que el paso queda pendiente. Si
  // acabara en `pasosHechos`, el resumen diría que el procedimiento se
  // completó sobre un paso que nadie hizo.
  it('anota el salto y NO marca el paso como hecho', async () => {
    await marcarPasoSaltado('articulo-1', 'paso-b')
    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosSaltados).toEqual(['paso-b'])
    expect(fila?.pasosHechos ?? []).toEqual([])
    expect(fila?.instruccionesHechas ?? []).toEqual([])
  })

  it('no borra lo que ya estaba hecho', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['t1'])
    await marcarPasoSaltado('articulo-1', 'paso-b')
    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosHechos).toEqual(['paso-a'])
    expect(fila?.instruccionesHechas).toEqual(['t1'])
    expect(fila?.pasosSaltados).toEqual(['paso-b'])
  })

  it('saltar dos veces el mismo paso no lo duplica', async () => {
    await marcarPasoSaltado('articulo-1', 'paso-b')
    await marcarPasoSaltado('articulo-1', 'paso-b')
    expect((await db.progresoPasos.get('articulo-1'))?.pasosSaltados).toEqual(['paso-b'])
  })

  it('retomarlo retira la marca sin tocar nada más', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    await marcarPasoSaltado('articulo-1', 'paso-b')
    await quitarPasoSaltado('articulo-1', 'paso-b')
    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosSaltados).toEqual([])
    expect(fila?.pasosHechos).toEqual(['paso-a'])
  })

  it('completar despues un paso saltado si lo marca como hecho', async () => {
    await marcarPasoSaltado('articulo-1', 'paso-b')
    await establecerPasoHecho('articulo-1', 'paso-b', true)
    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosHechos).toEqual(['paso-b'])
  })
})

describe('reiniciarProgreso', () => {
  it('borra el avance del artículo, incluidas las tareas', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['t1', 't2'])
    await reiniciarProgreso('articulo-1')
    expect(await db.progresoPasos.get('articulo-1')).toBeUndefined()
  })
})

describe('verificación final', () => {
  it('alterna casillas por índice y decide si está completa', async () => {
    expect(verificacionFinalCompleta(undefined, 0)).toBe(true) // sin items
    expect(verificacionFinalCompleta(undefined, 2)).toBe(false)

    await alternarVerificacionFinal('articulo-1', 0)
    await alternarVerificacionFinal('articulo-1', 1)
    const fila = await db.progresoPasos.get('articulo-1')
    expect(new Set(fila?.verificacionHecha)).toEqual(new Set([0, 1]))
    expect(verificacionFinalCompleta(fila?.verificacionHecha, 2)).toBe(true)

    await alternarVerificacionFinal('articulo-1', 1)
    expect(verificacionFinalCompleta((await db.progresoPasos.get('articulo-1'))?.verificacionHecha, 2)).toBe(false)
  })
})

describe('registrarEvidenciaPaso', () => {
  it('guarda el id de la entrada de historial asociada al paso', async () => {
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')
    expect((await db.progresoPasos.get('articulo-1'))?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-1' })
  })

  it('no pisa la evidencia de otros pasos del mismo artículo', async () => {
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')
    await registrarEvidenciaPaso('articulo-1', 'paso-b', 'entrada-2')
    expect((await db.progresoPasos.get('articulo-1'))?.evidenciasPorPaso).toEqual({
      'paso-a': 'entrada-1',
      'paso-b': 'entrada-2',
    })
  })

  it('conserva el resto del avance ya guardado (pasos, tareas, verificación)', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true, ['t1'])
    await alternarVerificacionFinal('articulo-1', 0)
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')

    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.pasosHechos).toEqual(['paso-a'])
    expect(fila?.instruccionesHechas).toEqual(['t1'])
    expect(fila?.verificacionHecha).toEqual([0])
    expect(fila?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-1' })
  })

  it('lleva la evidencia por artículo, sin mezclarla entre procedimientos', async () => {
    await registrarEvidenciaPaso('articulo-1', 'paso-a', 'entrada-1')
    await registrarEvidenciaPaso('articulo-2', 'paso-a', 'entrada-2')

    expect((await db.progresoPasos.get('articulo-1'))?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-1' })
    expect((await db.progresoPasos.get('articulo-2'))?.evidenciasPorPaso).toEqual({ 'paso-a': 'entrada-2' })
  })
})

describe('contadores', () => {
  it('no cuenta pasos hechos que ya no existen en el procedimiento', () => {
    expect(contarHechos(['paso-a', 'paso-borrado'], ['paso-a', 'paso-b'])).toBe(1)
    expect(contarHechos([], ['paso-a'])).toBe(0)
  })

  it('cuenta solo las tareas marcadas de la lista indicada', () => {
    const hechas = ['t1', 't3', 'otro-paso-t1']
    expect(contarInstruccionesHechas(hechas, ['t1', 't2', 't3'])).toBe(2)
    expect(contarInstruccionesHechas(hechas, ['tx', 'ty'])).toBe(0)
    expect(contarInstruccionesHechas(undefined, ['t1', 't2'])).toBe(0)
  })
})

// PROGRESO DE LOS VINCULOS, AISLADO POR EJECUCION (encargo del
// 2026-09-09, tarea 2). Lo que se comprueba aqui es que el avance de
// una guia vinculada pertenece a la ejecucion que la exige, y no a la
// guia vinculada ni a cualquier otra que la reutilice.
describe('progreso de un vinculo dentro de una ejecucion', () => {
  const vinculo = { raizId: 'guia-principal', vinculoId: 'guia-vinculada' }

  it('guarda el avance del vinculo dentro de la fila de la ejecucion', async () => {
    await establecerPasoHecho(vinculo, 'paso-v1', true, ['tv1'])

    const fila = await db.progresoPasos.get('guia-principal')
    expect(fila?.vinculos?.['guia-vinculada']?.pasosHechos).toEqual(['paso-v1'])
    expect(fila?.vinculos?.['guia-vinculada']?.instruccionesHechas).toEqual(['tv1'])
    // La guia principal no se da por avanzada por lo que hizo su vinculo.
    expect(fila?.pasosHechos).toEqual([])
  })

  it('no toca la fila propia de la guia vinculada', async () => {
    await establecerPasoHecho(vinculo, 'paso-v1', true)
    expect(await db.progresoPasos.get('guia-vinculada')).toBeUndefined()
  })

  it('no da por cumplido el vinculo porque esa guia se completara antes por su cuenta', async () => {
    await establecerPasoHecho('guia-vinculada', 'paso-v1', true)
    expect(await leerAvance(vinculo)).toBeUndefined()
  })

  it('separa el avance de dos guias principales que reutilizan el mismo procedimiento', async () => {
    await establecerPasoHecho({ raizId: 'guia-a', vinculoId: 'compartida' }, 'paso-1', true)

    expect((await leerAvance({ raizId: 'guia-a', vinculoId: 'compartida' }))?.pasosHechos).toEqual([
      'paso-1',
    ])
    expect(await leerAvance({ raizId: 'guia-b', vinculoId: 'compartida' })).toBeUndefined()
  })

  it('conserva el avance del vinculo si se abandona y se vuelve', async () => {
    await alternarInstruccionHecha(vinculo, 'paso-v1', 'tv1', ['tv1', 'tv2'])
    // Salir y volver es releer: nada mas.
    expect((await leerAvance(vinculo))?.instruccionesHechas).toEqual(['tv1'])
  })

  it('reiniciar la guia principal reinicia sus dependencias de esa ejecucion', async () => {
    await establecerPasoHecho('guia-principal', 'paso-1', true)
    await establecerPasoHecho(vinculo, 'paso-v1', true)

    await reiniciarProgreso('guia-principal')

    expect(await leerAvance(vinculo)).toBeUndefined()
    expect(await db.progresoPasos.get('guia-principal')).toBeUndefined()
  })

  it('reiniciar un vinculo deja intacto el resto de la ejecucion', async () => {
    await establecerPasoHecho('guia-principal', 'paso-1', true)
    await establecerPasoHecho(vinculo, 'paso-v1', true)
    await establecerPasoHecho({ raizId: 'guia-principal', vinculoId: 'otra' }, 'paso-o1', true)

    await reiniciarProgreso(vinculo)

    expect(await leerAvance(vinculo)).toBeUndefined()
    expect((await leerAvance({ raizId: 'guia-principal', vinculoId: 'otra' }))?.pasosHechos).toEqual([
      'paso-o1',
    ])
    expect((await leerAvance('guia-principal'))?.pasosHechos).toEqual(['paso-1'])
  })

  it('conserva el avance independiente de la guia vinculada fuera del procedimiento', async () => {
    await establecerPasoHecho(vinculo, 'paso-v1', true)
    await establecerPasoHecho('guia-vinculada', 'paso-v2', true)

    expect((await leerAvance(vinculo))?.pasosHechos).toEqual(['paso-v1'])
    expect((await leerAvance('guia-vinculada'))?.pasosHechos).toEqual(['paso-v2'])
  })

  it('una fila antigua sin vinculos no completa ninguno', async () => {
    await db.progresoPasos.put({
      articuloId: 'guia-principal',
      pasosHechos: ['paso-1'],
      actualizadoEn: new Date().toISOString(),
    })
    const fila = await db.progresoPasos.get('guia-principal')

    expect(avanceDe(fila, 'guia-principal')?.pasosHechos).toEqual(['paso-1'])
    expect(avanceDe(fila, vinculo)).toBeUndefined()
  })
})

describe('identificador de la ejecucion', () => {
  it('nace con la primera escritura y no cambia mientras dure', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    const primero = await ejecucionAbierta('articulo-1')
    expect(primero).toBeTruthy()

    await establecerPasoHecho('articulo-1', 'paso-b', true)
    expect(await ejecucionAbierta('articulo-1')).toBe(primero)
  })

  it('empezar de nuevo estrena identificador y deja las dependencias pendientes', async () => {
    await establecerPasoHecho('articulo-1', 'paso-a', true)
    await establecerPasoHecho({ raizId: 'articulo-1', vinculoId: 'guia-vinculada' }, 'paso-v1', true)
    const primero = await ejecucionAbierta('articulo-1')

    const segundo = await empezarEjecucion('articulo-1')

    expect(segundo).not.toBe(primero)
    expect((await leerAvance('articulo-1'))?.pasosHechos).toEqual([])
    expect(await leerAvance({ raizId: 'articulo-1', vinculoId: 'guia-vinculada' })).toBeUndefined()
  })

  it('una fila antigua sin identificador estrena uno sin perder lo marcado', async () => {
    await db.progresoPasos.put({
      articuloId: 'articulo-1',
      pasosHechos: ['paso-a'],
      actualizadoEn: new Date().toISOString(),
    })

    await establecerPasoHecho('articulo-1', 'paso-b', true)

    const fila = await db.progresoPasos.get('articulo-1')
    expect(fila?.ejecucionId).toBeTruthy()
    expect(fila?.pasosHechos).toEqual(['paso-a', 'paso-b'])
  })
})

// LA PRUEBA DEL EDITOR NO TOCA EL PROGRESO REAL (encargo del
// 2026-09-09, tarea 6).
describe('progreso de la vista previa', () => {
  it('cada sesion de prueba estrena su propia raiz', () => {
    const a = claveVistaPrevia('articulo-1')
    const b = claveVistaPrevia('articulo-1')
    expect(a).not.toBe(b)
    expect(a.startsWith('vista-previa:articulo-1:')).toBe(true)
  })

  it('lo marcado en la prueba, y el avance de sus vinculos, vive fuera del progreso real', async () => {
    const raiz = claveVistaPrevia('articulo-1')
    await establecerPasoHecho(raiz, 'paso-a', true)
    await establecerPasoHecho({ raizId: raiz, vinculoId: 'guia-vinculada' }, 'paso-v1', true)

    expect(await db.progresoPasos.get('articulo-1')).toBeUndefined()
    expect(await db.progresoPasos.get('guia-vinculada')).toBeUndefined()
    expect((await leerAvance(raiz))?.pasosHechos).toEqual(['paso-a'])
  })

  it('cerrar la prueba no deja rastro', async () => {
    const raiz = claveVistaPrevia('articulo-1')
    await establecerPasoHecho(raiz, 'paso-a', true)
    await establecerPasoHecho({ raizId: raiz, vinculoId: 'guia-vinculada' }, 'paso-v1', true)
    await establecerPasoHecho('articulo-1', 'paso-a', true)

    await limpiarProgresoVistaPrevia()

    expect(await db.progresoPasos.get(raiz)).toBeUndefined()
    // El progreso de verdad sigue donde estaba.
    expect((await leerAvance('articulo-1'))?.pasosHechos).toEqual(['paso-a'])
  })

  it('barre las pruebas anteriores sin tocar la sesion en curso', async () => {
    const vieja = claveVistaPrevia('articulo-1')
    const actual = claveVistaPrevia('articulo-1')
    await establecerPasoHecho(vieja, 'paso-a', true)
    await establecerPasoHecho(actual, 'paso-a', true)

    await limpiarProgresoVistaPrevia(actual)

    expect(await db.progresoPasos.get(vieja)).toBeUndefined()
    expect((await leerAvance(actual))?.pasosHechos).toEqual(['paso-a'])
  })
})
