import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Articulo, type Dispositivo } from './db'
import { eliminarRegistro, guardarRegistro, nuevoId, registrarIntervencion } from './repositorio'

function dispositivoDePrueba(id: string): Omit<Dispositivo, 'updatedAt' | 'updatedBy' | 'eliminadoEn'> {
  return {
    id,
    categoriaId: nuevoId(),
    nombre: 'Cámara bodega norte',
    marca: 'Hikvision',
    modelo: 'DS-2CD1023',
    serial: 'SN-001',
    placaInventario: 'INV-100',
    ubicacion: 'Bodega norte',
    ubicacionId: null,
    ip: '192.168.1.50',
    estado: 'Operativa',
    observaciones: '',
    detalles: { puerto: '12', switch: 'SW-Bodega' },
    foto: null,
  }
}

function articuloDePrueba(id: string): Omit<Articulo, 'updatedAt' | 'updatedBy' | 'eliminadoEn'> {
  return {
    id,
    categoriaId: nuevoId(),
    titulo: 'La impresora no imprime',
    tipo: 'problema_frecuente',
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
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

describe('guardarRegistro', () => {
  it('al crear guarda la ficha, una entrada de historial y encola la subida', async () => {
    const id = nuevoId()
    await guardarRegistro('dispositivos', dispositivoDePrueba(id), 'Alta inicial')

    const guardado = await db.dispositivos.get(id)
    expect(guardado?.nombre).toBe('Cámara bodega norte')
    expect(guardado?.eliminadoEn).toBeNull()
    expect(guardado?.updatedAt).toBeTruthy()

    const historial = await db.historial.toArray()
    expect(historial).toHaveLength(1)
    expect(historial[0]).toMatchObject({
      entidadTipo: 'dispositivo',
      entidadId: id,
      campo: 'creacion',
      valorNuevo: 'Cámara bodega norte',
      motivo: 'Alta inicial',
    })

    const pendientes = await db.cambiosPendientes.toArray()
    expect(pendientes.filter((c) => c.tabla === 'dispositivos')).toHaveLength(1)
    expect(pendientes.filter((c) => c.tabla === 'historial')).toHaveLength(1)
  })

  it('al editar registra una entrada por cada campo modificado', async () => {
    const id = nuevoId()
    const original = dispositivoDePrueba(id)
    await guardarRegistro('dispositivos', original)

    await guardarRegistro(
      'dispositivos',
      { ...original, ip: '192.168.1.60', ubicacion: 'Bodega sur' },
      'Reubicación del equipo',
    )

    const historial = await db.historial.toArray()
    const cambios = historial.filter((c) => c.campo === 'ip' || c.campo === 'ubicacion')
    expect(cambios).toHaveLength(2)

    const cambioIp = cambios.find((c) => c.campo === 'ip')
    expect(cambioIp?.valorAnterior).toBe('192.168.1.50')
    expect(cambioIp?.valorNuevo).toBe('192.168.1.60')
    expect(cambioIp?.motivo).toBe('Reubicación del equipo')
  })

  it('varias ediciones sin conexión se agrupan en un solo cambio pendiente', async () => {
    const id = nuevoId()
    const original = dispositivoDePrueba(id)
    await guardarRegistro('dispositivos', original)
    await guardarRegistro('dispositivos', { ...original, ip: '192.168.1.61' })
    await guardarRegistro('dispositivos', { ...original, ip: '192.168.1.62' })

    const pendientes = await db.cambiosPendientes.where('tabla').equals('dispositivos').toArray()
    expect(pendientes).toHaveLength(1)
    expect((pendientes[0].payload as Dispositivo).ip).toBe('192.168.1.62')
  })

  it('si no cambió nada no registra historial ni encola subidas', async () => {
    const id = nuevoId()
    const original = dispositivoDePrueba(id)
    await guardarRegistro('dispositivos', original)
    const historialAntes = await db.historial.count()
    const pendientesAntes = await db.cambiosPendientes.count()

    await guardarRegistro('dispositivos', original)

    expect(await db.historial.count()).toBe(historialAntes)
    expect(await db.cambiosPendientes.count()).toBe(pendientesAntes)
  })

  it('guarda un cambio que solo toca un campo sin historial (ubicacionId)', async () => {
    // Grupo N3: vincular una ubicacion cuando el texto ya coincidia con
    // su nombre cambia solo ubicacionId (suprimido del historial). El
    // guardado debe persistir igual, aunque no genere entradas.
    const id = nuevoId()
    const original = dispositivoDePrueba(id)
    await guardarRegistro('dispositivos', original)
    const historialAntes = await db.historial.count()

    await guardarRegistro('dispositivos', { ...original, ubicacionId: 'ubi-1' })

    const guardado = await db.dispositivos.get(id)
    expect(guardado?.ubicacionId).toBe('ubi-1')
    // No genera historial (el vinculo se registra via la copia legible),
    // pero si encola la subida del cambio real.
    expect(await db.historial.count()).toBe(historialAntes)
    const pendientes = await db.cambiosPendientes.where('[tabla+entidadId]').equals(['dispositivos', id]).toArray()
    expect(pendientes).toHaveLength(1)
    expect((pendientes[0].payload as Dispositivo).ubicacionId).toBe('ubi-1')
  })

  it('nunca deja valores de credenciales legibles en el historial', async () => {
    const id = nuevoId()
    await guardarRegistro('credenciales', {
      id,
      titulo: 'Router principal',
      categoria: 'Redes',
      datosCifrados: 'bloque-cifrado-original',
      venceEn: null,
      dispositivos: [],
    })
    await guardarRegistro('credenciales', {
      id,
      titulo: 'Router principal',
      categoria: 'Redes',
      datosCifrados: 'bloque-cifrado-nuevo',
      venceEn: null,
      dispositivos: [],
    })

    const cambio = (await db.historial.toArray()).find((c) => c.campo === 'datosCifrados')
    expect(cambio?.valorAnterior).toBe('(cifrado)')
    expect(cambio?.valorNuevo).toBe('(cifrado)')
  })
})

describe('eliminarRegistro', () => {
  it('marca la ficha como eliminada sin borrarla y lo registra', async () => {
    const id = nuevoId()
    await guardarRegistro('dispositivos', dispositivoDePrueba(id))

    await eliminarRegistro('dispositivos', id, 'Equipo dado de baja')

    const eliminado = await db.dispositivos.get(id)
    expect(eliminado?.eliminadoEn).toBeTruthy()

    const entrada = (await db.historial.toArray()).find((c) => c.campo === 'eliminacion')
    expect(entrada?.valorAnterior).toBe('Cámara bodega norte')
    expect(entrada?.motivo).toBe('Equipo dado de baja')
  })

  it('eliminar dos veces no duplica registros', async () => {
    const id = nuevoId()
    await guardarRegistro('dispositivos', dispositivoDePrueba(id))
    await eliminarRegistro('dispositivos', id)
    const historialAntes = await db.historial.count()

    await eliminarRegistro('dispositivos', id)

    expect(await db.historial.count()).toBe(historialAntes)
  })
})

describe('registrarIntervencion', () => {
  it('crea una entrada de historial manual y la encola para subir', async () => {
    const dispositivoId = nuevoId()
    const entradaId = await registrarIntervencion(
      dispositivoId,
      'Cambio de disco duro',
      'Disco original con sectores dañados',
    )

    const entrada = await db.historial.get(entradaId)
    expect(entrada).toMatchObject({
      entidadTipo: 'dispositivo',
      entidadId: dispositivoId,
      campo: 'intervencion',
      valorNuevo: 'Cambio de disco duro',
      motivo: 'Disco original con sectores dañados',
    })

    const pendientes = await db.cambiosPendientes.where('tabla').equals('historial').toArray()
    expect(pendientes.some((c) => c.entidadId === entradaId)).toBe(true)
  })

  it('no exige un dispositivo previamente guardado', async () => {
    const dispositivoId = nuevoId()
    await expect(registrarIntervencion(dispositivoId, 'Configuración de nuevo usuario')).resolves.toBeTruthy()
  })
})

describe('campo dispositivosAfectados (lista de objetos)', () => {
  it('detecta el cambio aunque la lista tenga la misma cantidad de elementos', async () => {
    // Antes de la corrección, un array de objetos se comparaba con
    // Array.prototype.join, que vuelve cualquier objeto el texto fijo
    // "[object Object]": cambiar de dispositivo sin cambiar la
    // cantidad de vínculos no generaba ninguna entrada de historial.
    const id = nuevoId()
    const original = articuloDePrueba(id)
    await guardarRegistro('articulos', {
      ...original,
      dispositivosAfectados: [{ id: 'd1', nombre: 'Impresora recepción' }],
    })

    await guardarRegistro('articulos', {
      ...original,
      dispositivosAfectados: [{ id: 'd2', nombre: 'Impresora bodega' }],
    })

    const cambio = (await db.historial.toArray()).find((c) => c.campo === 'dispositivosAfectados')
    expect(cambio).toBeDefined()
    expect(cambio?.valorAnterior).toBe('Impresora recepción')
    expect(cambio?.valorNuevo).toBe('Impresora bodega')
  })

  it('no registra nada si la lista de dispositivos afectados no cambió', async () => {
    const id = nuevoId()
    const original = {
      ...articuloDePrueba(id),
      dispositivosAfectados: [{ id: 'd1', nombre: 'Impresora recepción' }],
    }
    await guardarRegistro('articulos', original)
    const historialAntes = await db.historial.count()

    await guardarRegistro('articulos', original)

    expect(await db.historial.count()).toBe(historialAntes)
  })
})

describe('adjuntos', () => {
  it('el historial de un adjunto se registra sobre la ficha a la que pertenece', async () => {
    const dispositivoId = nuevoId()
    await guardarRegistro('adjuntos', {
      id: nuevoId(),
      entidadTipo: 'dispositivo',
      entidadId: dispositivoId,
      nombre: 'manual-camara.pdf',
      tipo: 'application/pdf',
      referencia: 'adjuntos/manual-camara.pdf',
    })

    const entrada = (await db.historial.toArray()).find((c) => c.campo === 'adjunto')
    expect(entrada?.entidadTipo).toBe('dispositivo')
    expect(entrada?.entidadId).toBe(dispositivoId)
    expect(entrada?.valorNuevo).toBe('manual-camara.pdf')
  })
})
