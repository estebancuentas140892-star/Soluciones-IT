import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { accionFoco, tareasParaFoco } from './tareasFoco'

function bloque(parcial: Partial<BloquePaso> & { id: string; tipo: BloquePaso['tipo'] }): BloquePaso {
  return {
    texto: '',
    tono: null,
    adjunto: null,
    tipoTarea: null,
    decisionArticuloId: null,
    decisionArticuloTitulo: '',
    vinculoProtegido: null,
    ...parcial,
  }
}

function paso(parcial: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'p1',
    titulo: 'Cargar el rollo de etiquetas',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    vinculoProtegido: null,
    ...parcial,
  } as PasoProcedimiento
}

describe('tareasParaFoco', () => {
  it('devuelve las tareas del paso en orden, ignorando avisos e imagenes', () => {
    const p = paso({
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Abrir la tapa lateral' }),
        bloque({ id: 'b2', tipo: 'aviso', texto: 'No forzar la guia' }),
        bloque({ id: 'b3', tipo: 'tarea', texto: 'Colocar el rollo hacia arriba' }),
      ],
    })
    expect(tareasParaFoco(p, 'Cargar el rollo').map((t) => t.texto)).toEqual([
      'Abrir la tapa lateral',
      'Colocar el rollo hacia arriba',
    ])
    expect(tareasParaFoco(p, 'Cargar el rollo').every((t) => !t.esPasoEntero)).toBe(true)
  })

  it('un paso SIN tareas se presenta como una sola tarea con el titulo (G-18)', () => {
    const tareas = tareasParaFoco(paso({ bloques: [] }), 'Desembalar y ubicar')
    expect(tareas).toHaveLength(1)
    expect(tareas[0].texto).toBe('Desembalar y ubicar')
    expect(tareas[0].esPasoEntero).toBe(true)
    // El id no puede chocar con el de un bloque: el progreso se guarda
    // por id y marcar esta pseudo tarea no debe ensuciar nada.
    expect(tareas[0].id).toBe('paso:p1')
  })

  it('un paso con solo avisos tambien cae en la tarea unica', () => {
    const p = paso({ bloques: [bloque({ id: 'b1', tipo: 'aviso', texto: 'Cuidado' })] })
    expect(tareasParaFoco(p, 'Revisar')[0].esPasoEntero).toBe(true)
  })

  it('el vinculo protegido de la tarea gana al del paso, y el del paso sirve de respaldo', () => {
    const vinculoTarea = { tipo: 'credencial', id: 'c1', titulo: 'Admin Zebra' } as never
    const vinculoPaso = { tipo: 'credencial', id: 'c2', titulo: 'Admin red' } as never
    const p = paso({
      vinculoProtegido: vinculoPaso,
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Con clave propia', vinculoProtegido: vinculoTarea }),
        bloque({ id: 'b2', tipo: 'tarea', texto: 'Sin clave propia' }),
      ],
    })
    const tareas = tareasParaFoco(p, 'Conectar')
    expect(tareas[0].vinculoProtegido).toBe(vinculoTarea)
    expect(tareas[1].vinculoProtegido).toBe(vinculoPaso)
  })

  it('la tarea unica hereda el vinculo protegido del paso', () => {
    const vinculoPaso = { tipo: 'credencial', id: 'c2', titulo: 'Admin red' } as never
    const tareas = tareasParaFoco(paso({ bloques: [], vinculoProtegido: vinculoPaso }), 'Conectar')
    expect(tareas[0].vinculoProtegido).toBe(vinculoPaso)
  })
})

describe('accionFoco', () => {
  const dos = tareasParaFoco(
    paso({
      bloques: [
        bloque({ id: 'b1', tipo: 'tarea', texto: 'Una' }),
        bloque({ id: 'b2', tipo: 'tarea', texto: 'Otra' }),
      ],
    }),
    'Paso',
  )

  it('marca mientras quede alguna tarea sin hacer', () => {
    expect(accionFoco(dos, new Set())).toBe('marcar')
    expect(accionFoco(dos, new Set(['b1']))).toBe('marcar')
  })

  it('cierra el paso cuando ya no queda ninguna', () => {
    expect(accionFoco(dos, new Set(['b1', 'b2']))).toBe('completar')
  })

  it('el paso sin tareas cierra desde el principio: no hay nada intermedio que marcar', () => {
    const unica = tareasParaFoco(paso({ bloques: [] }), 'Desembalar')
    expect(accionFoco(unica, new Set())).toBe('completar')
  })
})
