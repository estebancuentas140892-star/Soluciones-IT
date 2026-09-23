import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'

// Prueba de integracion del upgrade a la version 19 (ciclo de vida de la
// persona, tarea 266). Mismo planteamiento que las de las versiones 14 y
// 18: se construye a mano la base tal como la tienen hoy los telefonos
// del equipo (version 18, con las personas guardadas SIN estado ni
// fechas), se cierra, y recien entonces se toca `db`.
//
// El caso que protege: agregar columnas en el servidor no cambia el
// `updated_at` de las 94 personas que ya viven en cada telefono, asi que
// no se vuelven a descargar y se quedarian sin `estado` para siempre.

const ESQUEMA_V18 = {
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

describe('upgrade a la version 19', () => {
  beforeAll(async () => {
    const vieja = new Dexie('soluciones-it')
    vieja.version(18).stores(ESQUEMA_V18)
    await vieja.open()

    // Una persona tal como la guardo la version del 2026-07-22.
    await vieja.table('personas').put({
      id: 'p1',
      nombre: 'Persona de prueba',
      notas: 'Contabilidad, ext. 000',
      updatedAt: '2026-07-22T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })

    vieja.close()
  })

  it('la persona vieja queda activa, sin motivo de retiro', async () => {
    const p1 = await db.personas.get('p1')
    expect(p1?.estado).toBe('activa')
    expect(p1?.motivoRetiro).toBe('')
  })

  it('no inventa fechas: ingreso y retiro quedan vacios', async () => {
    const p1 = await db.personas.get('p1')
    expect(p1?.fechaIngreso).toBeNull()
    expect(p1?.fechaRetiro).toBeNull()
  })

  it('no toca nada de lo que la persona ya tenia', async () => {
    const p1 = await db.personas.get('p1')
    expect(p1?.nombre).toBe('Persona de prueba')
    expect(p1?.notas).toBe('Contabilidad, ext. 000')
    expect(p1?.updatedAt).toBe('2026-07-22T00:00:00.000Z')
  })

  it('no encola ningun cambio: la reparacion no viaja al servidor', async () => {
    expect(await db.cambiosPendientes.count()).toBe(0)
  })

  it('deja la base en la version 19', () => {
    expect(db.verno).toBe(19)
  })
})
