import { describe, expect, it } from 'vitest'
import type { Articulo } from '../../lib/db'
import { normalizarTexto } from '../soluciones/iconosSoluciones'
import {
  BORRADORES_VISIBLES,
  borradoresCoincidentes,
  esBorradorVivo,
  fraseBorradores,
} from './borradoresEnBusqueda'

// BORRADORES QUE COINCIDEN (encargo del 2026-09-20, tarea 1).
//
// El caso real que originó esto: la guía "Actualizar la resolución DIAN
// para facturación electrónica en un POS" existe, tiene nueve pasos y no
// está eliminada, pero está en `borrador`. Buscar "DIAN" encontraba la
// ficha de HKA Factura, así que había resultados y el aviso del borrador
// (que solo salía en "Sin coincidencias") no se dibujaba nunca.
//
// Todo lo que se prueba aquí es lógica pura: quién entra en la lista y
// en qué orden. Que el bloque se pinte con resultados oficiales delante
// se prueba con la pantalla montada, en `busquedaBorradores.test.tsx`.

const CATEGORIAS = new Map([
  ['cat-pos', 'POS'],
  ['cat-red', 'Red'],
])

function articulo(cambios: Partial<Articulo> & { id: string; titulo: string }): Articulo {
  return {
    categoriaId: 'cat-pos',
    tipo: 'configuracion',
    contenido: '',
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'borrador',
    version: '1.0',
    relacionados: [],
    origenSugerenciaId: null,
    aplicaA: null,
    updatedAt: '2026-09-20T00:00:00Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

const DIAN = articulo({
  id: 'a1ac8d0a-72e7-4dd1-a377-afd2a2ca1cc0',
  titulo: 'Actualizar la resolución DIAN para facturación electrónica en un POS',
})

describe('esBorradorVivo', () => {
  it('solo cuenta los borradores, no los publicados ni los obsoletos', () => {
    expect(esBorradorVivo(DIAN)).toBe(true)
    expect(esBorradorVivo(articulo({ id: 'p', titulo: 'Publicada', estado: 'publicado' }))).toBe(false)
    expect(esBorradorVivo(articulo({ id: 'o', titulo: 'Obsoleta', estado: 'obsoleto' }))).toBe(false)
  })

  it('un borrador eliminado no existe para nadie', () => {
    expect(esBorradorVivo(articulo({ id: 'e', titulo: 'Borrada', eliminadoEn: '2026-09-01T00:00:00Z' }))).toBe(
      false,
    )
  })
})

describe('borradoresCoincidentes', () => {
  const buscar = (articulos: Articulo[], texto: string) =>
    borradoresCoincidentes(articulos, CATEGORIAS, normalizarTexto(texto))

  it('encuentra la guía DIAN en borrador, con su categoría y su ruta a la guía', () => {
    const [encontrado] = buscar([DIAN], 'DIAN')
    expect(encontrado.titulo).toContain('resolución DIAN')
    expect(encontrado.categoriaNombre).toBe('POS')
    // La acción principal abre la GUÍA (con pasos, su ejecución), no el
    // editor: quien busca "DIAN" viene a hacer el procedimiento.
    expect(encontrado.ruta).toBe(`/soluciones/cat-pos/${DIAN.id}`)
    expect(encontrado.ruta.endsWith('/editar')).toBe(false)
    // Editar sigue disponible, pero no es lo que hace la fila.
    expect(encontrado.rutaEditor).toBe(`/soluciones/cat-pos/${DIAN.id}/editar`)
    expect(encontrado.coincidencia.enTitulo).toBe(true)
  })

  it('da igual la caja y las tildes', () => {
    expect(buscar([DIAN], 'dian')).toHaveLength(1)
    expect(buscar([DIAN], 'resolucion dian')).toHaveLength(1)
    expect(buscar([DIAN], 'RESOLUCIÓN DIAN')).toHaveLength(1)
    expect(buscar([DIAN], 'facturación electrónica')).toHaveLength(1)
    expect(buscar([DIAN], 'facturacion electronica')).toHaveLength(1)
  })

  it('mira los mismos campos que la lista de Guías: etiqueta, categoría y tipo', () => {
    const porEtiqueta = articulo({ id: 'b2', titulo: 'Sin nada en el título', etiquetas: ['DIAN'] })
    expect(buscar([porEtiqueta], 'dian')[0].coincidencia.donde).toBe('la etiqueta')
    expect(buscar([porEtiqueta], 'pos')[0].coincidencia.donde).toBe('la categoría')
  })

  it('no incluye publicados, obsoletos ni eliminados', () => {
    const otros = [
      articulo({ id: 'p1', titulo: 'Resolución DIAN publicada', estado: 'publicado' }),
      articulo({ id: 'o1', titulo: 'Resolución DIAN obsoleta', estado: 'obsoleto' }),
      articulo({ id: 'e1', titulo: 'Resolución DIAN borrada', eliminadoEn: '2026-09-01T00:00:00Z' }),
    ]
    expect(buscar(otros, 'dian')).toEqual([])
    expect(buscar([...otros, DIAN], 'dian').map((b) => b.id)).toEqual([DIAN.id])
  })

  it('pone primero lo que coincide en el título', () => {
    const porEtiqueta = articulo({ id: 'b2', titulo: 'Alta de un usuario', etiquetas: ['dian'] })
    const orden = buscar([porEtiqueta, DIAN], 'dian').map((b) => b.id)
    expect(orden).toEqual([DIAN.id, 'b2'])
  })

  it('sin consulta no devuelve nada (no es una lista de borradores)', () => {
    expect(borradoresCoincidentes([DIAN], CATEGORIAS, '')).toEqual([])
  })

  it('sin categoría viva deja el nombre vacío, pero el borrador sigue apareciendo', () => {
    const huerfano = articulo({ id: 'b3', titulo: 'Resolución DIAN suelta', categoriaId: 'cat-borrada' })
    const [encontrado] = buscar([huerfano], 'dian')
    expect(encontrado.categoriaNombre).toBe('')
    expect(encontrado.ruta).toBe('/soluciones/cat-borrada/b3')
  })
})

describe('fraseBorradores', () => {
  it('concuerda en singular y plural', () => {
    expect(fraseBorradores(1)).toBe('1 borrador coincide')
    expect(fraseBorradores(4)).toBe('4 borradores coinciden')
  })

  it('el tope inicial es de tres', () => {
    expect(BORRADORES_VISIBLES).toBe(3)
  })
})
