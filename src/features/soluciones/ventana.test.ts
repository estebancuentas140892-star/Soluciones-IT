import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import {
  criticasDeLaVentana,
  criticasPendientes,
  disposicionDeRespuestas,
  esDecisionFinal,
  esDecisionSiNo,
  motivoDeLasRespuestas,
  motivoGuiasDeLaVentana,
  numerarInstrucciones,
  pieDeLaVentana,
  preguntaDelPie,
  siNoDelPie,
  siNoPendientes,
  textoMasAbajo,
  tituloAbreviadoDeLaGuia,
  type DatosPieDeLaVentana,
} from './ventana'

// LA LÓGICA PURA DE LA VENTANA (tarea 348). Todo lo sembrado es inventado.

function bloque(parcial: Partial<BloquePaso> & { id: string }): BloquePaso {
  return {
    tipo: 'tarea',
    texto: parcial.id,
    tono: null,
    adjunto: null,
    tipoTarea: 'accion',
    decisionArticuloId: null,
    decisionArticuloTitulo: '',
    vinculoProtegido: null,
    alcance: null,
    tareaId: null,
    guiaArticuloId: null,
    guiaArticuloTitulo: '',
    intencionGuia: null,
    referenciaId: null,
    referenciaTitulo: '',
    referenciaTipo: null,
    ...parcial,
  } as BloquePaso
}

