import { describe, expect, it } from 'vitest'
import type { Articulo, BloquePaso, DestinoPaso, OpcionDecision, PasoProcedimiento, Procedimiento, ProgresoPasos } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { accionDeGuia, lineaAvanceGuia } from './accionGuia'
import { guiaTerminada } from './cierrePaso'
import { articulosSinTerminar, pasoDeTotal } from './sinTerminar'

// EL AVANCE SE CUENTA SOBRE LA RUTA (tarea 302). Lo que dice "terminada",
// "Sin terminar" y "Vas en el paso N de M" fuera de la ejecución mira los
// pasos del camino elegido, nunca los de los caminos no elegidos: si no, una
// guía con decisiones no terminaría nunca (le faltarían los pasos del otro
// camino) y diría totales que no son los del recorrido.

function paso(id: string, bloques: BloquePaso[] = [], alTerminar?: DestinoPaso): PasoProcedimiento {
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

function opcion(id: string, pasoId: string): OpcionDecision {
  return { id, titulo: id, descripcion: '', destino: { tipo: 'paso', pasoId } }
}

// 1 decide (clásico -> 2, nuevo -> 3); 2 sigue en 4; 4 común.
function guia(verificacionFinal: string[] = []): Procedimiento {
  const decision: BloquePaso = {
    ...CAMPOS_BLOQUE_VACIOS,
    id: 'version',
    tipo: 'tarea',
    texto: '¿Qué versión?',
    tipoTarea: 'decision',
    opciones: [opcion('clasico', 'p2'), opcion('nuevo', 'p3')],
  }
  return {
    descripcion: '',
    portada: null,
    objetivoGeneral: '',
    requisitos: [],
    pasos: [paso('p1', [decision]), paso('p2', [], { tipo: 'paso', pasoId: 'p4' }), paso('p3'), paso('p4')],
    verificacionFinal,
    tiempoEstimadoMin: 30,
    dificultad: null,
  }
}

describe('guiaTerminada sobre la ruta', () => {
  it('termina con los pasos del camino elegido, sin los del otro', () => {
    expect(guiaTerminada(guia(), ['p1', 'p3', 'p4'], [], { version: 'nuevo' })).toBe(true)
    expect(guiaTerminada(guia(), ['p1', 'p2', 'p4'], [], { version: 'clasico' })).toBe(true)
  })

  it('no termina sin responder la decisión, aunque un dato viejo tenga todo marcado', () => {
    expect(guiaTerminada(guia(), ['p1', 'p2', 'p3', 'p4'], [])).toBe(false)
  })

  it('sigue pidiendo las comprobaciones finales', () => {
    expect(guiaTerminada(guia(['Todo bien']), ['p1', 'p3', 'p4'], [], { version: 'nuevo' })).toBe(false)
    expect(guiaTerminada(guia(['Todo bien']), ['p1', 'p3', 'p4'], [0], { version: 'nuevo' })).toBe(true)
  })
})

describe('articulosSinTerminar sobre la ruta', () => {
  const articulo = { id: 'a', titulo: 'Backup', tipo: 'mantenimiento', procedimiento: guia() } as unknown as Articulo
  const progreso = (pasosHechos: string[], elecciones?: Record<string, string>): ProgresoPasos => ({
    articuloId: 'a',
    pasosHechos,
    elecciones,
    actualizadoEn: '2026-10-06T10:00:00.000Z',
  })

  it('cuenta el total del camino elegido', () => {
    const [sinTerminar] = articulosSinTerminar([articulo], [progreso(['p1', 'p3'], { version: 'nuevo' })])
    expect(sinTerminar).toMatchObject({ hechos: 2, total: 3, rutaAbierta: false, minutosRestantes: 10 })
  })

  it('una guía con su camino terminado ya no está "sin terminar"', () => {
    expect(articulosSinTerminar([articulo], [progreso(['p1', 'p2', 'p4'], { version: 'clasico' })])).toEqual([])
  })

  it('con la ruta esperando una respuesta no afirma total ni tiempo', () => {
    const conPasoPrevio = {
      ...articulo,
      procedimiento: { ...guia(), pasos: [paso('p0'), ...guia().pasos] },
    } as unknown as Articulo
    const [sinTerminar] = articulosSinTerminar([conPasoPrevio], [progreso(['p0'])])
    expect(sinTerminar).toMatchObject({ hechos: 1, total: 2, rutaAbierta: true, minutosRestantes: null })
    expect(pasoDeTotal(sinTerminar.hechos + 1, sinTerminar.total, sinTerminar.rutaAbierta)).toBe('paso 2')
  })
})

describe('accionDeGuia sobre la ruta', () => {
  it('"Vas en el paso N de M" con los números del camino elegido', () => {
    const accion = accionDeGuia(guia(), { pasosHechos: ['p1', 'p3'], elecciones: { version: 'nuevo' } }, true)
    expect(accion).toMatchObject({ estado: 'continuar', pasosHechos: 2, total: 3, rutaAbierta: false })
    expect(accion.pendiente).toEqual({ tipo: 'paso', indice: 2, numero: 3 })
    expect(lineaAvanceGuia(accion)).toBe('Vas en el paso 3 de 3')
  })

  it('un camino terminado se ofrece para repetir', () => {
    expect(accionDeGuia(guia(), { pasosHechos: ['p1', 'p2', 'p4'], elecciones: { version: 'clasico' } }, true).estado).toBe(
      'repetir',
    )
  })

  it('con la decisión sin responder, el pendiente es el paso de la decisión y no se dice el total', () => {
    const conPasoPrevio: Procedimiento = { ...guia(), pasos: [paso('p0'), ...guia().pasos] }
    const accion = accionDeGuia(conPasoPrevio, { pasosHechos: ['p0', 'p1'] }, true)
    expect(accion.pendiente).toEqual({ tipo: 'paso', indice: 1, numero: 2 })
    expect(accion.rutaAbierta).toBe(true)
    expect(lineaAvanceGuia(accion)).toBe('Vas en el paso 2')
  })
})
