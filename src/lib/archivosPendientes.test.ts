import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  calcularHashArchivo,
  contarArchivosPendientes,
  eliminarArchivoPendiente,
  encolarArchivo,
  esErrorDeRed,
  procesarArchivosPendientes,
  referenciaEnUso,
  subirConDeduplicacion,
} from './archivosPendientes'
import { nuevoId } from './repositorio'

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

function archivoDePrueba(contenido = 'foto'): Blob {
  return new Blob([contenido], { type: 'image/jpeg' })
}

describe('encolarArchivo', () => {
  it('guarda el contenido en la base local con su referencia como clave', async () => {
    await encolarArchivo('dispositivos/d1/123-foto.jpg', archivoDePrueba(), 'foto.jpg')

    const guardado = await db.archivosPendientes.get('dispositivos/d1/123-foto.jpg')
    expect(guardado).toBeDefined()
    expect(guardado?.nombre).toBe('foto.jpg')
    expect(guardado?.tipo).toBe('image/jpeg')
    expect(guardado?.error).toBeNull()
    expect(await guardado?.contenido.text()).toBe('foto')
  })

  it('volver a encolar la misma referencia no duplica', async () => {
    await encolarArchivo('ref-1', archivoDePrueba(), 'a.jpg')
    await encolarArchivo('ref-1', archivoDePrueba('otra'), 'a.jpg')
    expect((await contarArchivosPendientes()).total).toBe(1)
  })
})

// Bucket parametrizable (fase P5, "Archivo seguro"): la Boveda sube a
// un bucket propio y privado (archivos_boveda), distinto del bucket
// por defecto de fotos/manuales (adjuntos). Sin pasar `bucket` explicito
// nada cambia para los adjuntos normales (regresion).
describe('bucket parametrizable', () => {
  it('sin bucket explicito, encolarArchivo sigue guardando "adjuntos" (regresión)', async () => {
    await encolarArchivo('dispositivos/d1/foto.jpg', archivoDePrueba(), 'foto.jpg')
    const guardado = await db.archivosPendientes.get('dispositivos/d1/foto.jpg')
    expect(guardado?.bucket).toBe('adjuntos')
  })

  it('con un bucket explicito, lo guarda y lo usa al procesar la cola', async () => {
    await encolarArchivo('credenciales/c1/licencia.pdf', archivoDePrueba(), 'licencia.pdf', 'archivos_boveda')
    const guardado = await db.archivosPendientes.get('credenciales/c1/licencia.pdf')
    expect(guardado?.bucket).toBe('archivos_boveda')

    const bucketsUsados: string[] = []
    await procesarArchivosPendientes(async (_referencia, _contenido, _tipo, bucket) => {
      bucketsUsados.push(bucket)
      return null
    })
    expect(bucketsUsados).toEqual(['archivos_boveda'])
  })

  it('una fila vieja sin bucket (guardada antes de este campo) se procesa como "adjuntos"', async () => {
    // Simula una fila de antes de la fase P5, que nunca tuvo `bucket`
    // (put directo a la tabla, sin pasar por encolarArchivo).
    await db.archivosPendientes.put({
      referencia: 'ref-vieja',
      contenido: archivoDePrueba(),
      tipo: 'image/jpeg',
      nombre: 'a.jpg',
      creadoEn: new Date().toISOString(),
      error: null,
      intentos: 0,
    })

    const bucketsUsados: string[] = []
    await procesarArchivosPendientes(async (_referencia, _contenido, _tipo, bucket) => {
      bucketsUsados.push(bucket)
      return null
    })
    expect(bucketsUsados).toEqual(['adjuntos'])
  })
})

describe('eliminarArchivoPendiente', () => {
  it('saca el archivo de la cola (por ejemplo, al eliminar su adjunto)', async () => {
    await encolarArchivo('ref-1', archivoDePrueba(), 'a.jpg')
    await eliminarArchivoPendiente('ref-1')
    expect((await contarArchivosPendientes()).total).toBe(0)
  })
})

