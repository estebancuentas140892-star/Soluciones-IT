import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'

// Prueba de integracion del upgrade a la version 18 (Centro de consulta,
// 2026-09-14). Mismo planteamiento que `db.upgrade.test.ts` con la 14:
// se construye a mano la base tal como la tienen hoy los telefonos del
// equipo (version 17, con las fichas de Referencia ya guardadas SIN los
// campos de la herramienta), se cierra, y recien entonces se toca `db`.
//
// El caso que protege: agregar columnas en el servidor no cambia el
// `updated_at` de las filas, asi que esas fichas no se vuelven a
// descargar y se quedarian sin `guiasRelacionadas` para siempre.

const ESQUEMA_V17 = {
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

describe('upgrade a la version 18', () => {
  beforeAll(async () => {
    const vieja = new Dexie('soluciones-it')
    vieja.version(17).stores(ESQUEMA_V17)
    await vieja.open()

    // Una ficha tal como la guardo la version del 2026-09-10.
    await vieja.table('referencias').put({
      id: 'r1',
      tipo: 'termino',
      titulo: 'DHCP',
      abreviatura: '',
      alias: ['asignación automática de IP'],
      definicion: 'Reparte direcciones IP automáticamente.',
      ejemplo: '',
      categoria: 'Redes',
      plataforma: '',
      valor: '',
      cuandoUsar: '',
      resultadoEsperado: '',
      requiereAdmin: false,
      advertencia: '',
      relacionadas: [{ id: 'r2', titulo: 'DNS' }],
      etiquetas: ['red'],
      updatedAt: '2026-09-10T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })

    vieja.close()
  })

  it('completa la ficha vieja con los campos de la herramienta', async () => {
    const r1 = await db.referencias.get('r1')
    expect(r1?.proveedor).toBe('')
    expect(r1?.usoEnMetroparques).toBe('')
    expect(r1?.estadoUso).toBe('')
    expect(r1?.notas).toBe('')
    expect(r1?.guiasRelacionadas).toEqual([])
  })

  it('no toca nada de lo que la ficha ya tenia', async () => {
    const r1 = await db.referencias.get('r1')
    expect(r1?.tipo).toBe('termino')
    expect(r1?.titulo).toBe('DHCP')
    expect(r1?.alias).toEqual(['asignación automática de IP'])
    expect(r1?.relacionadas).toEqual([{ id: 'r2', titulo: 'DNS' }])
    expect(r1?.etiquetas).toEqual(['red'])
    expect(r1?.updatedAt).toBe('2026-09-10T00:00:00.000Z')
  })

  it('no encola ningun cambio: la reparacion no viaja al servidor', async () => {
    expect(await db.cambiosPendientes.count()).toBe(0)
  })

  // Desde la tarea 266 la base sigue hasta la 19: lo que esta prueba
  // cuida es que la 18 no se quede por el camino.
  it('pasa por la version 18 hasta la ultima declarada', () => {
    expect(db.verno).toBeGreaterThanOrEqual(18)
  })
})
