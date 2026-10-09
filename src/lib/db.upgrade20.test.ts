import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'

// Prueba de integracion del upgrade a la version 20 (el area de la
// persona, tarea 317). Mismo planteamiento que las de las versiones 14,
// 18 y 19: se construye a mano la base tal como la tienen hoy los
// telefonos del equipo (version 19, con las personas guardadas SIN
// `area`), se cierra, y recien entonces se toca `db`.
//
// El caso que protege: agregar la columna en el servidor no cambia el
// `updated_at` de las personas que ya viven en cada telefono, asi que no
// se vuelven a descargar y se quedarian sin `area` para siempre. Y lo
// que NO debe hacer: deducir el area de las notas.

// La 19 no cambio las tablas: su esquema es el de la 18.
const ESQUEMA_V19 = {
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

describe('upgrade a la version 20', () => {
  beforeAll(async () => {
    const vieja = new Dexie('soluciones-it')
    vieja.version(19).stores(ESQUEMA_V19)
    await vieja.open()

    // Una persona tal como la guardo la version de la tarea 266, con el
    // area escrita en las notas como se hacia entonces.
    await vieja.table('personas').put({
      id: 'p1',
      nombre: 'Persona de prueba',
      notas: 'Control Interno, ext. 000',
      estado: 'activa',
      fechaIngreso: '2025-03-12',
      fechaRetiro: null,
      motivoRetiro: '',
      updatedAt: '2026-09-23T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })

    vieja.close()
  })

  it('la persona vieja queda con el area vacia', async () => {
    const p1 = await db.personas.get('p1')
    expect(p1?.area).toBe('')
  })

  it('no deduce el area de las notas ni toca nada de lo que ya tenia', async () => {
    const p1 = await db.personas.get('p1')
    expect(p1?.notas).toBe('Control Interno, ext. 000')
    expect(p1?.nombre).toBe('Persona de prueba')
    expect(p1?.fechaIngreso).toBe('2025-03-12')
    expect(p1?.estado).toBe('activa')
    expect(p1?.updatedAt).toBe('2026-09-23T00:00:00.000Z')
  })

  it('no encola ningun cambio: la reparacion no viaja al servidor', async () => {
    expect(await db.cambiosPendientes.count()).toBe(0)
  })

  it('deja la base en la version 20', () => {
    expect(db.verno).toBe(20)
  })
})
