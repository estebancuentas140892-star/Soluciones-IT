import { describe, expect, it } from 'vitest'
import type { Articulo, Categoria, Reciente } from '../../lib/db'
import { pasoPrueba } from '../../pruebas/montaje'
import { AGENDA_VACIA, type Agenda } from './agenda'
import type { ItemPendiente } from './pendientes'
import {
  accesosRapidos,
  asuntosDeAtencion,
  esGuiaPublicadaEjecutable,
  guiasRecientes,
} from './resolver'

// Lo que acompaña al buscador de Resolver (encargo del 2026-09-22). Todo
// lo sembrado es inventado.

const HOY = new Date('2026-09-22T15:00:00.000Z')

function hace(dias: number): string {
  return new Date(HOY.getTime() - dias * 24 * 60 * 60 * 1000).toISOString()
}

function categoria(id: string, nombre: string, orden: number, extra: Partial<Categoria> = {}): Categoria {
  return {
    id,
    nombre,
    icono: '',
    orden,
    esRed: false,
    color: null,
    updatedAt: hace(1),
    updatedBy: null,
    eliminadoEn: null,
    ...extra,
  }
}

function guia(id: string, categoriaId: string, extra: Partial<Articulo> = {}, conPasos = true): Articulo {
  return {
    id,
    categoriaId,
    titulo: `Guía ${id}`,
    tipo: 'configuracion',
    contenido: '',
    etiquetas: [],
    procedimiento: conPasos
      ? {
          descripcion: '',
          portada: null,
          objetivoGeneral: '',
          requisitos: [],
          verificacionFinal: [],
          tiempoEstimadoMin: null,
          dificultad: null,
          pasos: [pasoPrueba(`${id}-p1`, 'Un paso', ['Hacer algo'])],
        }
      : null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    ordenRutaInicio: 0,
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: hace(1),
    updatedBy: null,
    eliminadoEn: null,
    ...extra,
  }
}

function visita(entidadId: string, dias: number, tipo: Reciente['tipo'] = 'articulo'): Reciente {
  return { clave: `${tipo}:${entidadId}`, tipo, entidadId, visitadoEn: hace(dias) }
}

function pendiente(clave: string, diasRestantes: number | null, categoria: ItemPendiente['categoria'] = 'credencial'): ItemPendiente {
  return {
    clave,
    titulo: clave,
    detalle: '',
    ruta: `/boveda/${clave}`,
    tono: 'neutro',
    categoria,
    fecha: diasRestantes === null ? null : '2026-09-22',
    diasRestantes,
    origen: 'Bóveda',
  }
}

describe('asuntosDeAtencion', () => {
  it('junta vencidos, de hoy y próximos, en ese orden, y recorta a tres', () => {
    const agenda: Agenda = {
      ...AGENDA_VACIA,
      vencidos: [pendiente('v1', -9), pendiente('v2', -1)],
      hoy: [pendiente('h1', 0)],
      proximos: [pendiente('p1', 4), pendiente('p2', 9)],
    }
    const { visibles, total } = asuntosDeAtencion(agenda)
    expect(visibles.map((a) => `${a.estado}:${a.item.clave}`)).toEqual(['vencido:v1', 'vencido:v2', 'hoy:h1'])
    expect(total).toBe(5)
  })

  it('los borradores y las sugerencias no tienen plazo: no son "Atención"', () => {
    const agenda: Agenda = {
      ...AGENDA_VACIA,
      enCurso: [pendiente('b1', null, 'borrador')],
      porRevisar: [pendiente('s1', null, 'sugerencia')],
    }
    expect(asuntosDeAtencion(agenda)).toEqual({ visibles: [], total: 0 })
  })

  it('un próximo solo también es atención: "próxima a vencer"', () => {
    const agenda: Agenda = { ...AGENDA_VACIA, proximos: [pendiente('p1', 12)] }
    expect(asuntosDeAtencion(agenda).visibles).toEqual([{ item: agenda.proximos[0], estado: 'proximo' }])
  })
})

describe('esGuiaPublicadaEjecutable', () => {
  it('pide guía viva, publicada y con pasos', () => {
    expect(esGuiaPublicadaEjecutable(guia('a', 'c'))).toBe(true)
    expect(esGuiaPublicadaEjecutable(guia('a', 'c', { estado: 'borrador' }))).toBe(false)
    expect(esGuiaPublicadaEjecutable(guia('a', 'c', { estado: 'obsoleto' }))).toBe(false)
    expect(esGuiaPublicadaEjecutable(guia('a', 'c', { eliminadoEn: hace(1) }))).toBe(false)
    expect(esGuiaPublicadaEjecutable(guia('a', 'c', {}, false))).toBe(false)
  })

  it('una guía sin estado es anterior al campo y era oficial', () => {
    const vieja = guia('a', 'c')
    delete (vieja as Partial<Articulo>).estado
    expect(esGuiaPublicadaEjecutable(vieja)).toBe(true)
  })
})

