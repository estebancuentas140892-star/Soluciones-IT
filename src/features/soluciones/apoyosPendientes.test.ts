import { describe, expect, it } from 'vitest'
import type { BloquePaso, PasoProcedimiento } from '../../lib/db'
import { CAMPOS_BLOQUE_VACIOS } from '../../lib/procedimiento'
import { apoyosDelPaso, apoyosDeTarea } from './apoyosTarea'
import {
  apoyosPendientes,
  bloqueaPublicacion,
  motivoBloqueoPublicacion,
  resumenApoyosPendientes,
} from './apoyosPendientes'

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

const FOTO = { referencia: 'r/1.jpg', nombre: 'rack.jpg', tipo: 'image/jpeg' }

const PASO_HEREDADO = paso({
  id: 'p1',
  titulo: 'Conectar el equipo',
  bloques: [
    bloque({ id: 't1', tipo: 'tarea', texto: 'Escribir la dirección' }),
    bloque({ id: 't2', tipo: 'tarea', texto: 'Confirmar' }),
    bloque({ id: 'a1', tipo: 'aviso', texto: 'No apagues el rack', alcance: 'sin-asignar' }),
    bloque({ id: 'i1', tipo: 'imagen', adjunto: FOTO, alcance: 'sin-asignar' }),
  ],
})

describe('apoyosPendientes', () => {
  it('lista cada apoyo heredado con su paso y su texto, en el orden del editor', () => {
    const lista = apoyosPendientes([paso({ id: 'p0', bloques: [] }), PASO_HEREDADO])

    expect(lista).toHaveLength(2)
    expect(lista[0]).toMatchObject({
      pasoId: 'p1',
      bloqueId: 'a1',
      numeroPaso: 2,
      tituloPaso: 'Conectar el equipo',
      clase: 'Aviso',
      resumen: 'No apagues el rack',
    })
    expect(lista[1]).toMatchObject({ bloqueId: 'i1', clase: 'Imagen', resumen: 'rack.jpg' })
  })

  it('no lista los apoyos ya asignados', () => {
    const asignado = paso({
      bloques: [
        bloque({ id: 't1', tipo: 'tarea', texto: 'Escribir' }),
        bloque({ id: 'a1', tipo: 'aviso', texto: 'De la tarea', alcance: 'tarea', tareaId: 't1' }),
        bloque({ id: 'a2', tipo: 'aviso', texto: 'Del paso', alcance: 'paso' }),
      ],
    })
    expect(apoyosPendientes([asignado])).toEqual([])
  })

  it('un paso sin tareas no tiene nada que repartir', () => {
    const soloApoyos = paso({
      bloques: [bloque({ id: 'a1', tipo: 'aviso', texto: 'Heredado', alcance: 'sin-asignar' })],
    })
    expect(apoyosPendientes([soloApoyos])).toEqual([])
  })

  it('cuenta en singular y en plural', () => {
    expect(resumenApoyosPendientes(1)).toBe('1 apoyo sin asignar')
    expect(resumenApoyosPendientes(3)).toBe('3 apoyos sin asignar')
  })
})

describe('bloqueaPublicacion', () => {
  it('no deja publicar una guia nueva con apoyos sin asignar', () => {
    expect(bloqueaPublicacion({ publicando: true, yaPublicado: false, pendientes: 2 })).toBe(true)
    expect(motivoBloqueoPublicacion(2)).toContain('2 apoyos sin asignar')
    expect(motivoBloqueoPublicacion(1)).toContain('1 apoyo sin asignar')
  })

  it('deja guardar un borrador aunque queden pendientes', () => {
    expect(bloqueaPublicacion({ publicando: false, yaPublicado: false, pendientes: 2 })).toBe(false)
  })

  it('deja seguir editando una guia ya publicada con contenido heredado', () => {
    expect(bloqueaPublicacion({ publicando: true, yaPublicado: true, pendientes: 2 })).toBe(false)
  })

  it('sin pendientes no bloquea nada', () => {
    expect(bloqueaPublicacion({ publicando: true, yaPublicado: false, pendientes: 0 })).toBe(false)
  })
})

// LO HEREDADO SE CONSERVA Y NO SE DUPLICA (puntos 5, 8, 9 y 10 de la
// tarea 7). Aqui se comprueba sobre el mismo paso que lista
// `apoyosPendientes`: nada se asigna solo, nada se pierde y ninguna
// pieza sale dos veces.
describe('lo heredado mientras nadie lo asigna', () => {
  it('se conserva entero y se muestra como contenido del paso', () => {
    const delPaso = apoyosDelPaso(PASO_HEREDADO)
    expect(delPaso.avisos.map((b) => b.id)).toEqual(['a1'])
    expect(delPaso.imagenes.map((b) => b.id)).toEqual(['i1'])
  })

  it('no se reparte solo entre las tareas', () => {
    for (const tareaId of ['t1', 't2']) {
      const apoyos = apoyosDeTarea(PASO_HEREDADO, tareaId)
      expect(apoyos.avisos).toEqual([])
      expect(apoyos.imagenes).toEqual([])
    }
  })

  it('un apoyo asignado a una tarea sale en esa tarea y en ninguna otra parte', () => {
    const asignado: PasoProcedimiento = {
      ...PASO_HEREDADO,
      bloques: PASO_HEREDADO.bloques.map((b) =>
        b.id === 'a1' ? { ...b, alcance: 'tarea' as const, tareaId: 't1' } : b,
      ),
    }

    expect(apoyosDeTarea(asignado, 't1').avisos.map((b) => b.id)).toEqual(['a1'])
    expect(apoyosDeTarea(asignado, 't2').avisos).toEqual([])
    expect(apoyosDelPaso(asignado).avisos).toEqual([])
    expect(apoyosPendientes([asignado]).map((p) => p.bloqueId)).toEqual(['i1'])
  })
})