describe('procesarArchivosPendientes', () => {
  it('sube en orden de llegada y saca de la cola los que suben bien', async () => {
    await encolarArchivo('ref-b', archivoDePrueba(), 'b.jpg')
    await db.archivosPendientes.update('ref-b', { creadoEn: '2026-07-03T10:00:00Z' })
    await encolarArchivo('ref-a', archivoDePrueba(), 'a.jpg')
    await db.archivosPendientes.update('ref-a', { creadoEn: '2026-07-03T09:00:00Z' })

    const subidos: string[] = []
    await procesarArchivosPendientes(async (referencia) => {
      subidos.push(referencia)
      return null
    })

    expect(subidos).toEqual(['ref-a', 'ref-b'])
    expect((await contarArchivosPendientes()).total).toBe(0)
  })

  it('con un corte de red se interrumpe y todo queda para la próxima pasada', async () => {
    await encolarArchivo('ref-1', archivoDePrueba(), 'a.jpg')
    await encolarArchivo('ref-2', archivoDePrueba(), 'b.jpg')

    await expect(
      procesarArchivosPendientes(async () => ({ message: 'Failed to fetch' })),
    ).rejects.toThrow('Sin conexión')

    expect((await contarArchivosPendientes()).total).toBe(2)
  })

  it('un rechazo del servidor se anota en el archivo y no frena a los demás', async () => {
    await encolarArchivo('ref-mala', archivoDePrueba(), 'a.jpg')
    await db.archivosPendientes.update('ref-mala', { creadoEn: '2026-07-03T09:00:00Z' })
    await encolarArchivo('ref-buena', archivoDePrueba(), 'b.jpg')
    await db.archivosPendientes.update('ref-buena', { creadoEn: '2026-07-03T10:00:00Z' })

    await procesarArchivosPendientes(async (referencia) =>
      referencia === 'ref-mala' ? { message: 'Payload too large' } : null,
    )

    const conteo = await contarArchivosPendientes()
    expect(conteo).toEqual({ total: 1, conError: 1 })
    const malo = await db.archivosPendientes.get('ref-mala')
    expect(malo?.error).toBe('Payload too large')
    expect(malo?.intentos).toBe(1)
  })

  it('un reintento exitoso limpia el archivo que había fallado', async () => {
    await encolarArchivo('ref-1', archivoDePrueba(), 'a.jpg')
    await procesarArchivosPendientes(async () => ({ message: 'permiso denegado' }))
    expect((await contarArchivosPendientes()).conError).toBe(1)

    await procesarArchivosPendientes(async () => null)
    expect((await contarArchivosPendientes()).total).toBe(0)
  })
})

describe('esErrorDeRed', () => {
  it('reconoce los mensajes típicos de fallo de conexión', () => {
    expect(esErrorDeRed('TypeError: Failed to fetch')).toBe(true)
    expect(esErrorDeRed('NetworkError when attempting to fetch resource')).toBe(true)
    expect(esErrorDeRed('Sin conexión con el servidor')).toBe(true)
    expect(esErrorDeRed('Payload too large')).toBe(false)
    expect(esErrorDeRed('new row violates row-level security policy')).toBe(false)
  })
})

