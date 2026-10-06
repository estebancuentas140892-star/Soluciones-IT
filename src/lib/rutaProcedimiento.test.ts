import { describe, expect, it } from 'vitest'
import type { BloquePaso, DestinoOpcion, DestinoPaso, OpcionDecision, PasoProcedimiento } from './db'
import { CAMPOS_BLOQUE_VACIOS } from './procedimiento'
import {
  aplicarEleccion,
  avanceDeLaRuta,
  caminoDeOpcion,
  decisionDeRuta,
  guiaDeLaRespuesta,
  guiasDeLasOpciones,
  guiasDePaso,
  hechosDeRuta,
  idsDeRuta,
  largoDeLaRuta,
  opcionElegida,
  pasosAlcanzables,
  problemasDeRutas,
  rutaDe,
} from './rutaProcedimiento'

// LA RUTA DE UNA GUÍA CON DECISIONES (tarea 302). Las guías de estas
// pruebas tienen la forma del caso real (la copia de seguridad de Outlook)
// con textos inventados: una decisión al principio, un camino por versión
// y los pasos comunes donde los dos se juntan.

function tarea(id: string, texto = `Tarea ${id}`): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto, tipoTarea: 'accion' }
}

function opcion(id: string, titulo: string, destino: DestinoOpcion = { tipo: 'continuar' }): OpcionDecision {
  return { id, titulo, descripcion: '', destino }
}

function decision(id: string, opciones: OpcionDecision[], texto = '¿Qué versión usas?'): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'tarea', texto, tipoTarea: 'decision', opciones }
}

// Una decisión de Sí/No de las de antes, con su guía para el "No".
function decisionSiNo(id: string, guiaId: string | null): BloquePaso {
  return {
    ...CAMPOS_BLOQUE_VACIOS,
    id,
    tipo: 'tarea',
    texto: '¿Funciona?',
    tipoTarea: 'decision',
    decisionArticuloId: guiaId,
    decisionArticuloTitulo: guiaId ? 'Guía del No' : '',
  }
}

function paso(id: string, bloques: BloquePaso[] = [tarea(`t-${id}`)], alTerminar?: DestinoPaso): PasoProcedimiento {
  return {
    id,
    titulo: `Paso ${id}`,
    objetivo: '',
    lugar: '',
    resultado: '',
    bloques,
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...(alTerminar ? { alTerminar } : {}),
  }
}

// 1 ¿Qué versión? (clásico -> 2, nuevo -> 3); 2 al terminar sigue en 4;
// 3 sigue en 4 por el orden; 4 y 5 son comunes.
function guiaOutlook(): { pasos: PasoProcedimiento[] } {
  return {
    pasos: [
      paso('identificar', [
        tarea('confirmar-correo'),
        decision('version', [
          opcion('clasico', 'Outlook clásico', { tipo: 'paso', pasoId: 'clasico' }),
          opcion('nuevo', 'Nuevo Outlook', { tipo: 'paso', pasoId: 'nuevo' }),
        ]),
      ]),
      paso('clasico', [tarea('exportar-clasico')], { tipo: 'paso', pasoId: 'guardar' }),
      paso('nuevo', [tarea('exportar-nuevo')]),
      paso('guardar'),
      paso('servidor'),
    ],
  }
}

const ids = (pasos: PasoProcedimiento[]) => pasos.map((p) => p.id)

