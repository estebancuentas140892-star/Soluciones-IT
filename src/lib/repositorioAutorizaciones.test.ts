import { beforeEach, describe, expect, it } from 'vitest'
import { db, type AutorizacionFacturacion } from './db'
import { eliminarRegistro, guardarRegistro, nuevoId } from './repositorio'
import { aEntidadLocal, aFilaRemota } from './tablas'

// Escribir una autorización de facturación (tarea 321): pasa por
// `guardarRegistro`, queda en la base local, se encola para subir (así
// funciona sin conexión) y deja su constancia en el historial de CADA POS
// que la usa. Una autorización sin POS no cuelga de ningún equipo.
// Datos inventados.

type Nueva = Omit<AutorizacionFacturacion, 'updatedAt' | 'updatedBy' | 'eliminadoEn'>

function autorizacionDePrueba(cambios: Partial<Nueva> = {}): Nueva {
  return {
    id: nuevoId(),
    dispositivoIds: ['pos-1'],
    prefijo: 'PRB',
    formulario: '',
    rangoDesde: 3000,
    rangoHasta: 8000,
    fechaFormalizacion: null,
    vigenciaReportada: '',
    vencimientoDocumentado: null,
    vencimientoConfirmado: null,
    consecutivoActual: null,
    consecutivoLeidoEn: null,
    consecutivoFuente: '',
    estado: 'documentada',
    fuente: 'Documento de prueba',
    verificadoEn: null,
    verificacionFuente: '',
    observaciones: '',
    evidenciaAdjuntoId: null,
    ...cambios,
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

describe('registrar y editar', () => {
  it('registrar la guarda, deja una entrada en el historial de su POS y encola las dos', async () => {
    const nueva = autorizacionDePrueba()
    await guardarRegistro('autorizaciones_facturacion', nueva)

    expect((await db.autorizaciones_facturacion.get(nueva.id))?.prefijo).toBe('PRB')
    const entradas = await db.historial.toArray()
    expect(entradas).toEqual([
      expect.objectContaining({
        entidadTipo: 'dispositivo',
        entidadId: 'pos-1',
        campo: 'autorizacion_facturacion',
        valorAnterior: '',
        valorNuevo: 'PRB · 3.000 a 8.000 · Documentada, por validar',
      }),
    ])
    const cola = await db.cambiosPendientes.toArray()
    expect(cola.map((c) => c.tabla).sort()).toEqual(['autorizaciones_facturacion', 'historial'])
  })

  it('con dos POS, una entrada en cada uno', async () => {
    await guardarRegistro('autorizaciones_facturacion', autorizacionDePrueba({ dispositivoIds: ['pos-1', 'pos-2'] }))
    const entradas = await db.historial.toArray()
    expect(entradas.map((e) => e.entidadId).sort()).toEqual(['pos-1', 'pos-2'])
  })

  it('sin POS (PNTE): se guarda y se encola, sin colgarla de ningún equipo', async () => {
    const sinPos = autorizacionDePrueba({ dispositivoIds: [], rangoDesde: null, rangoHasta: null })
    await guardarRegistro('autorizaciones_facturacion', sinPos)
    expect(await db.autorizaciones_facturacion.get(sinPos.id)).toBeTruthy()
    expect(await db.historial.count()).toBe(0)
    expect((await db.cambiosPendientes.toArray()).map((c) => c.tabla)).toEqual(['autorizaciones_facturacion'])
  })

  it('confirmarla y leer el consecutivo deja el antes y el después, con el motivo', async () => {
    const nueva = autorizacionDePrueba()
    await guardarRegistro('autorizaciones_facturacion', nueva)
    const guardada = (await db.autorizaciones_facturacion.get(nueva.id)) as AutorizacionFacturacion
    await guardarRegistro(
      'autorizaciones_facturacion',
      {
        ...guardada,
        estado: 'confirmada',
        verificadoEn: '2026-10-09',
        verificacionFuente: 'Consulta de prueba',
        consecutivoActual: 3500,
        consecutivoLeidoEn: '2026-10-09',
        consecutivoFuente: 'Lectura de prueba',
      },
      'Comprobada en sitio',
    )
    const cambio = (await db.historial.toArray()).find((e) => e.valorAnterior !== '')
    expect(cambio).toMatchObject({
      entidadId: 'pos-1',
      valorAnterior: 'PRB · 3.000 a 8.000 · Documentada, por validar',
      valorNuevo: 'PRB · 3.000 a 8.000 · Confirmada · consecutivo 3.500 leído el 9 oct 2026',
      motivo: 'Comprobada en sitio',
    })
  })

  it('cambiar de POS: el que la deja y el que la recibe quedan anotados; el que sigue, solo si algo cambió', async () => {
    const nueva = autorizacionDePrueba({ dispositivoIds: ['pos-1', 'pos-2'] })
    await guardarRegistro('autorizaciones_facturacion', nueva)
    await db.historial.clear()
    const guardada = (await db.autorizaciones_facturacion.get(nueva.id)) as AutorizacionFacturacion
    await guardarRegistro('autorizaciones_facturacion', { ...guardada, dispositivoIds: ['pos-2', 'pos-3'] })

    const porPos = new Map((await db.historial.toArray()).map((e) => [e.entidadId, e]))
    expect([...porPos.keys()].sort()).toEqual(['pos-1', 'pos-3'])
    expect(porPos.get('pos-1')).toMatchObject({ valorNuevo: '' })
    expect(porPos.get('pos-3')).toMatchObject({ valorAnterior: '' })
  })

  it('eliminarla la quita de la ficha de cada POS, con su entrada', async () => {
    const nueva = autorizacionDePrueba({ dispositivoIds: ['pos-1', 'pos-2'] })
    await guardarRegistro('autorizaciones_facturacion', nueva)
    await db.historial.clear()
    await eliminarRegistro('autorizaciones_facturacion', nueva.id, 'Registrada por error')

    expect((await db.autorizaciones_facturacion.get(nueva.id))?.eliminadoEn).toBeTruthy()
    const entradas = await db.historial.toArray()
    expect(entradas.map((e) => e.entidadId).sort()).toEqual(['pos-1', 'pos-2'])
    for (const e of entradas) expect(e).toMatchObject({ valorNuevo: '', motivo: 'Registrada por error' })
  })
})

describe('sincronización', () => {
  it('la fila viaja con sus columnas y vuelve igual (lista de POS, números y nulos)', () => {
    const local = {
      ...autorizacionDePrueba({ dispositivoIds: ['pos-1', 'pos-2'], consecutivoActual: null }),
      updatedAt: '2026-10-10T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    }
    const fila = aFilaRemota('autorizaciones_facturacion', local)
    expect(fila).toMatchObject({
      dispositivo_ids: ['pos-1', 'pos-2'],
      prefijo: 'PRB',
      rango_desde: 3000,
      rango_hasta: 8000,
      consecutivo_actual: null,
      vencimiento_confirmado: null,
      estado: 'documentada',
    })
    // updated_at y updated_by los pone el servidor.
    expect(fila).not.toHaveProperty('updated_at')
    expect(aEntidadLocal('autorizaciones_facturacion', { ...fila, updated_at: local.updatedAt, updated_by: null })).toEqual(
      local,
    )
  })

  it('una fila remota sin lista de POS se lee como lista vacía, nunca como null', () => {
    const entidad = aEntidadLocal('autorizaciones_facturacion', { id: 'x', prefijo: 'PRB', fuente: 'f' })
    expect(entidad.dispositivoIds).toEqual([])
    expect(entidad.estado).toBe('documentada')
  })
})
