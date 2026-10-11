import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'

// Prueba de integracion del upgrade a la version 22 (las autorizaciones
// de facturacion de los POS, tarea 321). Mismo planteamiento que la de la
// 21: se construye a mano la base tal como la tienen hoy los telefonos
// del equipo (version 21, con un mantenimiento guardado), se cierra, y
// recien entonces se toca `db`. La 22 solo suma la tabla
// `autorizaciones_facturacion`: nada de lo que ya estaba guardado puede
// cambiar ni encolarse.

const ESQUEMA_V21 = {
  perfiles: 'id',
  categorias: 'id, orden',
  articulos: 'id, categoriaId, tipo, updatedAt',
  dispositivos: 'id, categoriaId, ubicacion, estado, updatedAt',
  credenciales: 'id, categoria, updatedAt',
  historial: 'id, [entidadTipo+entidadId], fechaHora',
  adjuntos: 'id, [entidadTipo+entidadId]',
  cambiosPendientes: 'id, tabla, [tabla+entidadId], creadoEn',
  syncMeta: 'clave',
  recientes: 'clave, visitadoEn',
  progresoPasos: 'articuloId',
  archivosPendientes: 'referencia, creadoEn',
  conexiones: 'id, origenId, destinoId, updatedAt',
  bovedaMeta: 'id',
  seguridadApp: 'id',
  diagnosticos: 'id, categoriaId, updatedAt',
  ejecuciones_diagnostico: 'id, diagnosticoId',
  progresoDiagnostico: 'diagnosticoId',
  accesos_boveda: 'id, credencialId',
  ubicaciones: 'id, updatedAt',
  favoritos: 'clave, marcadoEn',
  campos_protegidos: 'id, dispositivoId, updatedAt',
  personas: 'id, updatedAt',
  preferenciasTecnico: 'id',
  borradoresArticulo: 'articuloId, actualizadoEn',
  referencias: 'id, tipo, categoria, plataforma, updatedAt',
  mantenimientos: 'id, dispositivoId, updatedAt',
}

const EQUIPO = {
  id: 'd1',
  categoriaId: 'c1',
  nombre: 'Equipo de prueba',
  marca: '',
  modelo: '',
  serial: '',
  placaInventario: '',
  ubicacion: '',
  ubicacionId: null,
  responsable: '',
  responsableId: null,
  reemplazaA: null,
  ip: '',
  estado: 'Operativo',
  observaciones: '',
  detalles: {},
  foto: null,
  updatedAt: '2026-10-09T00:00:00.000Z',
  updatedBy: null,
  eliminadoEn: null,
}

const MANTENIMIENTO = {
  id: 'm1',
  dispositivoId: 'd1',
  tipo: 'preventivo',
  fechaProgramada: '2026-10-20',
  estado: 'programado',
  tecnico: '',
  fechaRealizada: null,
  resultado: '',
  observaciones: '',
  historialId: null,
  fuente: '',
  validacion: 'confirmado',
  updatedAt: '2026-10-09T00:00:00.000Z',
  updatedBy: null,
  eliminadoEn: null,
}

describe('upgrade a la version 22', () => {
  beforeAll(async () => {
    const vieja = new Dexie('soluciones-it')
    vieja.version(21).stores(ESQUEMA_V21)
    await vieja.open()
    await vieja.table('dispositivos').put(EQUIPO)
    await vieja.table('mantenimientos').put(MANTENIMIENTO)
    vieja.close()
  })

  it('la tabla de autorizaciones existe, vacia', async () => {
    expect(await db.autorizaciones_facturacion.count()).toBe(0)
  })

  it('se consulta por POS aunque una autorizacion tenga varios (indice multiEntry)', async () => {
    await db.autorizaciones_facturacion.put({
      id: 'a1',
      dispositivoIds: ['d1', 'd2'],
      prefijo: 'PRB',
      formulario: '',
      rangoDesde: null,
      rangoHasta: null,
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
      updatedAt: '2026-10-10T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })
    expect((await db.autorizaciones_facturacion.where('dispositivoIds').equals('d2').toArray()).map((a) => a.id)).toEqual([
      'a1',
    ])
    expect(await db.autorizaciones_facturacion.where('dispositivoIds').equals('d3').count()).toBe(0)
    await db.autorizaciones_facturacion.clear()
  })

  it('no toca lo que ya estaba guardado', async () => {
    expect(await db.dispositivos.get('d1')).toEqual(EQUIPO)
    expect(await db.mantenimientos.get('m1')).toEqual(MANTENIMIENTO)
  })

  it('no encola ningun cambio', async () => {
    expect(await db.cambiosPendientes.count()).toBe(0)
  })

  it('deja la base en la version 22 o posterior', () => {
    expect(db.verno).toBeGreaterThanOrEqual(22)
  })
})
