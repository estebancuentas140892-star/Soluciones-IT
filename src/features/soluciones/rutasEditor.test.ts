import { describe, expect, it } from 'vitest'
import type { BloquePaso, DestinoPaso, OpcionDecision, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  etiquetaAlTerminar,
  etiquetaDestinoOpcion,
  guiaConCaminos,
  nombreDePaso,
  pasosPosteriores,
  siguientePorDefecto,
  textoCamino,
  usaAlTerminar,
} from './rutasEditor'

// LO QUE EL EDITOR DICE DE LOS CAMINOS (tarea 302): a dónde lleva cada
// respuesta y por dónde sigue cada paso, con los números que ve el autor.

function paso(id: string, titulo: string, bloques: BloquePaso[] = [], alTerminar?: DestinoPaso): PasoProcedimiento {
  return {
    id,
    titulo,
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

const decision: BloquePaso = {
  ...CAMPOS_BLOQUE_VACIOS,
  id: 'version',
  tipo: 'tarea',
  texto: '¿Qué versión de Outlook estás utilizando?',
  tipoTarea: 'decision',
  opciones: [
    { id: 'clasico', titulo: 'Outlook clásico', descripcion: '', destino: { tipo: 'paso', pasoId: 'p2' } },
    { id: 'nuevo', titulo: 'Nuevo Outlook', descripcion: '', destino: { tipo: 'paso', pasoId: 'p3' } },
    { id: 'guia', titulo: 'Con otra guía', descripcion: '', destino: { tipo: 'guia', articuloId: 'g', titulo: 'Exportar PST' } },
    { id: 'fin', titulo: 'No hace falta', descripcion: '', destino: { tipo: 'fin' } },
  ] satisfies OpcionDecision[],
}

const pasos = [
  paso('p1', 'Identificar la versión', [decision]),
  paso('p2', 'Exportar en Outlook clásico', [], { tipo: 'paso', pasoId: 'p4' }),
  paso('p3', 'Exportar en Nuevo Outlook'),
  paso('p4', 'Guardar y comprobar el archivo'),
]

describe('guiaConCaminos', () => {
  it('solo la guía con decisiones con opciones o con saltos enseña "Al terminar"', () => {
    expect(guiaConCaminos(pasos)).toBe(true)
    expect(guiaConCaminos([paso('a', 'A'), paso('b', 'B')])).toBe(false)
    expect(guiaConCaminos([paso('a', 'A', [], { tipo: 'fin' })])).toBe(true)
  })
})

describe('usaAlTerminar', () => {
  it('no cuenta en el paso de una decisión cuyas respuestas llevan todas a otro sitio', () => {
    const soloSaltos: BloquePaso = { ...decision, opciones: [decision.opciones![0], decision.opciones![3]] }
    expect(usaAlTerminar(paso('p1', 'Uno', [soloSaltos]))).toBe(false)
    // Con una que continúa o abre una guía, sí: esas siguen la continuación del paso.
    expect(usaAlTerminar(pasos[0])).toBe(true)
    expect(usaAlTerminar(paso('p1', 'Uno', [{ ...decision, opciones: [decision.opciones![0], { ...decision.opciones![1], destino: { tipo: 'continuar' } }] }]))).toBe(true)
    expect(usaAlTerminar(pasos[1])).toBe(true)
  })
})

describe('nombres y listas de pasos', () => {
  it('nombra un paso por su número y su título', () => {
    expect(nombreDePaso(pasos, 'p4')).toBe('Paso 4 · Guardar y comprobar el archivo')
    expect(nombreDePaso([paso('x', '  ')], 'x')).toBe('Paso 1')
    expect(nombreDePaso(pasos, 'no')).toBeNull()
  })

  it('ofrece solo los pasos posteriores', () => {
    expect(pasosPosteriores(pasos, 1).map((p) => [p.numero, p.titulo])).toEqual([
      [3, 'Exportar en Nuevo Outlook'],
      [4, 'Guardar y comprobar el archivo'],
    ])
    expect(pasosPosteriores(pasos, 3)).toEqual([])
  })

  it('dice por dónde sigue un paso cuando nada lo desvía', () => {
    expect(siguientePorDefecto(pasos, 0)).toBe('sigue en el paso 2 · Exportar en Outlook clásico')
    expect(siguientePorDefecto(pasos, 1)).toBe('sigue en el paso 4 · Guardar y comprobar el archivo')
    expect(siguientePorDefecto(pasos, 3)).toBe('termina la guía')
  })
})

describe('etiquetaDestinoOpcion', () => {
  it('nombra cada destino', () => {
    expect(etiquetaDestinoOpcion({ tipo: 'paso', pasoId: 'p3' }, pasos, 0)).toBe('Ir al paso 3 · Exportar en Nuevo Outlook')
    expect(etiquetaDestinoOpcion({ tipo: 'paso', pasoId: '' }, pasos, 0)).toBe('Ir a un paso: elige cuál')
    expect(etiquetaDestinoOpcion({ tipo: 'paso', pasoId: 'borrado' }, pasos, 0)).toBe('Ir a un paso que ya no existe')
    expect(etiquetaDestinoOpcion({ tipo: 'continuar' }, pasos, 0)).toBe('Continuar: sigue en el paso 2 · Exportar en Outlook clásico')
    expect(etiquetaDestinoOpcion({ tipo: 'guia', articuloId: 'g', titulo: 'Exportar PST' }, pasos, 0)).toBe('Abrir «Exportar PST»')
    expect(etiquetaDestinoOpcion({ tipo: 'guia', articuloId: '', titulo: '' }, pasos, 0)).toBe('Abrir una guía: elige cuál')
    expect(etiquetaDestinoOpcion({ tipo: 'fin' }, pasos, 0)).toBe('Terminar la guía')
  })
})

describe('textoCamino', () => {
  it('enseña el camino de cada respuesta con los números del editor', () => {
    expect(textoCamino(pasos, 'p1', decision, 'clasico')).toBe('Después: 2 → 4.')
    expect(textoCamino(pasos, 'p1', decision, 'nuevo')).toBe('Después: 3 → 4.')
    expect(textoCamino(pasos, 'p1', decision, 'guia')).toBe('Después: «Exportar PST», y después 2 → 4.')
    expect(textoCamino(pasos, 'p1', decision, 'fin')).toBe('Después: termina la guía.')
  })

  it('dice si el camino acaba en otra decisión', () => {
    const otra: BloquePaso = { ...decision, id: 'otra', opciones: [decision.opciones![0], decision.opciones![1]] }
    const conOtra = [paso('p1', 'Uno', [{ ...decision, opciones: [decision.opciones![1], decision.opciones![3]] }]), paso('p2', 'Dos'), paso('p3', 'Tres', [otra]), paso('p4', 'Cuatro')]
    expect(textoCamino(conOtra, 'p1', conOtra[0].bloques[0], 'nuevo')).toBe('Después: 3, donde se decide otra vez.')
  })
})

describe('etiquetaAlTerminar', () => {
  it('dice a dónde va cada paso al terminar', () => {
    expect(etiquetaAlTerminar(pasos, 1)).toBe('Al terminar, ir al paso 4 · Guardar y comprobar el archivo')
    expect(etiquetaAlTerminar(pasos, 2)).toBe('Al terminar, sigue en el paso 4 · Guardar y comprobar el archivo')
    expect(etiquetaAlTerminar(pasos, 3)).toBe('Al terminar, termina la guía')
    expect(etiquetaAlTerminar([paso('a', 'A', [], { tipo: 'fin' }), paso('b', 'B')], 0)).toBe('Al terminar, termina la guía')
  })
})
