import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS, normalizarProcedimiento } from '../../lib/procedimiento'
import {
  apoyosDelPaso,
  apoyosDeTarea,
  apoyosSinAsignar,
  cuentaApoyos,
  hayApoyos,
  ubicacionApoyosDelPaso,
} from './apoyosTarea'

function bloque(parcial: Partial<BloquePaso> & { id: string; tipo: BloquePaso['tipo'] }): BloquePaso {
  return { ...CAMPOS_BLOQUE_VACIOS, ...parcial }
}

function paso(parcial: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'p1',
    titulo: 'Abrir los recursos compartidos',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    vinculoProtegido: null,
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    ...parcial,
  }
}

const FOTO = { referencia: 'r/1.jpg', nombre: '1.jpg', tipo: 'image/jpeg' }
const PDF = { referencia: 'r/manual.pdf', nombre: 'manual.pdf', tipo: 'application/pdf' }

// El caso exacto del informe (H04): un paso con tres tareas, un aviso y
// un archivo. Antes salian los tres apoyos en las tres tareas.
const PASO_DEL_INFORME = paso({
  bloques: [
    bloque({ id: 't1', tipo: 'tarea', texto: 'Escribir la dirección' }),
    bloque({ id: 't2', tipo: 'tarea', texto: 'Confirmar' }),
    bloque({ id: 't3', tipo: 'tarea', texto: 'Comprobar el resultado', tipoTarea: 'verificacion' }),
    bloque({ id: 'a1', tipo: 'aviso', texto: 'Precaución de la primera', alcance: 'tarea', tareaId: 't1' }),
    bloque({ id: 'i1', tipo: 'imagen', adjunto: FOTO, alcance: 'tarea', tareaId: 't1' }),
    bloque({ id: 'f1', tipo: 'archivo', adjunto: PDF, alcance: 'tarea', tareaId: 't3' }),
  ],
})

describe('apoyosDeTarea', () => {
  it('A04: la imagen asignada a la tarea 1 sale ahí y no en las tareas 2 ni 3', () => {
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't1').imagenes.map((b) => b.id)).toEqual(['i1'])
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't2').imagenes).toEqual([])
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't3').imagenes).toEqual([])
  })

  it('A05: la precaución de la tarea 1 no se repite al avanzar', () => {
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't1').avisos.map((b) => b.id)).toEqual(['a1'])
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't2').avisos).toEqual([])
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't3').avisos).toEqual([])
  })

  it('el archivo va donde hace falta, no como un botón genérico en cada tarea', () => {
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't3').archivos.map((b) => b.id)).toEqual(['f1'])
    expect(apoyosDeTarea(PASO_DEL_INFORME, 't1').archivos).toEqual([])
  })

  it('el dato protegido de la tarea viaja con ella', () => {
    const vinculo = { tipo: 'credencial', id: 'c1', titulo: 'Admin' } as const
    const p = paso({ bloques: [bloque({ id: 't1', tipo: 'tarea', texto: 'x', vinculoProtegido: vinculo })] })
    expect(apoyosDeTarea(p, 't1').vinculoProtegido).toEqual(vinculo)
  })

  it('conserva el orden que les dio el autor', () => {
    const p = paso({
      bloques: [
        bloque({ id: 't1', tipo: 'tarea', texto: 'x' }),
        bloque({ id: 'a2', tipo: 'aviso', texto: 'Segundo', alcance: 'tarea', tareaId: 't1' }),
        bloque({ id: 'a1', tipo: 'aviso', texto: 'Primero', alcance: 'tarea', tareaId: 't1' }),
      ],
    })
    expect(apoyosDeTarea(p, 't1').avisos.map((b) => b.texto)).toEqual(['Segundo', 'Primero'])
  })
})

describe('apoyosDelPaso', () => {
  it('recoge lo marcado como del paso y lo heredado sin asignar, y nada de las tareas', () => {
    const p = paso({
      adjuntos: [PDF],
      bloques: [
        bloque({ id: 't1', tipo: 'tarea', texto: 'x' }),
        bloque({ id: 'a1', tipo: 'aviso', texto: 'De la tarea', alcance: 'tarea', tareaId: 't1' }),
        bloque({ id: 'a2', tipo: 'aviso', texto: 'Del paso', alcance: 'paso' }),
        bloque({ id: 'a3', tipo: 'aviso', texto: 'Heredado', alcance: 'sin-asignar' }),
      ],
    })
    const delPaso = apoyosDelPaso(p)
    expect(delPaso.avisos.map((b) => b.id)).toEqual(['a2', 'a3'])
    expect(delPaso.adjuntosPaso).toEqual([PDF])
  })

  it('descarta imágenes y archivos a medio subir (sin adjunto)', () => {
    const p = paso({
      bloques: [
        bloque({ id: 'i1', tipo: 'imagen', alcance: 'paso' }),
        bloque({ id: 'f1', tipo: 'archivo', alcance: 'paso' }),
      ],
    })
    expect(hayApoyos(apoyosDelPaso(p))).toBe(false)
  })

  it('cuenta las piezas para el control plegado', () => {
    expect(cuentaApoyos(apoyosDeTarea(PASO_DEL_INFORME, 't1'))).toBe(2)
    expect(cuentaApoyos(apoyosDeTarea(PASO_DEL_INFORME, 't2'))).toBe(0)
  })
})

