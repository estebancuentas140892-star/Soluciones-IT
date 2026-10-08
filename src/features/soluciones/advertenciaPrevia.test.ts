import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { pasoPrueba } from '../../pruebas/montaje'
import {
  accionesEnEspera,
  advertenciasDeLista,
  esApoyoEnEspera,
  esRiesgoReal,
  tonoDeLaAdvertencia,
} from './advertenciaPrevia'
import { avisosDeTareaFoco, tareasParaFoco } from './tareasFoco'

// LA REGLA DE LA ADVERTENCIA PREVIA (tarea 311), sin pantallas: qué es un
// riesgo real, qué tono manda y dónde va cada riesgo en una lista. Todo
// inventado.

function aviso(id: string, tono: BloquePaso['tono'], tareaId: string | null, texto = `Aviso ${id}`): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, id, tipo: 'aviso', texto, tono, alcance: tareaId ? 'tarea' : 'paso', tareaId }
}

function paso(bloques: BloquePaso[]): PasoProcedimiento {
  const base = pasoPrueba('p1', 'Paso de prueba', ['Acción uno', 'Acción dos'])
  return { ...base, bloques: [base.bloques[0], base.bloques[1], ...bloques] }
}

describe('qué es un riesgo real', () => {
  it('Precaución e Importante sí; el dato técnico y los tonos heredados no', () => {
    expect(esRiesgoReal(aviso('a', 'precaucion', 'p1-t1'))).toBe(true)
    expect(esRiesgoReal(aviso('b', 'importante', 'p1-t1'))).toBe(true)
    expect(esRiesgoReal(aviso('c', 'dato', 'p1-t1'))).toBe(false)
    expect(esRiesgoReal(aviso('d', 'info', 'p1-t1'))).toBe(false)
    expect(esRiesgoReal(aviso('e', 'consejo', 'p1-t1'))).toBe(false)
    // Una tarea nunca es un aviso, aunque el dato traiga un tono.
    expect(esRiesgoReal({ ...pasoPrueba('x', 'x', ['Tarea']).bloques[0], tono: 'importante' })).toBe(false)
  })
})

describe('el tono que manda', () => {
  it('Importante si alguno lo es; si no, Precaución', () => {
    expect(tonoDeLaAdvertencia([aviso('a', 'precaucion', 't')]).valor).toBe('precaucion')
    expect(tonoDeLaAdvertencia([aviso('a', 'precaucion', 't'), aviso('b', 'importante', 't')]).valor).toBe('importante')
    expect(tonoDeLaAdvertencia([aviso('b', 'importante', 't'), aviso('a', 'precaucion', 't')]).valor).toBe('importante')
    expect(tonoDeLaAdvertencia([aviso('a', 'precaucion', 't'), aviso('c', 'precaucion', 't')]).etiqueta).toBe('Precaución')
  })
})

describe('dónde va cada riesgo en una lista', () => {
  it('antes de su tarea, en el orden del autor; los del paso, antes de la primera y primero', () => {
    const { antesDe, reubicados } = advertenciasDeLista(
      paso([
        aviso('r2', 'precaucion', 'p1-t2'),
        aviso('rp', 'importante', null),
        aviso('r1', 'precaucion', 'p1-t1'),
        aviso('r2b', 'importante', 'p1-t2'),
        aviso('d', 'dato', 'p1-t2'),
      ]),
    )
    expect(antesDe.get('p1-t1')?.map((a) => a.id)).toEqual(['rp', 'r1'])
    expect(antesDe.get('p1-t2')?.map((a) => a.id)).toEqual(['r2', 'r2b'])
    expect([...reubicados].sort()).toEqual(['r1', 'r2', 'r2b', 'rp'])
    // El dato técnico no se mueve: se queda con su acción.
    expect(reubicados.has('d')).toBe(false)
  })

  it('un paso sin tareas, o un riesgo de una tarea que ya no existe, se quedan donde están', () => {
    const sinTareas: PasoProcedimiento = { ...pasoPrueba('p2', 'Solo avisos', []), bloques: [aviso('rp', 'precaucion', null)] }
    expect(advertenciasDeLista(sinTareas).reubicados.size).toBe(0)
    const huerfano = advertenciasDeLista(paso([aviso('rh', 'precaucion', 'no-existe')]))
    expect(huerfano.reubicados.has('rh')).toBe(false)
  })

  it('las acciones que esperan tras su advertencia: con riesgo, pendientes y sin leer; y sus apoyos esperan con ellas', () => {
    const advertencias = advertenciasDeLista(paso([aviso('r1', 'precaucion', 'p1-t1'), aviso('r2', 'precaucion', 'p1-t2')]))
    expect([...accionesEnEspera(advertencias, new Set(), new Set())].sort()).toEqual(['p1-t1', 'p1-t2'])
    expect([...accionesEnEspera(advertencias, new Set(['p1-t1']), new Set())]).toEqual(['p1-t2'])
    expect([...accionesEnEspera(advertencias, new Set(), new Set(['p1-t2']))]).toEqual(['p1-t1'])
    const enEspera = new Set(['p1-t2'])
    expect(esApoyoEnEspera(aviso('d', 'dato', 'p1-t2'), enEspera)).toBe(true)
    expect(esApoyoEnEspera(aviso('d1', 'dato', 'p1-t1'), enEspera)).toBe(false)
    expect(esApoyoEnEspera(aviso('dp', 'dato', null), enEspera)).toBe(false)
    // La tarea misma no es un apoyo.
    expect(esApoyoEnEspera(pasoPrueba('p1', 'x', ['a', 'b']).bloques[1], enEspera)).toBe(false)
  })
})

describe('en la acción a la vez, los mismos riesgos con su entrada', () => {
  it('la advertencia previa de cada entrada son sus alertas, ya repartidas; el dato no', () => {
    const p = paso([aviso('rp', 'importante', null), aviso('r2', 'precaucion', 'p1-t2'), aviso('d', 'dato', 'p1-t2')])
    const tareas = tareasParaFoco(p, 'Paso de prueba')
    expect(tareas).toHaveLength(2)
    expect(avisosDeTareaFoco(p, tareas, 0).alertas.map((a) => a.id)).toEqual(['rp'])
    expect(avisosDeTareaFoco(p, tareas, 1).alertas.map((a) => a.id)).toEqual(['r2'])
    expect(avisosDeTareaFoco(p, tareas, 1).datos.map((a) => a.id)).toEqual(['d'])
  })
})