describe('rutaDe', () => {
  it('sin decisiones con opciones, la ruta son todos los pasos en orden', () => {
    const guia = { pasos: [paso('a'), paso('b'), paso('c')] }
    const ruta = rutaDe(guia)
    expect(ids(ruta.pasos)).toEqual(['a', 'b', 'c'])
    expect(ruta.pendiente).toBeNull()
  })

  it('una guía sin pasos tiene una ruta vacía y terminada', () => {
    expect(rutaDe({ pasos: [] })).toEqual({ pasos: [], pendiente: null })
  })

  it('se detiene en una decisión sin responder: lo de después depende de la respuesta', () => {
    const ruta = rutaDe(guiaOutlook())
    expect(ids(ruta.pasos)).toEqual(['identificar'])
    expect(ruta.pendiente?.paso.id).toBe('identificar')
    expect(ruta.pendiente?.decision.id).toBe('version')
  })

  it('cada respuesta lleva por su camino y los dos se juntan en el paso común', () => {
    expect(ids(rutaDe(guiaOutlook(), { version: 'clasico' }).pasos)).toEqual([
      'identificar',
      'clasico',
      'guardar',
      'servidor',
    ])
    expect(ids(rutaDe(guiaOutlook(), { version: 'nuevo' }).pasos)).toEqual([
      'identificar',
      'nuevo',
      'guardar',
      'servidor',
    ])
  })

  it('una respuesta que ya no existe cuenta como sin responder', () => {
    const ruta = rutaDe(guiaOutlook(), { version: 'borrada' })
    expect(ids(ruta.pasos)).toEqual(['identificar'])
    expect(ruta.pendiente?.decision.id).toBe('version')
  })

  it('"continuar" sigue por el paso de abajo, o por donde diga el paso de la decisión', () => {
    const guia = {
      pasos: [
        paso('a', [decision('d', [opcion('si', 'Sí'), opcion('no', 'No', { tipo: 'paso', pasoId: 'c' })])]),
        paso('b'),
        paso('c'),
      ],
    }
    expect(ids(rutaDe(guia, { d: 'si' }).pasos)).toEqual(['a', 'b', 'c'])
    expect(ids(rutaDe(guia, { d: 'no' }).pasos)).toEqual(['a', 'c'])

    const conSalto = { pasos: [{ ...guia.pasos[0], alTerminar: { tipo: 'paso' as const, pasoId: 'c' } }, paso('b'), paso('c')] }
    expect(ids(rutaDe(conSalto, { d: 'si' }).pasos)).toEqual(['a', 'c'])
  })

  it('"guia" se hace en el flujo y sigue como "continuar"', () => {
    const guia = {
      pasos: [
        paso('a', [decision('d', [opcion('si', 'Sí'), opcion('no', 'No', { tipo: 'guia', articuloId: 'g', titulo: 'G' })])]),
        paso('b'),
      ],
    }
    expect(ids(rutaDe(guia, { d: 'no' }).pasos)).toEqual(['a', 'b'])
  })

  it('"fin" termina la ruta en el paso de la decisión, y un paso puede terminarla al acabar', () => {
    const guia = {
      pasos: [
        paso('a', [decision('d', [opcion('listo', 'Ya funciona', { tipo: 'fin' }), opcion('no', 'Sigue fallando')])]),
        paso('b', undefined, { tipo: 'fin' }),
        paso('c'),
      ],
    }
    const listo = rutaDe(guia, { d: 'listo' })
    expect(ids(listo.pasos)).toEqual(['a'])
    expect(listo.pendiente).toBeNull()
    expect(ids(rutaDe(guia, { d: 'no' }).pasos)).toEqual(['a', 'b'])
  })

  it('un salto hacia atrás, al mismo paso o a un paso que no existe se ignora: la ruta termina siempre', () => {
    const guia = {
      pasos: [
        paso('a'),
        paso('b', [decision('d', [opcion('atras', 'Atrás', { tipo: 'paso', pasoId: 'a' }), opcion('mismo', 'Mismo', { tipo: 'paso', pasoId: 'b' }), opcion('nada', 'Nada', { tipo: 'paso', pasoId: 'no-existe' })])], { tipo: 'paso', pasoId: 'a' }),
        paso('c'),
      ],
    }
    for (const elegida of ['atras', 'mismo', 'nada']) {
      expect(ids(rutaDe(guia, { d: elegida }).pasos)).toEqual(['a', 'b', 'c'])
    }
  })

  it('las decisiones de Sí/No de antes no cambian la ruta', () => {
    const guia = { pasos: [paso('a', [decisionSiNo('d', 'guia-no')]), paso('b')] }
    expect(ids(rutaDe(guia).pasos)).toEqual(['a', 'b'])
    expect(rutaDe(guia).pendiente).toBeNull()
  })

  it('idsDeRuta devuelve los ids de la ruta', () => {
    expect(idsDeRuta(guiaOutlook(), { version: 'nuevo' })).toEqual(['identificar', 'nuevo', 'guardar', 'servidor'])
  })
})