describe('guiasRecientes', () => {
  const categorias = [categoria('imp', 'Impresoras', 1)]

  it('lista las guías usadas en los últimos 14 días, la más reciente primero, hasta tres', () => {
    const articulos = ['g1', 'g2', 'g3', 'g4'].map((id) => guia(id, 'imp'))
    const visitas = [visita('g1', 10), visita('g2', 1), visita('g3', 3), visita('g4', 5)]
    const recientes = guiasRecientes(visitas, articulos, categorias, new Map(), HOY)
    expect(recientes.map((r) => r.id)).toEqual(['g2', 'g3', 'g4'])
    expect(recientes[0]).toMatchObject({ categoriaNombre: 'Impresoras', ruta: '/soluciones/imp/g2', borrador: false })
  })

  it('una guía de hace más de 14 días ya no es reciente', () => {
    const recientes = guiasRecientes([visita('g1', 15)], [guia('g1', 'imp')], categorias, new Map(), HOY)
    expect(recientes).toEqual([])
  })

  it('solo procedimientos: ni manuales sin pasos, ni otras fichas, ni obsoletos ni eliminados', () => {
    const articulos = [
      guia('manual', 'imp', {}, false),
      guia('obsoleta', 'imp', { estado: 'obsoleto' }),
      guia('borrada', 'imp', { eliminadoEn: hace(2) }),
    ]
    const visitas = [
      visita('manual', 1),
      visita('obsoleta', 1),
      visita('borrada', 1),
      visita('equipo-1', 1, 'dispositivo'),
    ]
    expect(guiasRecientes(visitas, articulos, categorias, new Map(), HOY)).toEqual([])
  })

  it('un borrador que el técnico abrió entra, marcado', () => {
    const recientes = guiasRecientes([visita('b1', 1)], [guia('b1', 'imp', { estado: 'borrador' })], categorias, new Map(), HOY)
    expect(recientes[0]?.borrador).toBe(true)
  })

  it('lleva el avance a medias de este teléfono', () => {
    const avances = new Map([['g1', { hechos: 2, total: 7 }]])
    const recientes = guiasRecientes([visita('g1', 1)], [guia('g1', 'imp')], categorias, avances, HOY)
    expect(recientes[0]?.avance).toEqual({ hechos: 2, total: 7 })
  })
})

describe('accesosRapidos', () => {
  const categorias = [
    categoria('pos', 'POS', 1),
    categoria('imp', 'Impresoras', 2),
    categoria('red', 'Redes', 3, { esRed: true }),
    categoria('vacia', 'Servidores', 4),
  ]

  it('solo las categorías con guías publicadas y ejecutables, en su orden si nadie las usó', () => {
    const articulos = [
      guia('g1', 'imp'),
      guia('g2', 'pos'),
      guia('g3', 'red'),
      guia('borrador', 'vacia', { estado: 'borrador' }),
      guia('manual', 'vacia', {}, false),
    ]
    const accesos = accesosRapidos(categorias, articulos, [], HOY)
    expect(accesos.map((a) => a.nombre)).toEqual(['POS', 'Impresoras', 'Redes'])
    expect(accesos[0]).toMatchObject({ guias: 1, usos: 0 })
  })

  it('las más usadas en los últimos 30 días van primero', () => {
    const articulos = [guia('g1', 'pos'), guia('g2', 'imp'), guia('g3', 'imp')]
    const visitas = [visita('g2', 2), visita('g3', 20), visita('g1', 40)]
    const accesos = accesosRapidos(categorias, articulos, visitas, HOY)
    expect(accesos.map((a) => `${a.nombre}:${a.usos}`)).toEqual(['Impresoras:2', 'POS:0'])
  })

  it('con una sola categoría el bloque no aporta: devuelve vacío', () => {
    expect(accesosRapidos(categorias, [guia('g1', 'imp'), guia('g2', 'imp')], [], HOY)).toEqual([])
  })

  it('recorta a seis', () => {
    const muchas = Array.from({ length: 8 }, (_, i) => categoria(`c${i}`, `Categoría ${i}`, i))
    const articulos = muchas.map((c) => guia(`g-${c.id}`, c.id))
    expect(accesosRapidos(muchas, articulos, [], HOY)).toHaveLength(6)
  })

  it('una categoría eliminada no es una puerta', () => {
    const conBorrada = [...categorias.slice(0, 2), categoria('x', 'Borrada', 0, { eliminadoEn: hace(1) })]
    const articulos = [guia('g1', 'pos'), guia('g2', 'imp'), guia('g3', 'x')]
    expect(accesosRapidos(conBorrada, articulos, [], HOY).map((a) => a.nombre)).toEqual(['POS', 'Impresoras'])
  })
})
