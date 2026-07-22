import { describe, expect, it } from 'vitest'
import type { Articulo, DispositivoAfectado, TipoArticulo } from '../../lib/db'
import { procedimientosDeDispositivo } from './procedimientosDeDispositivo'

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