describe('decisionDeRuta y opcionElegida', () => {
  it('decide la última decisión con opciones del paso; las de Sí/No no deciden', () => {
    const primera = decision('d1', [opcion('a', 'A'), opcion('b', 'B')])
    const ultima = decision('d2', [opcion('c', 'C'), opcion('d', 'D')])
    expect(decisionDeRuta(paso('p', [primera, tarea('t'), ultima]))?.id).toBe('d2')
    expect(decisionDeRuta(paso('p', [decisionSiNo('sn', 'g')]))).toBeNull()
    expect(decisionDeRuta(paso('p'))).toBeNull()
  })

  it('la opción elegida se busca por su id', () => {
    const d = decision('d', [opcion('a', 'A'), opcion('b', 'B')])
    expect(opcionElegida(d, { d: 'b' })?.titulo).toBe('B')
    expect(opcionElegida(d, {})).toBeNull()
    expect(opcionElegida(d, undefined)).toBeNull()
  })
})

describe('caminoDeOpcion', () => {
  it('dice los pasos que se recorren después de la decisión con cada respuesta', () => {
    expect(ids(caminoDeOpcion(guiaOutlook(), 'identificar', 'version', 'clasico').pasos)).toEqual([
      'clasico',
      'guardar',
      'servidor',
    ])
    expect(ids(caminoDeOpcion(guiaOutlook(), 'identificar', 'version', 'nuevo').pasos)).toEqual([
      'nuevo',
      'guardar',
      'servidor',
    ])
  })

  it('se detiene en la siguiente decisión y no inventa su respuesta', () => {
    const guia = {
      pasos: [
        paso('a', [decision('d1', [opcion('x', 'X'), opcion('y', 'Y', { tipo: 'paso', pasoId: 'c' })])]),
        paso('b', [decision('d2', [opcion('m', 'M'), opcion('n', 'N')])]),
        paso('c'),
      ],
    }
    const camino = caminoDeOpcion(guia, 'a', 'd1', 'x')
    expect(ids(camino.pasos)).toEqual(['b'])
    expect(camino.pendiente?.decision.id).toBe('d2')
  })

  it('sin el paso de la decisión no hay camino', () => {
    expect(caminoDeOpcion(guiaOutlook(), 'no-existe', 'version', 'nuevo').pasos).toEqual([])
  })
})

describe('pasosAlcanzables', () => {
  it('incluye los pasos de todos los caminos posibles', () => {
    expect([...pasosAlcanzables(guiaOutlook())].sort()).toEqual(['clasico', 'guardar', 'identificar', 'nuevo', 'servidor'])
  })

  it('deja fuera el paso por el que no pasa ninguna ruta', () => {
    const guia = { pasos: [paso('a', undefined, { tipo: 'paso', pasoId: 'c' }), paso('b'), paso('c')] }
    expect(pasosAlcanzables(guia).has('b')).toBe(false)
  })
})