function paso(bloques: BloquePaso[]): PasoProcedimiento {
  return {
    id: 'p1',
    titulo: 'Ventana de prueba',
    bloques,
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

const opcion = (id: string, titulo: string) => ({ id, titulo, descripcion: '', destino: { tipo: 'continuar' as const } })

describe('las advertencias críticas de una ventana', () => {
  const p = paso([
    bloque({ id: 'a1', tipo: 'aviso', tono: 'precaucion' }),
    bloque({ id: 'a2', tipo: 'aviso', tono: 'importante' }),
    bloque({ id: 'a3', tipo: 'aviso', tono: 'dato' }),
    bloque({ id: 'a4', tipo: 'aviso', tono: 'info' }),
    bloque({ id: 'a5', tipo: 'aviso', tono: 'importante' }),
    bloque({ id: 't1' }),
  ])

  it('solo el tono Importante es crítico: precaución, dato e información no piden confirmar', () => {
    expect(criticasDeLaVentana(p).map((b) => b.id)).toEqual(['a2', 'a5'])
  })

  it('quedan pendientes las que no se confirmaron, en el orden del autor', () => {
    expect(criticasPendientes(p, new Set()).map((b) => b.id)).toEqual(['a2', 'a5'])
    expect(criticasPendientes(p, new Set(['a2'])).map((b) => b.id)).toEqual(['a5'])
    expect(criticasPendientes(p, new Set(['a2', 'a5']))).toEqual([])
  })

  it('una ventana sin críticas no tiene nada que confirmar', () => {
    expect(criticasPendientes(paso([bloque({ id: 't1' })]), new Set())).toEqual([])
  })
})

describe('la numeración de las instrucciones', () => {
  it('numera solo las acciones, de 1 en adelante, sin contar comprobaciones ni preguntas', () => {
    const p = paso([
      bloque({ id: 't1' }),
      bloque({ id: 'av', tipo: 'aviso', tono: 'precaucion' }),
      bloque({ id: 't2' }),
      bloque({ id: 'v1', tipoTarea: 'verificacion' }),
      bloque({ id: 't3' }),
      bloque({ id: 'd1', tipoTarea: 'decision' }),
    ])
    expect([...numerarInstrucciones(p)]).toEqual([
      ['t1', 1],
      ['t2', 2],
      ['t3', 3],
    ])
  })

  it('una tarea sin clasificar es una acción', () => {
    const p = paso([bloque({ id: 't1', tipoTarea: null })])
    expect(numerarInstrucciones(p).get('t1')).toBe(1)
  })

  it('un paso sin tareas no numera nada', () => {
    expect(numerarInstrucciones(paso([bloque({ id: 'av', tipo: 'aviso', tono: 'dato' })])).size).toBe(0)
  })
})

describe('la decisión simple como última acción', () => {
  it('responderla avanza solo si después no queda otra tarea', () => {
    const final = paso([bloque({ id: 't1' }), bloque({ id: 'd1', tipoTarea: 'decision' })])
    expect(esDecisionFinal(final, 'd1')).toBe(true)
    const conCola = paso([bloque({ id: 'd1', tipoTarea: 'decision' }), bloque({ id: 't2' })])
    expect(esDecisionFinal(conCola, 'd1')).toBe(false)
  })

  it('los avisos y los apoyos de después no cuentan como tareas', () => {
    const p = paso([
      bloque({ id: 'd1', tipoTarea: 'decision' }),
      bloque({ id: 'av', tipo: 'aviso', tono: 'precaucion' }),
    ])
    expect(esDecisionFinal(p, 'd1')).toBe(true)
  })
})

describe('la pregunta fija al pie', () => {
  const conOpciones = (n: number) =>
    paso([
      bloque({ id: 't1' }),
      bloque({
        id: 'd1',
        tipoTarea: 'decision',
        opciones: Array.from({ length: n }, (_, i) => opcion(`o${i}`, `Opción ${i}`)),
      }),
    ])

  it('con dos o tres respuestas va al pie', () => {
    expect(preguntaDelPie(conOpciones(2))?.id).toBe('d1')
    expect(preguntaDelPie(conOpciones(3))?.id).toBe('d1')
  })

  it('con cuatro o más se queda en la ventana', () => {
    expect(preguntaDelPie(conOpciones(4))).toBeNull()
  })

  it('una decisión de Sí/No no es una decisión con opciones: no va al pie', () => {
    expect(preguntaDelPie(paso([bloque({ id: 'd1', tipoTarea: 'decision' })]))).toBeNull()
  })

  it('sin decisión no hay pregunta', () => {
    expect(preguntaDelPie(paso([bloque({ id: 't1' })]))).toBeNull()
  })
})

describe('la disposición de las respuestas', () => {
  it('rótulos cortos van en fila y largos apilados', () => {
    expect(disposicionDeRespuestas([opcion('a', 'Sí'), opcion('b', 'No')])).toBe('fila')
    expect(disposicionDeRespuestas([opcion('a', 'Outlook clásico'), opcion('b', 'Nuevo')])).toBe('apilada')
  })
})

describe('el botón principal del pie y su explicación', () => {
  const base: DatosPieDeLaVentana = {
    hecha: false,
    numeroDelTrabajo: null,
    destino: 'siguiente',
    numeroSiguiente: null,
    criticaPendiente: null,
    guiaPendiente: null,
    preguntaPendiente: false,
    preguntaEnElPie: false,
  }
  const critica = bloque({ id: 'c1', tipo: 'aviso', tono: 'importante' })

  it('una ventana libre dice "Listo" y a dónde lleva', () => {
    expect(pieDeLaVentana(base)).toMatchObject({
      accion: 'listo',
      etiqueta: 'Listo · Siguiente ventana',
      motivo: null,
    })
    expect(pieDeLaVentana({ ...base, destino: 'fin' }).etiqueta).toBe('Listo · Terminar guía')
    expect(pieDeLaVentana({ ...base, destino: 'comprobar' }).etiqueta).toBe('Listo · Comprobar el resultado')
  })

  it('una crítica sin confirmar no deja cerrar, y lo explica con palabras', () => {
    const pie = pieDeLaVentana({ ...base, criticaPendiente: critica })
    expect(pie.accion).toBe('no-disponible')
    expect(pie.etiqueta).toBe('Falta confirmar la advertencia')
    expect(pie.motivo).toContain('Confirma la advertencia crítica')
  })

  it('una guía necesaria pendiente manda sobre la crítica y trae su propio motivo', () => {
    const pie = pieDeLaVentana({
      ...base,
      criticaPendiente: critica,
      guiaPendiente: 'Completa «Abrir el gestor» para marcar esta tarea',
    })
    expect(pie.accion).toBe('no-disponible')
    expect(pie.motivo).toBe('Completa «Abrir el gestor» para marcar esta tarea')
  })

  it('una pregunta sin responder, dentro de la ventana, bloquea y dice qué hacer', () => {
    const pie = pieDeLaVentana({ ...base, preguntaPendiente: true })
    expect(pie.accion).toBe('no-disponible')
    expect(pie.motivo).toContain('Responde la pregunta')
  })

  it('con la pregunta fija al pie, el botón principal no la reclama (las respuestas son el avance)', () => {
    expect(pieDeLaVentana({ ...base, preguntaPendiente: true, preguntaEnElPie: true }).accion).toBe('listo')
  })

  it('una ventana ya hecha solo navega, sin cerrar nada', () => {
    expect(pieDeLaVentana({ ...base, hecha: true, numeroSiguiente: 3 })).toMatchObject({
      accion: 'seguir',
      etiqueta: 'Seguir en la ventana 3',
      motivo: null,
    })
    expect(pieDeLaVentana({ ...base, hecha: true }).etiqueta).toBe('Seguir')
  })

  it('una ventana de más adelante, abierta para consultarla, devuelve al trabajo y no se cierra', () => {
    const pie = pieDeLaVentana({ ...base, numeroDelTrabajo: 2, criticaPendiente: critica, preguntaPendiente: true })
    expect(pie).toMatchObject({ accion: 'volver', etiqueta: 'Volver a la ventana 2', motivo: null })
  })

  it('una ventana ya hecha manda sobre la consulta', () => {
    expect(pieDeLaVentana({ ...base, hecha: true, numeroDelTrabajo: 2 }).accion).toBe('seguir')
  })

  it('un botón no disponible siempre trae su motivo', () => {
    const casos: DatosPieDeLaVentana[] = [
      { ...base, criticaPendiente: critica },
      { ...base, guiaPendiente: 'Falta algo' },
      { ...base, preguntaPendiente: true },
    ]
    for (const caso of casos) {
      const pie = pieDeLaVentana(caso)
      expect(pie.accion).toBe('no-disponible')
      expect(pie.motivo).toBeTruthy()
    }
  })
})

describe('la frase de las respuestas bloqueadas', () => {
  it('dice qué falta, con la guía por delante de la crítica', () => {
    const critica = bloque({ id: 'c1', tipo: 'aviso', tono: 'importante' })
    expect(motivoDeLasRespuestas({ criticaPendiente: critica, guiaPendiente: null })).toBe(
      'Primero confirma la advertencia de arriba.',
    )
    expect(motivoDeLasRespuestas({ criticaPendiente: critica, guiaPendiente: 'Falta la guía' })).toBe('Falta la guía')
    expect(motivoDeLasRespuestas({ criticaPendiente: null, guiaPendiente: null })).toBeNull()
  })
})

describe('el indicador «Más abajo»', () => {
  it('sin nada fuera de vista no hay indicador', () => {
    expect(textoMasAbajo([])).toBeNull()
  })

  it('una crítica fuera de vista manda y se pinta como crítica', () => {
    expect(
      textoMasAbajo([{ parte: 'instruccion', numero: 3 }, { parte: 'critica' }, { parte: 'comprobacion' }]),
    ).toEqual({ texto: 'Más abajo: advertencia crítica', critico: true })
  })

  it('las instrucciones se resumen en un rango y se suma la comprobación', () => {
    expect(
      textoMasAbajo([
        { parte: 'instruccion', numero: 6 },
        { parte: 'instruccion', numero: 5 },
        { parte: 'comprobacion' },
      ]),
    ).toEqual({ texto: 'Más abajo: acciones 5 a 6 y comprobación', critico: false })
    expect(textoMasAbajo([{ parte: 'instruccion', numero: 4 }])?.texto).toBe('Más abajo: acción 4')
    expect(textoMasAbajo([{ parte: 'comprobacion' }])?.texto).toBe('Más abajo: comprobación')
    expect(textoMasAbajo([{ parte: 'pregunta' }])?.texto).toBe('Más abajo: pregunta')
  })

  it('una precaución sola también se anuncia, pero sin pintarse como crítica', () => {
    expect(textoMasAbajo([{ parte: 'precaucion' }])).toEqual({ texto: 'Más abajo: precaución', critico: false })
  })
})

describe('el nombre de la guía en la cabecera', () => {
  it('se abrevia por palabras cuando no cabe y queda entero cuando cabe', () => {
    expect(tituloAbreviadoDeLaGuia('Conectar un recurso compartido')).toBe('Conectar un recurso compartido')
    const largo = tituloAbreviadoDeLaGuia('Restablecer el perfil del navegador cuando el POS arranca mal')
    expect(largo.endsWith('…')).toBe(true)
    expect(largo.length).toBeLessThanOrEqual(35)
  })
})

describe('las preguntas de Sí/No de una ventana', () => {
  const siNo = (id: string, extra: Partial<BloquePaso> = {}) => bloque({ id, tipoTarea: 'decision', ...extra })

  it('reconoce la de Sí/No y no la que tiene opciones', () => {
    expect(esDecisionSiNo(siNo('d1'))).toBe(true)
    expect(esDecisionSiNo(siNo('d2', { opciones: [opcion('o1', 'Uno')] }))).toBe(false)
    expect(esDecisionSiNo(bloque({ id: 'a1' }))).toBe(false)
    expect(esDecisionSiNo(bloque({ id: 'av', tipo: 'aviso', tono: 'importante' }))).toBe(false)
  })

  it('las pendientes son las que no están en lo hecho', () => {
    const p = paso([bloque({ id: 'a1' }), siNo('d1'), bloque({ id: 'a2' }), siNo('d2')])
    expect(siNoPendientes(p, new Set()).map((t) => t.id)).toEqual(['d1', 'd2'])
    expect(siNoPendientes(p, new Set(['d1'])).map((t) => t.id)).toEqual(['d2'])
    expect(siNoPendientes(p, new Set(['d1', 'd2']))).toEqual([])
  })

  it('una ventana sin preguntas no tiene pendientes', () => {
    expect(siNoPendientes(paso([bloque({ id: 'a1' })]), new Set())).toEqual([])
  })

  it('va fija al pie solo si cierra la ventana y su No no abre otra guía', () => {
    expect(siNoDelPie(paso([bloque({ id: 'a1' }), siNo('d1')]))?.id).toBe('d1')
    // Con camino propio para el "No", la guía necesita desplegarse dentro.
    expect(siNoDelPie(paso([bloque({ id: 'a1' }), siNo('d1', { decisionArticuloId: 'g1' })]))).toBeNull()
    // Si no es lo último, se queda dentro de la ventana.
    expect(siNoDelPie(paso([siNo('d1'), bloque({ id: 'a1' })]))).toBeNull()
    // Una ventana sin tareas no tiene pregunta.
    expect(siNoDelPie(paso([]))).toBeNull()
  })
})

describe('lo que falta de una guía necesaria, para la ventana', () => {
  it('sin guías pendientes no dice nada', () => {
    expect(motivoGuiasDeLaVentana([])).toBeNull()
  })

  it('con una la nombra, y sin nombre no inventa uno', () => {
    expect(motivoGuiasDeLaVentana(['Reiniciar el spooler'])).toBe(
      'Completa «Reiniciar el spooler» para poder cerrar la ventana.',
    )
    expect(motivoGuiasDeLaVentana(['  '])).toBe('Completa lo que falta para poder cerrar la ventana.')
  })

  it('con varias nombra la primera y cuenta las que quedan', () => {
    expect(motivoGuiasDeLaVentana(['A', 'B'])).toBe('Completa «A» y 1 guía más para poder cerrar la ventana.')
    expect(motivoGuiasDeLaVentana(['A', 'B', 'C'])).toBe('Completa «A» y 2 guías más para poder cerrar la ventana.')
  })
})
