import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Articulo, type Dispositivo } from './db'
import { nuevoId } from './repositorio'
import { obtenerRecientes, registrarVisita } from './recientes'

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

describe('recientes', () => {
  it('devuelve lo visitado, lo más nuevo primero, con título y ruta', async () => {
    const articuloId = nuevoId()
    const dispositivoId = nuevoId()
    await db.articulos.put(articuloDePrueba(articuloId, 'Configurar cámara'))
    await db.dispositivos.put(dispositivoDePrueba(dispositivoId, 'Cámara bodega'))

    await registrarVisita('articulo', articuloId)
    await new Promise((r) => setTimeout(r, 5))
    await registrarVisita('dispositivo', dispositivoId)

    const recientes = await obtenerRecientes()
    expect(recientes).toHaveLength(2)
    expect(recientes[0]).toMatchObject({
      titulo: 'Cámara bodega',
      subtitulo: 'Hikvision · Bodega',
      ruta: `/dispositivos/${dispositivoId}`,
    })
    expect(recientes[1]).toMatchObject({
      titulo: 'Configurar cámara',
      subtitulo: 'Cámaras',
      ruta: `/soluciones/cat-1/${articuloId}`,
    })
  })

  it('volver a visitar una ficha la sube al principio sin duplicarla', async () => {
    const a = nuevoId()
    const b = nuevoId()
    await db.articulos.put(articuloDePrueba(a, 'Artículo A'))
    await db.articulos.put(articuloDePrueba(b, 'Artículo B'))

    await registrarVisita('articulo', a)
    await new Promise((r) => setTimeout(r, 5))
    await registrarVisita('articulo', b)
    await new Promise((r) => setTimeout(r, 5))
    await registrarVisita('articulo', a)

    const recientes = await obtenerRecientes()
    expect(recientes.map((r) => r.titulo)).toEqual(['Artículo A', 'Artículo B'])
  })

  it('omite fichas eliminadas o que ya no existen', async () => {
    const vivo = nuevoId()
    const eliminado = nuevoId()
    const inexistente = nuevoId()
    await db.articulos.put(articuloDePrueba(vivo, 'Vigente'))
    const borrado = articuloDePrueba(eliminado, 'Borrado')
    borrado.eliminadoEn = new Date().toISOString()
    await db.articulos.put(borrado)

    await registrarVisita('articulo', vivo)
    await registrarVisita('articulo', eliminado)
    await registrarVisita('articulo', inexistente)

    const recientes = await obtenerRecientes()
    expect(recientes.map((r) => r.titulo)).toEqual(['Vigente'])
  })

  it('conserva como máximo 20 visitas', async () => {
    for (let i = 0; i < 25; i++) {
      const id = nuevoId()
      await db.articulos.put(articuloDePrueba(id, `Artículo ${i}`))
      await registrarVisita('articulo', id)
    }
    expect(await db.recientes.count()).toBe(20)
  })
})
