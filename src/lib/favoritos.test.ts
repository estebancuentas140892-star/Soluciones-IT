import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Articulo, type Diagnostico, type Dispositivo } from './db'
import { nuevoId } from './repositorio'
import { alternarFavorito, esFavorito, obtenerFavoritos } from './favoritos'

function articuloDePrueba(id: string, titulo: string): Articulo {
  return {
    id,
    categoriaId: 'cat-1',
    titulo,
    tipo: 'manual',
    contenido: '',
    etiquetas: [],
    procedimiento: null,
    sintomas: [],
    causas: [],
    dispositivosAfectados: [],
    esRutaInicio: false,
    ordenRutaInicio: 0,
    estado: 'publicado',
    version: '1.0',
    relacionados: [],
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
  }
}

function dispositivoDePrueba(id: string, nombre: string): Dispositivo {
  return {
    id,
    categoriaId: 'cat-1',
    nombre,
    marca: 'Hikvision',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: 'Bodega',
    ubicacionId: null,
    responsable: '',
    responsableId: null,
    reemplazaA: null,
    ip: '',
    estado: '',
    observaciones: '',
    detalles: {},
    foto: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
  }
}

function diagnosticoDePrueba(id: string, titulo: string): Diagnostico {
  return {
    id,
    categoriaId: 'cat-1',
    titulo,
    descripcion: '',
    nodos: [],
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
  await db.categorias.put({
    id: 'cat-1',
    nombre: 'Cámaras',
    icono: '',
    orden: 1,
    esRed: true,
    color: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
  })
})

describe('favoritos', () => {
  it('marca los tres tipos y los devuelve resueltos, el más reciente primero', async () => {
    const articuloId = nuevoId()
    const dispositivoId = nuevoId()
    const diagnosticoId = nuevoId()
    await db.articulos.put(articuloDePrueba(articuloId, 'Configurar cámara'))
    await db.dispositivos.put(dispositivoDePrueba(dispositivoId, 'Cámara bodega'))
    await db.diagnosticos.put(diagnosticoDePrueba(diagnosticoId, 'La cámara no graba'))

    await alternarFavorito('articulo', articuloId)
    await new Promise((r) => setTimeout(r, 5))
    await alternarFavorito('dispositivo', dispositivoId)
    await new Promise((r) => setTimeout(r, 5))
    await alternarFavorito('diagnostico', diagnosticoId)

    const favoritos = await obtenerFavoritos()
    expect(favoritos).toHaveLength(3)
    expect(favoritos[0]).toMatchObject({
      tipo: 'diagnostico',
      titulo: 'La cámara no graba',
      subtitulo: 'Cámaras',
      ruta: `/diagnostico/${diagnosticoId}`,
    })
    expect(favoritos[1]).toMatchObject({
      tipo: 'dispositivo',
      titulo: 'Cámara bodega',
      subtitulo: 'Hikvision · Bodega',
      ruta: `/dispositivos/${dispositivoId}`,
    })
    expect(favoritos[2]).toMatchObject({
      tipo: 'articulo',
      titulo: 'Configurar cámara',
      subtitulo: 'Cámaras',
      ruta: `/soluciones/cat-1/${articuloId}`,
    })
  })

  it('alternar dos veces quita la marca', async () => {
    const id = nuevoId()
    await db.articulos.put(articuloDePrueba(id, 'Artículo'))

    expect(await alternarFavorito('articulo', id)).toBe(true)
    expect(await esFavorito('articulo', id)).toBe(true)

    expect(await alternarFavorito('articulo', id)).toBe(false)
    expect(await esFavorito('articulo', id)).toBe(false)
    expect(await db.favoritos.count()).toBe(0)
  })

  it('el mismo id con tipos distintos son marcas independientes', async () => {
    const id = nuevoId()
    await db.articulos.put(articuloDePrueba(id, 'Artículo'))

    await alternarFavorito('articulo', id)
    expect(await esFavorito('dispositivo', id)).toBe(false)
  })

  it('omite fichas eliminadas o que ya no existen, sin borrar la marca', async () => {
    const vivo = nuevoId()
    const eliminado = nuevoId()
    const inexistente = nuevoId()
    await db.articulos.put(articuloDePrueba(vivo, 'Vigente'))
    const borrado = articuloDePrueba(eliminado, 'Borrado')
    borrado.eliminadoEn = new Date().toISOString()
    await db.articulos.put(borrado)

    await alternarFavorito('articulo', vivo)
    await alternarFavorito('articulo', eliminado)
    await alternarFavorito('articulo', inexistente)

    const favoritos = await obtenerFavoritos()
    expect(favoritos.map((f) => f.titulo)).toEqual(['Vigente'])
    // La marca se conserva: si la ficha reaparece al sincronizar, el
    // favorito vuelve solo.
    expect(await db.favoritos.count()).toBe(3)
  })
})