describe('problemasDeRutas', () => {
  const mensajes = (pasos: PasoProcedimiento[]) => problemasDeRutas({ pasos }).map((p) => p.mensaje)

  it('una guía bien hecha no tiene problemas', () => {
    expect(problemasDeRutas(guiaOutlook())).toEqual([])
  })

  it('las decisiones de Sí/No de antes no se revisan con las reglas nuevas', () => {
    expect(problemasDeRutas({ pasos: [paso('a', [tarea('t'), decisionSiNo('d', null)]), paso('b')] })).toEqual([])
  })

  it('no deja guardar una decisión sin pregunta, con una sola opción o con opciones sin título o repetidas', () => {
    expect(mensajes([paso('a', [decision('d', [opcion('x', 'X'), opcion('y', 'Y')], '  ')])])).toContain(
      'Escribe la pregunta de la decisión.',
    )
    expect(mensajes([paso('a', [decision('d', [opcion('x', 'X')])])])).toContain(
      'Una decisión necesita al menos dos opciones.',
    )
    expect(mensajes([paso('a', [decision('d', [opcion('x', 'X'), opcion('y', ' ')])])])).toContain(
      'La opción 2 necesita un título.',
    )
    expect(mensajes([paso('a', [decision('d', [opcion('x', 'Clásico'), opcion('y', 'clásico ')])])])).toContain(
      'Hay dos opciones que se llaman «clásico»: quien ejecuta no podría distinguirlas.',
    )
  })

  it('no deja guardar destinos que no llevan a ninguna parte o que vuelven atrás', () => {
    const conDestino = (destino: DestinoOpcion) => [
      paso('a'),
      paso('b', [decision('d', [opcion('x', 'X', destino), opcion('y', 'Y')])]),
      paso('c'),
    ]
    expect(mensajes(conDestino({ tipo: 'paso', pasoId: '' }))).toContain('«X»: elige a qué paso lleva.')
    expect(mensajes(conDestino({ tipo: 'paso', pasoId: 'zz' }))).toContain(
      '«X» lleva a un paso que ya no existe. Elige otro.',
    )
    expect(mensajes(conDestino({ tipo: 'paso', pasoId: 'a' }))).toContain(
      '«X» solo puede llevar a un paso posterior: volver a uno anterior repetiría el recorrido sin fin.',
    )
    expect(mensajes(conDestino({ tipo: 'paso', pasoId: 'b' }))).toContain(
      '«X» solo puede llevar a un paso posterior: volver a uno anterior repetiría el recorrido sin fin.',
    )
    expect(mensajes(conDestino({ tipo: 'guia', articuloId: '', titulo: '' }))).toContain('«X»: elige qué guía abre.')
  })

  it('no deja llevar a un paso vacío, que se descartaría al guardar', () => {
    const vacio = { ...paso('c', []), titulo: '' }
    expect(
      mensajes([paso('a', [decision('d', [opcion('x', 'X', { tipo: 'paso', pasoId: 'c' }), opcion('y', 'Y')])]), paso('b'), vacio]),
    ).toContain('«X» lleva al paso 3, que está vacío. Escríbelo o elige otro.')
  })

  it('la decisión tiene que ser la última acción de su paso', () => {
    expect(mensajes([paso('a', [decision('d', [opcion('x', 'X'), opcion('y', 'Y')]), tarea('despues')])])).toContain(
      'La decisión tiene que ser la última acción del paso: lo que viene después depende de la respuesta. Muévela al final o lleva esas acciones al paso siguiente.',
    )
  })

  it('revisa también dónde sigue un paso al terminar', () => {
    expect(mensajes([paso('a'), paso('b', undefined, { tipo: 'paso', pasoId: 'a' })])).toContain(
      'Al terminar el paso 2 solo puede llevar a un paso posterior: volver a uno anterior repetiría el recorrido sin fin.',
    )
  })

  it('avisa, sin bloquear, de un paso por el que no pasa ninguna ruta', () => {
    const problemas = problemasDeRutas({ pasos: [paso('a', undefined, { tipo: 'paso', pasoId: 'c' }), paso('b'), paso('c')] })
    expect(problemas).toEqual([
      expect.objectContaining({ pasoId: 'b', bloquea: false }),
    ])
  })

  it('cada problema dice de qué paso, decisión y opción es', () => {
    const [problema] = problemasDeRutas({
      pasos: [paso('a', [decision('d', [opcion('x', 'X', { tipo: 'paso', pasoId: '' }), opcion('y', 'Y')])])],
    })
    expect(problema).toMatchObject({ pasoId: 'a', decisionId: 'd', opcionId: 'x', bloquea: true })
  })
})

