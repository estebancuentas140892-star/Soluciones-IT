import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'
import { referenciaEnUso } from './archivosPendientes'

// Prueba de integracion del upgrade a la version 23 (un documento, varios
// equipos, tarea 322). Mismo planteamiento que las de las versiones 14 y
// 18 a 20: se construye a mano la base tal como la tienen hoy los
// telefonos del equipo (version 22, con los adjuntos guardados SIN `nota`,
// `origen` ni `fechaDocumento`), se cierra, y recien entonces se toca `db`.
//
// Lo que protege: (a) las columnas nuevas del servidor no cambian el
// `updated_at` de los adjuntos que ya viven en cada telefono, asi que no
// se vuelven a bajar y se quedarian sin esos campos para siempre; (b) el
// indice nuevo `referencia` encuentra los adjuntos ya guardados. Y lo que
// NO debe hacer: deducir una fecha del nombre del archivo.

// Las versiones 20 a 22 solo agregaron tablas: el resto es el de la 19.
const ESQUEMA_V22 = {

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
  autorizaciones_facturacion: 'id, *dispositivoIds, updatedAt',

}

describe('upgrade a la version 23', () => {
  beforeAll(async () => {
    const vieja = new Dexie('soluciones-it')
    vieja.version(22).stores(ESQUEMA_V22)
    await vieja.open()

    // Un acta tal como la guardo la version anterior, con una fecha en el
    // nombre que no se debe tomar como fecha confirmada.
    await vieja.table('adjuntos').put({
      id: 'a1',
      entidadTipo: 'dispositivo',
      entidadId: 'equipo-1',
      nombre: 'acta-entrega-2025-03-12.pdf',
      tipo: 'application/pdf',
      referencia: 'compartidos/hash-acta',
      updatedAt: '2026-10-01T00:00:00.000Z',
      updatedBy: null,
      eliminadoEn: null,
    })

    vieja.close()
  })

  it('el adjunto viejo queda sin nota, sin origen y sin fecha', async () => {
    const a1 = await db.adjuntos.get('a1')
    expect(a1?.nota).toBe('')
    expect(a1?.origen).toBe('')
    expect(a1?.fechaDocumento).toBeNull()
  })

  it('no deduce la fecha del nombre ni toca nada de lo que ya tenia', async () => {
    const a1 = await db.adjuntos.get('a1')
    expect(a1?.nombre).toBe('acta-entrega-2025-03-12.pdf')
    expect(a1?.referencia).toBe('compartidos/hash-acta')
    expect(a1?.entidadId).toBe('equipo-1')
    expect(a1?.updatedAt).toBe('2026-10-01T00:00:00.000Z')
  })

  it('el indice de referencia encuentra el adjunto ya guardado', async () => {
    expect(await db.adjuntos.where('referencia').equals('compartidos/hash-acta').count()).toBe(1)
    expect(await referenciaEnUso('compartidos/hash-acta')).toBe(true)
  })

  it('no encola ningun cambio: la reparacion no viaja al servidor', async () => {
    expect(await db.cambiosPendientes.count()).toBe(0)
  })

  it('deja la base en la version 23 o posterior', () => {
    expect(db.verno).toBeGreaterThanOrEqual(23)
  })
})
