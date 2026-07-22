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
    responsable: '',
    responsableId: null,
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
    // Una creacion no tiene ninguna version previa del servidor con la
    // que pueda haber conflicto (detector de conflictos, sync.ts).
    const pendienteDispositivo = pendientes.find((c) => c.tabla === 'dispositivos')
    expect(pendienteDispositivo?.baseActualizadoEn).toBeNull()
  })

  it('al editar un equipo ya sincronizado, el cambio pendiente guarda su updated_at como base', async () => {
    const id = nuevoId()
    const original = dispositivoDePrueba(id)
    await guardarRegistro('dispositivos', original)
    const guardadoOriginal = await db.dispositivos.get(id)
    // Simula que la creacion ya se subio y se quito de la cola (sync
    // exitoso), como pasaria en la practica antes de la siguiente edicion.
    await db.cambiosPendientes.where('[tabla+entidadId]').equals(['dispositivos', id]).delete()

    await guardarRegistro('dispositivos', { ...original, ip: '192.168.1.60' })

    const pendiente = await db.cambiosPendientes
      .where('[tabla+entidadId]')
      .equals(['dispositivos', id])
      .first()
    expect(pendiente?.baseActualizadoEn).toBe(guardadoOriginal?.updatedAt)
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

  it('conserva la base de la primera edición sin conexión de un equipo ya sincronizado', async () => {
    const id = nuevoId()
    const original = dispositivoDePrueba(id)
    await guardarRegistro('dispositivos', original)
    const guardadoOriginal = await db.dispositivos.get(id)
    // Simula que la creacion ya se subio y se quito de la cola: la
    // racha de ediciones sin conexion empieza desde un equipo sincronizado.
    await db.cambiosPendientes.where('[tabla+entidadId]').equals(['dispositivos', id]).delete()

    await guardarRegistro('dispositivos', { ...original, ip: '192.168.1.61' })
    await guardarRegistro('dispositivos', { ...original, ip: '192.168.1.62' })

    const pendientes = await db.cambiosPendientes.where('tabla').equals('dispositivos').toArray()
    expect(pendientes).toHaveLength(1)
    expect((pendientes[0].payload as Dispositivo).ip).toBe('192.168.1.62')
    // La base sigue siendo la version del servidor de la que partio la
    // PRIMERA edicion sin conexion, no se pisa con la segunda vuelta.
    expect(pendientes[0].baseActualizadoEn).toBe(guardadoOriginal?.updatedAt)
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
      tipo: 'cuenta',
      datosCifrados: 'bloque-cifrado-original',
      venceEn: null,
      dispositivos: [],
      archivo: null,
    })
    await guardarRegistro('credenciales', {
      id,
      titulo: 'Router principal',
      categoria: 'Redes',
      tipo: 'cuenta',
      datosCifrados: 'bloque-cifrado-nuevo',
      venceEn: null,
      dispositivos: [],
      archivo: null,
    })

    const cambio = (await db.historial.toArray()).find((c) => c.campo === 'datosCifrados')
    expect(cambio?.valorAnterior).toBe('(cifrado)')
    expect(cambio?.valorNuevo).toBe('(cifrado)')
  })

  it('nunca deja el valor de un campo protegido legible en el historial', async () => {
    const id = nuevoId()
    await guardarRegistro('campos_protegidos', {
      id,
      dispositivoId: 'd1',
      nombre: 'PIN de impresión',
      tipo: 'pin',
      valorCifrado: 'v1.600000.sal.iv.bloque-original',
      orden: 0,
    })
    await guardarRegistro('campos_protegidos', {
      id,
      dispositivoId: 'd1',
      nombre: 'PIN de impresión',
      tipo: 'pin',
      valorCifrado: 'v1.600000.sal.iv.bloque-nuevo',
      orden: 0,
    })

    const cambio = (await db.historial.toArray()).find((c) => c.campo === 'valorCifrado')
    expect(cambio?.valorAnterior).toBe('(cifrado)')
    expect(cambio?.valorNuevo).toBe('(cifrado)')
  })

  it('el historial de un campo protegido cuelga del campo, nunca del dispositivo', async () => {
    // Es la garantia que hace cumplible la RLS: las entradas de
    // 'dispositivo' las lee cualquier tecnico, las de 'campo_protegido'
    // solo quien tiene permiso de boveda. Colgarlas del equipo
    // filtraria el nombre del dato protegido y quien lo cambio.
    const id = nuevoId()
    await guardarRegistro('campos_protegidos', {
      id,
      dispositivoId: 'd1',
      nombre: 'Contraseña administrador',
      tipo: 'contrasena',
      valorCifrado: 'v1.600000.sal.iv.bloque',
      orden: 0,
    })

    const entradas = await db.historial.toArray()
    expect(entradas).toHaveLength(1)
    expect(entradas[0].entidadTipo).toBe('campo_protegido')
    expect(entradas[0].entidadId).toBe(id)
    expect(entradas.some((e) => e.entidadTipo === 'dispositivo')).toBe(false)
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