describe('hechosDeRuta y avanceDeLaRuta', () => {
  it('el paso de una decisión sin responder nunca cuenta como hecho', () => {
    const ruta = rutaDe(guiaOutlook())
    expect(hechosDeRuta(ruta, ['identificar']).has('identificar')).toBe(false)
  })

  it('cuenta solo los pasos de la ruta elegida', () => {
    const avance = avanceDeLaRuta(guiaOutlook(), {
      pasosHechos: ['identificar', 'clasico', 'nuevo'],
      elecciones: { version: 'nuevo' },
    })
    expect(avance).toMatchObject({ hechos: 2, total: 4, pasosListos: false })
  })

  it('está lista cuando todos los pasos de la ruta están hechos', () => {
    expect(
      avanceDeLaRuta(guiaOutlook(), {
        pasosHechos: ['identificar', 'nuevo', 'guardar', 'servidor'],
        elecciones: { version: 'nuevo' },
      }).pasosListos,
    ).toBe(true)
  })

  it('con la ruta abierta nunca está lista', () => {
    expect(avanceDeLaRuta(guiaOutlook(), { pasosHechos: ['identificar'] }).pasosListos).toBe(false)
  })

  it('sin responder, el total se sabe si todos los caminos miden lo mismo', () => {
    // Clásico: identificar, clasico, guardar, servidor. Nuevo: identificar, nuevo, guardar, servidor.
    expect(avanceDeLaRuta(guiaOutlook(), { pasosHechos: [] })).toMatchObject({ hechos: 0, total: 4, totalAbierto: false })
  })

  it('sin responder y con caminos de distinto largo, el total queda abierto', () => {
    const guia = {
      pasos: [
        paso('a', [decision('d', [opcion('corto', 'Corto', { tipo: 'paso', pasoId: 'c' }), opcion('largo', 'Largo')])]),
        paso('b'),
        paso('c'),
      ],
    }
    expect(avanceDeLaRuta(guia, { pasosHechos: [] })).toMatchObject({ total: 1, totalAbierto: true })
    expect(avanceDeLaRuta(guia, { elecciones: { d: 'largo' } })).toMatchObject({ total: 3, totalAbierto: false })
  })
})

describe('largoDeLaRuta', () => {
  it('sin decisiones, son todos los pasos', () => {
    expect(largoDeLaRuta({ pasos: [paso('a'), paso('b'), paso('c')] })).toEqual({ minimo: 3, maximo: 3 })
    expect(largoDeLaRuta({ pasos: [] })).toEqual({ minimo: 0, maximo: 0 })
  })

  it('con los dos caminos de Outlook, cuatro pasos se elija lo que se elija', () => {
    expect(largoDeLaRuta(guiaOutlook())).toEqual({ minimo: 4, maximo: 4 })
    expect(largoDeLaRuta(guiaOutlook(), { version: 'clasico' })).toEqual({ minimo: 4, maximo: 4 })
  })

  it('da el camino más corto y el más largo, y una respuesta dada cierra el suyo', () => {
    const guia = {
      pasos: [
        paso('a', [
          decision('d', [
            opcion('fin', 'Nada más', { tipo: 'fin' }),
            opcion('salto', 'Saltar', { tipo: 'paso', pasoId: 'c' }),
            opcion('todo', 'Todo'),
          ]),
        ]),
        paso('b'),
        paso('c'),
      ],
    }
    expect(largoDeLaRuta(guia)).toEqual({ minimo: 1, maximo: 3 })
    expect(largoDeLaRuta(guia, { d: 'salto' })).toEqual({ minimo: 2, maximo: 2 })
  })

  it('mira también las decisiones anidadas dentro de un camino', () => {
    const guia = {
      pasos: [
        paso('a', [decision('d1', [opcion('x', 'X', { tipo: 'paso', pasoId: 'c' }), opcion('y', 'Y')])]),
        paso('b', [decision('d2', [opcion('fin', 'Fin', { tipo: 'fin' }), opcion('sigue', 'Sigue')])]),
        paso('c'),
      ],
    }
    // a, c | a, b | a, b, c
    expect(largoDeLaRuta(guia)).toEqual({ minimo: 2, maximo: 3 })
    expect(largoDeLaRuta(guia, { d1: 'y', d2: 'fin' })).toEqual({ minimo: 2, maximo: 2 })
  })

  it('una respuesta que ya no existe vuelve a abrir la decisión', () => {
    expect(largoDeLaRuta(guiaOutlook(), { version: 'borrada' })).toEqual({ minimo: 4, maximo: 4 })
  })
})

