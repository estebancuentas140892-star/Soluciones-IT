import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'

// Prueba de integracion del upgrade a la version 21 (los mantenimientos
// de un equipo, tarea 320). Mismo planteamiento que las de las versiones
// 14, 18, 19 y 20: se construye a mano la base tal como la tienen hoy los
// telefonos del equipo (version 20), se cierra, y recien entonces se toca
// `db`. La 21 solo suma la tabla `mantenimientos`: nada de lo que ya
// estaba guardado puede cambiar ni encolarse.

// La 20 no cambio las tablas: su esquema es el de la 18.
const ESQUEMA_V20 = {
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

describe('upgrade a la version 21', () => {
  beforeAll(async () => {
    const vieja = new Dexie('soluciones-it')
    vieja.version(20).stores(ESQUEMA_V20)
    await vieja.open()
    await vieja.table('dispositivos').put(EQUIPO)
    vieja.close()
  })

  it('la tabla de mantenimientos existe, vacia, y se consulta por equipo', async () => {
    expect(await db.mantenimientos.count()).toBe(0)
    expect(await db.mantenimientos.where('dispositivoId').equals('d1').count()).toBe(0)
  })

  it('no toca lo que ya estaba guardado', async () => {
    expect(await db.dispositivos.get('d1')).toEqual(EQUIPO)
  })

  it('no encola ningun cambio', async () => {
    expect(await db.cambiosPendientes.count()).toBe(0)
  })

  it('deja la base en la version 21 o posterior', () => {
    expect(db.verno).toBeGreaterThanOrEqual(21)
  })
})