describe('contenido heredado', () => {
  // Sección 8 del encargo: cuando no se puede saber a qué tarea
  // pertenece un apoyo, se conserva y se señala. Nunca se reparte entre
  // todas las tareas ni se oculta.
  it('un aviso de una guía anterior queda sin asignar, visible una vez y marcado para revisión', () => {
    const proc = normalizarProcedimiento({
      pasos: [
        {
          id: 'p1',
          titulo: 'Paso heredado',
          bloques: [
            { id: 't1', tipo: 'tarea', texto: 'Escribir la dirección' },
            { id: 'a1', tipo: 'aviso', texto: 'Precaución heredada', tono: 'precaucion' },
            { id: 't2', tipo: 'tarea', texto: 'Confirmar' },
          ],
        },
      ],
    })
    const p = proc!.pasos[0]
    expect(apoyosDeTarea(p, 't1').avisos).toEqual([])
    expect(apoyosDeTarea(p, 't2').avisos).toEqual([])
    expect(apoyosDelPaso(p).avisos.map((b) => b.texto)).toEqual(['Precaución heredada'])
    expect(apoyosSinAsignar(p).map((b) => b.id)).toEqual(['a1'])
  })

  it('en un paso SIN tareas no hay nada ambiguo que revisar', () => {
    const proc = normalizarProcedimiento({
      pasos: [{ id: 'p1', titulo: 'Solo lectura', bloques: [{ id: 'a1', tipo: 'aviso', texto: 'Nota' }] }],
    })
    expect(apoyosSinAsignar(proc!.pasos[0])).toEqual([])
    expect(apoyosDelPaso(proc!.pasos[0]).avisos).toHaveLength(1)
  })

  it('un apoyo que apunta a una tarea borrada se conserva, no se pierde', () => {
    const proc = normalizarProcedimiento({
      pasos: [
        {
          id: 'p1',
          bloques: [
            { id: 't1', tipo: 'tarea', texto: 'La que queda' },
            { id: 'a1', tipo: 'aviso', texto: 'Colgaba de la borrada', alcance: 'tarea', tareaId: 't9' },
          ],
        },
      ],
    })
    const p = proc!.pasos[0]
    expect(apoyosDeTarea(p, 't1').avisos).toEqual([])
    expect(apoyosDelPaso(p).avisos.map((b) => b.texto)).toEqual(['Colgaba de la borrada'])
    expect(apoyosSinAsignar(p)).toHaveLength(1)
  })
})

describe('ubicacionApoyosDelPaso', () => {
  // La regla de la seccion 3 del encargo del 2026-09-09: un contenido se
  // renderiza UNA sola vez, en el lugar que le corresponde. Estos casos
  // fijan que los tres destinos son excluyentes, que es lo que hace
  // imposible la duplicacion que se reporto.
  it('al entrar al paso van pegados a la instruccion', () => {
    expect(
      ubicacionApoyosDelPaso({ esTareaReal: true, enPrimeraTarea: true, panelDelPasoAbierto: false }),
    ).toBe('sueltos')
  })

  it('en las tareas siguientes no se repiten', () => {
    expect(
      ubicacionApoyosDelPaso({ esTareaReal: true, enPrimeraTarea: false, panelDelPasoAbierto: false }),
    ).toBe('ninguno')
  })

  it('con el panel abierto viven SOLO dentro del panel', () => {
    // Este es el caso que se duplicaba: la condicion de los sueltos
    // incluia "o el panel esta abierto", y el panel pinta la misma
    // lista, asi que la precaucion salia dos veces.
    expect(
      ubicacionApoyosDelPaso({ esTareaReal: true, enPrimeraTarea: false, panelDelPasoAbierto: true }),
    ).toBe('panel')
  })

  it('abrir el panel en la tarea 2 y volver a la 1 tampoco los duplica', () => {
    expect(
      ubicacionApoyosDelPaso({ esTareaReal: true, enPrimeraTarea: true, panelDelPasoAbierto: true }),
    ).toBe('panel')
  })

  it('un paso sin tareas los muestra sueltos: no hay entre que repartir', () => {
    expect(
      ubicacionApoyosDelPaso({ esTareaReal: false, enPrimeraTarea: false, panelDelPasoAbierto: false }),
    ).toBe('sueltos')
  })

  it('nunca devuelve dos destinos a la vez', () => {
    for (const esTareaReal of [true, false]) {
      for (const enPrimeraTarea of [true, false]) {
        for (const panelDelPasoAbierto of [true, false]) {
          const donde = ubicacionApoyosDelPaso({ esTareaReal, enPrimeraTarea, panelDelPasoAbierto })
          expect(['sueltos', 'panel', 'ninguno']).toContain(donde)
        }
      }
    }
  })
})
