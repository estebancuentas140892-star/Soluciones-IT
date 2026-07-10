import { describe, expect, it } from 'vitest'
import type { Articulo, DispositivoAfectado, TipoArticulo } from '../../lib/db'
import { problemasDeDispositivo } from './problemasDeDispositivo'

function articulo(cambios: Partial<Articulo> & { id: string; titulo: string }): Articulo {
  return {
    categoriaId: 'cat-1',
    tipo: 'problema_frecuente' as TipoArticulo,
    contenido: '',
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [] as DispositivoAfectado[],
    esRutaInicio: false,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    updatedAt: '',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

describe('problemasDeDispositivo', () => {
  it('lista las incidencias que mencionan al equipo, ordenadas por título', () => {
    const articulos = [
      articulo({ id: 'b', titulo: 'B: papel atascado', dispositivosAfectados: [{ id: 'disp-1', nombre: 'Impresora' }] }),
      articulo({ id: 'a', titulo: 'A: no imprime', dispositivosAfectados: [{ id: 'disp-1', nombre: 'Impresora' }] }),
      articulo({ id: 'otro', titulo: 'Otra impresora', dispositivosAfectados: [{ id: 'disp-2', nombre: 'Otra' }] }),
    ]
    const resultado = problemasDeDispositivo(articulos, 'disp-1')
    expect(resultado.map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('ignora artículos que no son incidencias aunque mencionen al equipo', () => {
    const articulos = [
      articulo({ id: 'proc', titulo: 'Instalar', tipo: 'instalacion', dispositivosAfectados: [{ id: 'disp-1', nombre: 'X' }] }),
    ]
    expect(problemasDeDispositivo(articulos, 'disp-1')).toEqual([])
  })

  it('excluye borradores, obsoletos y eliminados', () => {
    const base = { dispositivosAfectados: [{ id: 'disp-1', nombre: 'X' }] }
    const articulos = [
      articulo({ id: 'borrador', titulo: 'Borrador', estado: 'borrador', ...base }),
      articulo({ id: 'obsoleto', titulo: 'Obsoleto', estado: 'obsoleto', ...base }),
      articulo({ id: 'eliminado', titulo: 'Eliminado', eliminadoEn: '2026-01-01', ...base }),
      articulo({ id: 'ok', titulo: 'Vigente', ...base }),
    ]
    expect(problemasDeDispositivo(articulos, 'disp-1').map((a) => a.id)).toEqual(['ok'])
  })

  it('trata un artículo sin estado como publicado (dato anterior a la columna)', () => {
    const viejo = articulo({ id: 'viejo', titulo: 'Viejo', dispositivosAfectados: [{ id: 'disp-1', nombre: 'X' }] })
    // Simula una fila guardada antes de que existiera `estado`.
    delete (viejo as Partial<Articulo>).estado
    expect(problemasDeDispositivo([viejo], 'disp-1').map((a) => a.id)).toEqual(['viejo'])
  })

  it('devuelve vacío cuando el equipo no aparece en ninguna incidencia', () => {
    const articulos = [articulo({ id: 'a', titulo: 'A', dispositivosAfectados: [{ id: 'disp-9', nombre: 'X' }] })]
    expect(problemasDeDispositivo(articulos, 'disp-1')).toEqual([])
  })
})
