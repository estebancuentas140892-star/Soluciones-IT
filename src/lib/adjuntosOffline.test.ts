import { beforeEach, describe, expect, it } from 'vitest'
import { claveDe, obtenerProgresoDescarga, referenciasParaOffline } from './adjuntosOffline'
import { db, type Articulo, type Dispositivo } from './db'

function articuloDePrueba(id: string, procedimiento: Articulo['procedimiento'] = null): Articulo {
  return {
    id,
    categoriaId: 'cat-1',
    titulo: 'Artículo de prueba',
    tipo: 'manual',
    contenido: '',
    etiquetas: [],
    procedimiento,
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

function dispositivoDePrueba(id: string, foto: Dispositivo['foto'] = null): Dispositivo {
  return {
    id,
    categoriaId: 'cat-1',
    nombre: 'Equipo de prueba',
    marca: '',
    modelo: '',
    serial: '',
    placaInventario: '',
    ubicacion: '',
    ubicacionId: null,
    ip: '',
    estado: '',
    observaciones: '',
    detalles: {},
    foto,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn: null,
  }
}

describe('claveDe', () => {
  it('es estable: la misma referencia siempre produce la misma clave', () => {
    expect(claveDe('dispositivos/123/foto.jpg')).toBe(claveDe('dispositivos/123/foto.jpg'))
  })

  it('produce claves distintas para referencias distintas', () => {
    expect(claveDe('dispositivos/123/foto.jpg')).not.toBe(claveDe('dispositivos/456/foto.jpg'))
  })

  it('escapa la referencia para que las barras no rompan la clave', () => {
    const clave = claveDe('dispositivos/123/foto con espacios.jpg')
    expect(clave).not.toContain(' ')
    expect(clave.startsWith('https://')).toBe(true)
  })
})

describe('obtenerProgresoDescarga', () => {
  it('empieza sin una descarga en curso', () => {
    const progreso = obtenerProgresoDescarga()
    expect(progreso.enCurso).toBe(false)
    expect(progreso.total).toBe(0)
  })
})

describe('referenciasParaOffline', () => {
  beforeEach(async () => {
    await db.adjuntos.clear()
    await db.articulos.clear()
    await db.dispositivos.clear()
  })

  it('incluye la foto del dispositivo (tarea 114: antes faltaba)', async () => {
    await db.dispositivos.put(
      dispositivoDePrueba('dis-1', { referencia: 'dispositivos/dis-1/foto/x.jpg', nombre: 'x.jpg', tipo: 'image/jpeg' }),
    )
    expect(await referenciasParaOffline()).toEqual(['dispositivos/dis-1/foto/x.jpg'])
  })

  it('ignora la foto de un dispositivo eliminado', async () => {
    await db.dispositivos.put({
      ...dispositivoDePrueba('dis-1', { referencia: 'dispositivos/dis-1/foto/x.jpg', nombre: 'x.jpg', tipo: 'image/jpeg' }),
      eliminadoEn: new Date().toISOString(),
    })
    expect(await referenciasParaOffline()).toEqual([])
  })

  it('un dispositivo sin foto no aporta ninguna referencia', async () => {
    await db.dispositivos.put(dispositivoDePrueba('dis-1'))
    expect(await referenciasParaOffline()).toEqual([])
  })

  it('junta adjuntos, procedimiento y foto de dispositivo sin mezclarlos ni perder ninguno', async () => {
    await db.adjuntos.put({
      id: 'adj-1',
      entidadTipo: 'articulo',
      entidadId: 'art-1',
      nombre: 'manual.pdf',
      tipo: 'application/pdf',
      referencia: 'articulos/art-1/manual.pdf',
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      eliminadoEn: null,
    })
    await db.articulos.put(
      articuloDePrueba('art-1', {
        descripcion: '',
        portada: { referencia: 'articulos/art-1/portada/x.jpg', nombre: 'x.jpg', tipo: 'image/jpeg' },
        objetivoGeneral: '',
        requisitos: [],
        pasos: [
          {
            id: 'p1',
            titulo: '',
            objetivo: '',
            bloques: [],
            adjuntos: [],
            vinculoProtegido: null,
            subArticuloId: null,
            subArticuloTitulo: '',
            solucionArticuloId: null,
            solucionArticuloTitulo: '',
          },
        ],
        verificacionFinal: [],
        tiempoEstimadoMin: null,
        dificultad: null,
      }),
    )
    await db.dispositivos.put(
      dispositivoDePrueba('dis-1', { referencia: 'dispositivos/dis-1/foto/y.jpg', nombre: 'y.jpg', tipo: 'image/jpeg' }),
    )

    const referencias = await referenciasParaOffline()
    expect(new Set(referencias)).toEqual(
      new Set(['articulos/art-1/manual.pdf', 'articulos/art-1/portada/x.jpg', 'dispositivos/dis-1/foto/y.jpg']),
    )
  })
})
