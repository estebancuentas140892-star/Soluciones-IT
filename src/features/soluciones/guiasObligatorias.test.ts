import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import {
  guiasObligatoriasDeTarea,
  guiasObligatoriasPendientes,
  idsGuiasObligatoriasDelPaso,
  motivoGuiasPendientes,
} from './guiasObligatorias'

function bloque(parcial: Partial<BloquePaso> & { id: string; tipo: BloquePaso['tipo'] }): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, ...parcial }
}

function guia(id: string, tareaId: string, articuloId: string, titulo: string, intencion: BloquePaso['intencionGuia']) {
  return bloque({
    id,
    tipo: 'guia',
    alcance: 'tarea',
    tareaId,
    guiaArticuloId: articuloId,
    guiaArticuloTitulo: titulo,
    intencionGuia: intencion,
  })
}

function paso(bloques: BloquePaso[]): PasoProcedimiento {
  return {
    id: 'p1',
    titulo: 'Paso',
    objetivo: '',
    bloques,
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
  }
}

// t1 sin guías, t2 con una, t3 con dos (el caso que el `.find` anterior
// se dejaba a medias) más una de consulta que no debe contar.
const PASO = paso([
  bloque({ id: 't1', tipo: 'tarea', texto: 'Sin guías' }),
  bloque({ id: 't2', tipo: 'tarea', texto: 'Con una' }),
  guia('g1', 't2', 'art-gestor', 'Acceder al gestor', 'necesario'),
  bloque({ id: 't3', tipo: 'tarea', texto: 'Con dos' }),
  guia('g2', 't3', 'art-uno', 'Primera necesaria', 'necesario'),
  guia('g3', 't3', 'art-consulta', 'Material de apoyo', 'consulta'),
  guia('g4', 't3', 'art-dos', 'Segunda necesaria', 'necesario'),
])

describe('guiasObligatoriasDeTarea', () => {
  it('una tarea sin guías no exige nada', () => {
    expect(guiasObligatoriasDeTarea(PASO, 't1')).toEqual([])
  })

  it('una tarea con una guía necesaria la devuelve', () => {
    expect(guiasObligatoriasDeTarea(PASO, 't2').map((g) => g.guiaArticuloId)).toEqual(['art-gestor'])
  })

  it('con VARIAS necesarias las devuelve TODAS y en el orden del editor', () => {
    // El defecto: `.find` tomaba solo 'art-uno' y 'art-dos' no existía
    // para el recorrido.
    expect(guiasObligatoriasDeTarea(PASO, 't3').map((g) => g.guiaArticuloId)).toEqual(['art-uno', 'art-dos'])
  })

  it('las de consulta y contingencia no cuentan como obligatorias', () => {
    const conContingencia = paso([
      bloque({ id: 't1', tipo: 'tarea', texto: 'Tarea' }),
      guia('g1', 't1', 'art-a', 'Consulta', 'consulta'),
      guia('g2', 't1', 'art-b', 'Contingencia', 'contingencia'),
    ])
    expect(guiasObligatoriasDeTarea(conContingencia, 't1')).toEqual([])
  })

  it('no se lleva las guías de OTRA tarea del mismo paso', () => {
    expect(guiasObligatoriasDeTarea(PASO, 't2').map((g) => g.id)).toEqual(['g1'])
  })

  it('una guía del PASO (alcance no tarea) no obliga a ninguna tarea', () => {
    const delPaso = paso([
      bloque({ id: 't1', tipo: 'tarea', texto: 'Tarea' }),
      bloque({
        id: 'g1',
        tipo: 'guia',
        alcance: 'paso',
        guiaArticuloId: 'art-a',
        intencionGuia: 'necesario',
      }),
    ])
    expect(guiasObligatoriasDeTarea(delPaso, 't1')).toEqual([])
  })

  it('una guía sin artículo apuntado se ignora', () => {
    const sinDestino = paso([
      bloque({ id: 't1', tipo: 'tarea', texto: 'Tarea' }),
      bloque({ id: 'g1', tipo: 'guia', alcance: 'tarea', tareaId: 't1', intencionGuia: 'necesario' }),
    ])
    expect(guiasObligatoriasDeTarea(sinDestino, 't1')).toEqual([])
  })
})

describe('idsGuiasObligatoriasDelPaso', () => {
  it('junta las de todas las tareas sin repetir', () => {
    expect(idsGuiasObligatoriasDelPaso(PASO)).toEqual(['art-gestor', 'art-uno', 'art-dos'])
  })

  it('la misma guía exigida por dos tareas sale una vez', () => {
    const repetida = paso([
      bloque({ id: 't1', tipo: 'tarea', texto: 'Una' }),
      guia('g1', 't1', 'art-gestor', 'Gestor', 'necesario'),
      bloque({ id: 't2', tipo: 'tarea', texto: 'Otra' }),
      guia('g2', 't2', 'art-gestor', 'Gestor', 'necesario'),
    ])
    expect(idsGuiasObligatoriasDelPaso(repetida)).toEqual(['art-gestor'])
  })

  it('un paso sin guías obligatorias no consulta nada', () => {
    expect(idsGuiasObligatoriasDelPaso(paso([bloque({ id: 't1', tipo: 'tarea', texto: 'Sola' })]))).toEqual([])
  })
})

describe('guiasObligatoriasPendientes y su motivo', () => {
  const dos = guiasObligatoriasDeTarea(PASO, 't3')

  it('sin ninguna cumplida quedan las dos, en orden', () => {
    const pendientes = guiasObligatoriasPendientes(dos, () => false)
    expect(pendientes.map((g) => g.guiaArticuloId)).toEqual(['art-uno', 'art-dos'])
  })

  it('cumplir la primera deja la segunda', () => {
    const pendientes = guiasObligatoriasPendientes(dos, (id) => id === 'art-uno')
    expect(pendientes.map((g) => g.guiaArticuloId)).toEqual(['art-dos'])
    expect(motivoGuiasPendientes(pendientes)).toBe('Completa «Segunda necesaria» para marcar esta tarea')
  })

  it('cumplirlas todas desbloquea la tarea', () => {
    const pendientes = guiasObligatoriasPendientes(dos, () => true)
    expect(pendientes).toEqual([])
    expect(motivoGuiasPendientes(pendientes)).toBeNull()
  })

  it('el motivo nombra la primera y cuenta las demás', () => {
    expect(motivoGuiasPendientes(dos)).toBe(
      'Completa «Primera necesaria» y 1 guía más para marcar esta tarea',
    )
  })

  it('con tres pendientes el plural concuerda', () => {
    const tres = [...dos, guia('g5', 't3', 'art-tres', 'Tercera', 'necesario')]
    expect(motivoGuiasPendientes(tres)).toBe(
      'Completa «Primera necesaria» y 2 guías más para marcar esta tarea',
    )
  })

  it('una guía sin título no deja el mensaje cojo', () => {
    const anonima = [guia('g9', 't1', 'art-x', '', 'necesario')]
    expect(motivoGuiasPendientes(anonima)).toBe('Completa «la guía vinculada» para marcar esta tarea')
  })
})