describe('guiaDeLaRespuesta y guiasDeLasOpciones', () => {
  const conGuia = paso('a', [
    tarea('t'),
    decision('d', [opcion('x', 'X', { tipo: 'guia', articuloId: 'g-x', titulo: 'Guía X' }), opcion('y', 'Y')]),
  ])

  it('la guía que abre la respuesta elegida, o null', () => {
    expect(guiaDeLaRespuesta(conGuia, { d: 'x' })).toEqual({ articuloId: 'g-x', titulo: 'Guía X' })
    expect(guiaDeLaRespuesta(conGuia, { d: 'y' })).toBeNull()
    expect(guiaDeLaRespuesta(conGuia, undefined)).toBeNull()
    expect(guiaDeLaRespuesta(paso('b'), { d: 'x' })).toBeNull()
  })

  it('las guías que puede abrir alguna respuesta del paso', () => {
    expect(guiasDeLasOpciones(conGuia)).toEqual(['g-x'])
    expect(guiasDeLasOpciones(paso('b', [decisionSiNo('sn', 'g-no')]))).toEqual([])
  })
})

describe('aplicarEleccion', () => {
  it('responder marca la decisión y anota la opción, sin tocar nada más', () => {
    const aplicada = aplicarEleccion(guiaOutlook(), { pasosHechos: [], instruccionesHechas: ['confirmar-correo'] }, {
      decisionId: 'version',
      opcionId: 'clasico',
    })
    expect(aplicada.cambio).toBe(false)
    expect(aplicada.avance).toEqual({
      pasosHechos: [],
      instruccionesHechas: ['confirmar-correo', 'version'],
      pasosSaltados: [],
      elecciones: { version: 'clasico' },
    })
    expect(aplicada.guiasFuera).toEqual([])
  })

  it('volver a elegir la misma opción no reinicia nada', () => {
    const avance = {
      pasosHechos: ['identificar', 'clasico'],
      instruccionesHechas: ['confirmar-correo', 'version', 'exportar-clasico'],
      elecciones: { version: 'clasico' },
    }
    const aplicada = aplicarEleccion(guiaOutlook(), avance, { decisionId: 'version', opcionId: 'clasico' })
    expect(aplicada.cambio).toBe(false)
    expect(aplicada.avance.pasosHechos).toEqual(['identificar', 'clasico'])
  })

  it('cambiar la respuesta reinicia todo lo de después y conserva lo de antes', () => {
    const avance = {
      pasosHechos: ['identificar', 'clasico', 'guardar'],
      instruccionesHechas: ['confirmar-correo', 'version', 'exportar-clasico', 't-guardar'],
      pasosSaltados: ['servidor'],
      elecciones: { version: 'clasico' },
    }
    const aplicada = aplicarEleccion(guiaOutlook(), avance, { decisionId: 'version', opcionId: 'nuevo' })
    expect(aplicada.cambio).toBe(true)
    expect(aplicada.avance).toEqual({
      pasosHechos: ['identificar'],
      instruccionesHechas: ['confirmar-correo', 'version'],
      pasosSaltados: [],
      elecciones: { version: 'nuevo' },
    })
    // Sin pasos "fantasma": la ruta nueva no tiene nada hecho después de la decisión.
    expect(avanceDeLaRuta(guiaOutlook(), aplicada.avance)).toMatchObject({ hechos: 1, total: 4 })
  })

  it('al cambiar, borra las respuestas de las decisiones de más adelante', () => {
    const guia = {
      pasos: [
        paso('a', [decision('d1', [opcion('x', 'X'), opcion('y', 'Y', { tipo: 'paso', pasoId: 'c' })])]),
        paso('b', [decision('d2', [opcion('m', 'M'), opcion('n', 'N')])]),
        paso('c'),
      ],
    }
    const aplicada = aplicarEleccion(
      guia,
      { pasosHechos: ['a', 'b'], instruccionesHechas: ['d1', 'd2'], elecciones: { d1: 'x', d2: 'm' } },
      { decisionId: 'd1', opcionId: 'y' },
    )
    expect(aplicada.avance.elecciones).toEqual({ d1: 'y' })
    expect(aplicada.avance.instruccionesHechas).toEqual(['d1'])
  })

  it('al cambiar, devuelve las guías que solo se usaban en lo que se reinicia y las de las dos respuestas', () => {
    const guia = {
      pasos: [
        { ...paso('a', [decision('d', [opcion('x', 'X', { tipo: 'guia', articuloId: 'g-x', titulo: 'GX' }), opcion('y', 'Y', { tipo: 'paso', pasoId: 'c' })])]), subArticuloId: 'g-antes' },
        { ...paso('b'), subArticuloId: 'g-rama' },
        { ...paso('c'), subArticuloId: 'g-antes' },
      ],
    }
    const aplicada = aplicarEleccion(guia, { pasosHechos: ['a', 'b'], elecciones: { d: 'x' } }, { decisionId: 'd', opcionId: 'y' })
    // g-antes la usa también el paso de la decisión, que se conserva.
    expect(aplicada.guiasFuera.sort()).toEqual(['g-rama', 'g-x'])
  })
})