// Deduplicacion por hash de adjuntos (tarea 123, decision D3 de
// PROPUESTA_JORNADA_TECNICO.md).
describe('calcularHashArchivo', () => {
  it('es determinista: el mismo contenido da siempre el mismo hash', async () => {
    const a = await calcularHashArchivo(archivoDePrueba('hola'))
    const b = await calcularHashArchivo(archivoDePrueba('hola'))
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('depende solo del contenido, no del tipo MIME ni del nombre', async () => {
    const comoImagen = new Blob(['mismo contenido'], { type: 'image/jpeg' })
    const comoPdf = new Blob(['mismo contenido'], { type: 'application/pdf' })
    expect(await calcularHashArchivo(comoImagen)).toBe(await calcularHashArchivo(comoPdf))
  })

  it('un contenido distinto da un hash distinto', async () => {
    const a = await calcularHashArchivo(archivoDePrueba('uno'))
    const b = await calcularHashArchivo(archivoDePrueba('otro'))
    expect(a).not.toBe(b)
  })
})

function adjuntoDePrueba(referencia: string, eliminadoEn: string | null = null) {
  return {
    id: nuevoId(),
    entidadTipo: 'articulo' as const,
    entidadId: nuevoId(),
    nombre: 'manual.pdf',
    tipo: 'application/pdf',
    referencia,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn,
  }
}

function dispositivoDePrueba(referenciaFoto: string | null, eliminadoEn: string | null = null) {
  return {
    id: nuevoId(),
    categoriaId: 'cat-1',
    nombre: 'Impresora',
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
    foto: referenciaFoto ? { referencia: referenciaFoto, nombre: 'foto.jpg', tipo: 'image/jpeg' } : null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    eliminadoEn,
  }
}

describe('referenciaEnUso', () => {
  it('detecta un adjunto activo con esa referencia', async () => {
    await db.adjuntos.put(adjuntoDePrueba('compartidos/hash-1'))
    expect(await referenciaEnUso('compartidos/hash-1')).toBe(true)
  })

  it('ignora un adjunto ya eliminado', async () => {
    await db.adjuntos.put(adjuntoDePrueba('compartidos/hash-1', new Date().toISOString()))
    expect(await referenciaEnUso('compartidos/hash-1')).toBe(false)
  })

  it('detecta la foto activa de un dispositivo', async () => {
    await db.dispositivos.put(dispositivoDePrueba('compartidos/hash-2'))
    expect(await referenciaEnUso('compartidos/hash-2')).toBe(true)
  })

  it('ignora la foto de un dispositivo ya eliminado', async () => {
    await db.dispositivos.put(dispositivoDePrueba('compartidos/hash-2', new Date().toISOString()))
    expect(await referenciaEnUso('compartidos/hash-2')).toBe(false)
  })

  it('sin ninguna coincidencia, no esta en uso', async () => {
    expect(await referenciaEnUso('compartidos/inexistente')).toBe(false)
  })
})

describe('subirConDeduplicacion', () => {
  it('reutiliza la referencia si el contenido ya existe en un adjunto activo, sin encolar', async () => {
    const contenido = archivoDePrueba('manual compartido')
    const hash = await calcularHashArchivo(contenido)
    await db.adjuntos.put(adjuntoDePrueba(`compartidos/${hash}`))

    const resultado = await subirConDeduplicacion(contenido, 'manual.pdf')

    expect(resultado.referencia).toBe(`compartidos/${hash}`)
    expect(resultado.reutilizado).toBe(true)
    expect(resultado.resultado).toBe('subido')
    expect((await contarArchivosPendientes()).total).toBe(0)
  })

  it('reutiliza la referencia si coincide con la foto activa de un dispositivo', async () => {
    const contenido = archivoDePrueba('foto compartida')
    const hash = await calcularHashArchivo(contenido)
    await db.dispositivos.put(dispositivoDePrueba(`compartidos/${hash}`))

    const resultado = await subirConDeduplicacion(contenido, 'foto.jpg')

    expect(resultado.reutilizado).toBe(true)
    expect((await contarArchivosPendientes()).total).toBe(0)
  })

  it('sin coincidencia previa, arma una referencia por hash y sigue el camino normal (sin conexión: encola)', async () => {
    const contenido = archivoDePrueba('archivo nuevo')
    const hash = await calcularHashArchivo(contenido)

    const resultado = await subirConDeduplicacion(contenido, 'nuevo.pdf')

    expect(resultado.referencia).toBe(`compartidos/${hash}`)
    expect(resultado.reutilizado).toBe(false)
    expect(resultado.resultado).toBe('encolado')
    const encolado = await db.archivosPendientes.get(`compartidos/${hash}`)
    expect(encolado).toBeDefined()
  })

  it('dos archivos con el mismo contenido arman la misma referencia', async () => {
    const r1 = await subirConDeduplicacion(archivoDePrueba('contenido igual'), 'a.pdf')
    const r2 = await subirConDeduplicacion(archivoDePrueba('contenido igual'), 'b.pdf')
    expect(r1.referencia).toBe(r2.referencia)
  })
})
