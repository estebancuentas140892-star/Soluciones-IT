import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { guardarRegistro, nuevoId } from './repositorio'
import { aplicarFilasRemotas } from './sync'
import { aEntidadLocal, aFilaRemota } from './tablas'

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

function filaRemotaDeArticulo(id: string, titulo: string): Record<string, unknown> {
  return {
    id,
    categoria_id: nuevoId(),
    titulo,
    tipo: 'problema_frecuente',
    contenido: 'Pasos para resolverlo',
    etiquetas: ['zebra', 'impresora'],
    updated_at: '2026-07-02T15:00:00+00:00',
    updated_by: null,
    eliminado_en: null,
  }
}

describe('mapeo entre columnas locales y remotas', () => {
  it('convierte filas del servidor a entidades locales', () => {
    const fila = filaRemotaDeArticulo(nuevoId(), 'Impresora Zebra no imprime')
    const articulo = aEntidadLocal('articulos', fila)

    expect(articulo.categoriaId).toBe(fila.categoria_id)
    expect(articulo.titulo).toBe('Impresora Zebra no imprime')
    expect(articulo.etiquetas).toEqual(['zebra', 'impresora'])
    expect(articulo.updatedAt).toBe('2026-07-02T15:00:00+00:00')
  })

  it('al subir no envía updated_at ni updated_by porque los pone el servidor', () => {
    const fila = aFilaRemota('articulos', {
      id: nuevoId(),
      categoriaId: nuevoId(),
      titulo: 'Título',
      tipo: 'manual',
      contenido: '',
      etiquetas: [],
      updatedAt: '2026-07-02T15:00:00Z',
      updatedBy: 'alguien',
      eliminadoEn: null,
    })

    expect(fila).not.toHaveProperty('updated_at')
    expect(fila).not.toHaveProperty('updated_by')
    expect(fila).toHaveProperty('eliminado_en', null)
    expect(fila).toHaveProperty('categoria_id')
  })
})

describe('aplicarFilasRemotas', () => {
  it('guarda las filas recibidas en la base local', async () => {
    const id = nuevoId()
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Configurar POS')])

    const articulo = await db.articulos.get(id)
    expect(articulo?.titulo).toBe('Configurar POS')
  })

  it('no pisa una ficha con cambios locales pendientes de subir', async () => {
    const id = nuevoId()
    const categoriaId = nuevoId()
    await guardarRegistro('articulos', {
      id,
      categoriaId,
      titulo: 'Versión editada en este teléfono',
      tipo: 'manual',
      contenido: '',
      etiquetas: [],
    })

    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Versión vieja del servidor')])

    const articulo = await db.articulos.get(id)
    expect(articulo?.titulo).toBe('Versión editada en este teléfono')
  })

  it('sí actualiza una ficha sin cambios pendientes', async () => {
    const id = nuevoId()
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Título original')])
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Título actualizado por un compañero')])

    const articulo = await db.articulos.get(id)
    expect(articulo?.titulo).toBe('Título actualizado por un compañero')
  })

  it('las eliminaciones de otros técnicos llegan como borrado suave', async () => {
    const id = nuevoId()
    await aplicarFilasRemotas('articulos', [filaRemotaDeArticulo(id, 'Artículo a eliminar')])

    const fila = filaRemotaDeArticulo(id, 'Artículo a eliminar')
    fila.eliminado_en = '2026-07-02T16:00:00+00:00'
    await aplicarFilasRemotas('articulos', [fila])

    const articulo = await db.articulos.get(id)
    expect(articulo?.eliminadoEn).toBe('2026-07-02T16:00:00+00:00')
  })
})