// LA FORMA DE LA GUÍA REAL (tarea 302, fase 4), con textos inventados: el
// contenido real vive solo en Supabase. Seis pasos: la pregunta al final del
// primero (tras confirmar el buzón), un paso por versión (el clásico sigue
// en el común con "al terminar"; el nuevo, por el orden) y tres comunes.
describe('la forma de la copia de seguridad de Outlook', () => {
  function copiaReal(): { pasos: PasoProcedimiento[] } {
    return {
      pasos: [
        paso('identificar', [
          tarea('confirmar-correo'),
          decision('version', [
            opcion('clasico', 'Outlook clásico', { tipo: 'paso', pasoId: 'exportar-clasico' }),
            opcion('nuevo', 'Nuevo Outlook', { tipo: 'paso', pasoId: 'exportar-nuevo' }),
          ]),
        ]),
        paso(
          'exportar-clasico',
          [tarea('comprobar-descarga'), tarea('iniciar-clasico'), tarea('cuenta-raiz')],
          { tipo: 'paso', pasoId: 'guardar' },
        ),
        paso('exportar-nuevo', [tarea('iniciar-nuevo'), tarea('buzon-completo')]),
        paso('guardar'),
        paso('conectar'),
        paso('copiar'),
      ],
    }
  }

  it('los dos caminos tienen cinco pasos y se juntan en los tres comunes, sin duplicarlos', () => {
    expect(largoDeLaRuta(copiaReal())).toEqual({ minimo: 5, maximo: 5 })
    expect(idsDeRuta(copiaReal(), { version: 'clasico' })).toEqual([
      'identificar',
      'exportar-clasico',
      'guardar',
      'conectar',
      'copiar',
    ])
    expect(idsDeRuta(copiaReal(), { version: 'nuevo' })).toEqual([
      'identificar',
      'exportar-nuevo',
      'guardar',
      'conectar',
      'copiar',
    ])
  })

  it('el editor la deja guardar y todos sus pasos tienen camino', () => {
    expect(problemasDeRutas(copiaReal())).toEqual([])
    expect(pasosAlcanzables(copiaReal()).size).toBe(6)
  })
})

describe('guiasDePaso', () => {
  it('reúne las guías del paso, de sus tareas, de su contingencia y de sus decisiones', () => {
    const p = {
      ...paso('a', [
        { ...tarea('t'), tipo: 'guia' as const, guiaArticuloId: 'g-tarea' },
        decisionSiNo('sn', 'g-no'),
        decision('d', [opcion('x', 'X', { tipo: 'guia', articuloId: 'g-opcion', titulo: '' }), opcion('y', 'Y')]),
      ]),
      subArticuloId: 'g-paso',
      solucionArticuloId: 'g-contingencia',
    }
    expect(guiasDePaso(p).sort()).toEqual(['g-contingencia', 'g-no', 'g-opcion', 'g-paso', 'g-tarea'])
    expect(guiasDePaso(p, false).sort()).toEqual(['g-contingencia', 'g-no', 'g-paso', 'g-tarea'])
  })
})
