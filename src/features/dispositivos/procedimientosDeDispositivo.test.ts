import { describe, expect, it } from 'vitest'
import type { Articulo, DispositivoAfectado, TipoArticulo } from '../../lib/db'
import { procedimientosDeCategoria, procedimientosDeDispositivo } from './procedimientosDeDispositivo'

function articulo(cambios: Partial<Articulo> & { id: string; titulo: string }): Articulo {
  return {
    categoriaId: 'cat-1',
    tipo: 'instalacion' as TipoArticulo,
    contenido: '',
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [] as DispositivoAfectado[],
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

describe('procedimientosDeDispositivo', () => {
  it('lista los procedimientos que mencionan al equipo, ordenados por título', () => {
    const articulos = [
      articulo({ id: 'b', titulo: 'B: configurar', dispositivosAfectados: [{ id: 'disp-1', nombre: 'Impresora' }] }),
      articulo({ id: 'a', titulo: 'A: instalar', dispositivosAfectados: [{ id: 'disp-1', nombre: 'Impresora' }] }),
      articulo({ id: 'otro', titulo: 'Otro equipo', dispositivosAfectados: [{ id: 'disp-2', nombre: 'Otra' }] }),
    ]
    const resultado = procedimientosDeDispositivo(articulos, 'disp-1')
    expect(resultado.map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('ignora las incidencias, que tienen su propio inverso (problemasDeDispositivo)', () => {
    const articulos = [
      articulo({
        id: 'incidencia',
        titulo: 'No imprime',
        tipo: 'problema_frecuente',
        dispositivosAfectados: [{ id: 'disp-1', nombre: 'X' }],
      }),
    ]
    expect(procedimientosDeDispositivo(articulos, 'disp-1')).toEqual([])
  })

  it('excluye borradores, obsoletos y eliminados', () => {
    const base = { dispositivosAfectados: [{ id: 'disp-1', nombre: 'X' }] }
    const articulos = [
      articulo({ id: 'borrador', titulo: 'Borrador', estado: 'borrador', ...base }),
      articulo({ id: 'obsoleto', titulo: 'Obsoleto', estado: 'obsoleto', ...base }),
      articulo({ id: 'eliminado', titulo: 'Eliminado', eliminadoEn: '2026-01-01', ...base }),
      articulo({ id: 'ok', titulo: 'Vigente', ...base }),
    ]
    expect(procedimientosDeDispositivo(articulos, 'disp-1').map((a) => a.id)).toEqual(['ok'])
  })

  it('devuelve vacío cuando el equipo no aparece en ningún procedimiento', () => {
    const articulos = [articulo({ id: 'a', titulo: 'A', dispositivosAfectados: [{ id: 'disp-9', nombre: 'X' }] })]
    expect(procedimientosDeDispositivo(articulos, 'disp-1')).toEqual([])
  })
})

describe('procedimientosDeCategoria', () => {
  it('lista los procedimientos publicados de la categoría, sin necesidad de vínculo por equipo', () => {
    const articulos = [
      articulo({ id: 'b', titulo: 'B: configurar', categoriaId: 'cat-1' }),
      articulo({ id: 'a', titulo: 'A: instalar', categoriaId: 'cat-1' }),
      articulo({ id: 'otra', titulo: 'De otra categoría', categoriaId: 'cat-2' }),
    ]
    expect(procedimientosDeCategoria(articulos, 'cat-1', new Set()).map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('excluye los ids ya listados como específicos del equipo', () => {
    const articulos = [
      articulo({ id: 'especifico', titulo: 'Ya vinculado', categoriaId: 'cat-1' }),
      articulo({ id: 'general', titulo: 'General', categoriaId: 'cat-1' }),
    ]
    expect(procedimientosDeCategoria(articulos, 'cat-1', new Set(['especifico'])).map((a) => a.id)).toEqual(['general'])
  })

  it('ignora incidencias, borradores, obsoletos y eliminados', () => {
    const articulos = [
      articulo({ id: 'incidencia', titulo: 'Incidencia', tipo: 'problema_frecuente', categoriaId: 'cat-1' }),
      articulo({ id: 'borrador', titulo: 'Borrador', estado: 'borrador', categoriaId: 'cat-1' }),
      articulo({ id: 'obsoleto', titulo: 'Obsoleto', estado: 'obsoleto', categoriaId: 'cat-1' }),
      articulo({ id: 'eliminado', titulo: 'Eliminado', eliminadoEn: '2026-01-01', categoriaId: 'cat-1' }),
      articulo({ id: 'ok', titulo: 'Vigente', categoriaId: 'cat-1' }),
    ]
    expect(procedimientosDeCategoria(articulos, 'cat-1', new Set()).map((a) => a.id)).toEqual(['ok'])
  })

  it('hallazgo H6: sin dispositivo, ignora aplicaA (se comporta como antes de H6)', () => {
    const articulos = [
      articulo({ id: 'restringido', titulo: 'Solo Zebra', categoriaId: 'cat-1', aplicaA: { marca: 'Zebra', modelo: null } }),
    ]
    expect(procedimientosDeCategoria(articulos, 'cat-1', new Set()).map((a) => a.id)).toEqual(['restringido'])
  })

  it('hallazgo H6: con dispositivo, filtra los que restringen marca/modelo distinto', () => {
    const articulos = [
      articulo({ id: 'general', titulo: 'General', categoriaId: 'cat-1', aplicaA: null }),
      articulo({ id: 'zebra', titulo: 'Solo Zebra', categoriaId: 'cat-1', aplicaA: { marca: 'Zebra', modelo: null } }),
      articulo({ id: 'hp', titulo: 'Solo HP', categoriaId: 'cat-1', aplicaA: { marca: 'HP', modelo: null } }),
    ]
    const resultado = procedimientosDeCategoria(articulos, 'cat-1', new Set(), { marca: 'Zebra', modelo: 'ZT411' })
    expect(resultado.map((a) => a.id)).toEqual(['general', 'zebra'])
  })
})
