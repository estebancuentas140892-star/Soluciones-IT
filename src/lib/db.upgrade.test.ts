import Dexie from 'dexie'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from './db'

// Prueba de integracion del upgrade a la version 14 (tarea 137). Las
// pruebas de `tablas.test.ts` cubren la logica pura de
// `normalizarEntidad`; esta cubre el CABLEADO: que Dexie de verdad
// ejecute esa reparacion al abrir una base que venia de la version 13,
// que es la situacion real de los telefonos del equipo.
//
// Se construye a mano una base con el esquema de la version 13 y el
// mismo nombre que usa la app ('soluciones-it'), se le siembran filas
// con los huecos que dejaron versiones anteriores, se cierra, y recien
// entonces se toca `db`: al abrirse, Dexie ve que la base esta en la 13,
// aplica la 14 y corre el upgrade.

const ESQUEMA_V13 = {
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
}

describe('upgrade a la version 14', () => {
  beforeAll(async () => {
    const vieja = new Dexie('soluciones-it')
    vieja.version(13).stores(ESQUEMA_V13)
    await vieja.open()

    await vieja.table('credenciales').bulkPut([
      // La fila exacta que rompio la Boveda (tarea 136): anterior al
      // grupo N3, sin `dispositivos`.
      { id: 'c1', titulo: 'Credencial vieja', categoria: 'Redes', datosCifrados: 'secreto-1', eliminadoEn: null },
      // Una fila sana no debe salir tocada.
      {
        id: 'c2',
        titulo: 'Credencial nueva',
        categoria: 'POS',
        datosCifrados: 'secreto-2',
        venceEn: '2027-01-01',
        dispositivos: [{ id: 'd9', nombre: 'Equipo 9' }],
        tipo: 'llave',
        archivo: null,
        eliminadoEn: null,
      },
    ])
    await vieja.table('dispositivos').put({ id: 'd1', nombre: 'Switch viejo', categoriaId: 'cat1' })
    // Un cambio en la cola de subida: el upgrade no debe alterarla.
    await vieja.table('cambiosPendientes').put({
      id: 'p1',
      tabla: 'credenciales',
      entidadId: 'c1',
      payload: { id: 'c1', titulo: 'Credencial vieja' },
      creadoEn: '2026-07-01T00:00:00.000Z',
      intentos: 0,
      error: null,
    })

    vieja.close()
  })

  it('repara la credencial vieja que reventaba el render de la Boveda', async () => {
    const c1 = await db.credenciales.get('c1')
    expect(c1?.dispositivos).toEqual([])
    expect(c1?.tipo).toBe('cuenta')
    expect(c1?.archivo).toBeNull()
  })

  it('no toca el secreto cifrado ni el resto de datos reales', async () => {
    const c1 = await db.credenciales.get('c1')
    expect(c1?.datosCifrados).toBe('secreto-1')
    expect(c1?.titulo).toBe('Credencial vieja')
    expect(c1?.categoria).toBe('Redes')
  })

  it('deja intacta una fila que ya estaba completa', async () => {
    const c2 = await db.credenciales.get('c2')
    expect(c2?.dispositivos).toEqual([{ id: 'd9', nombre: 'Equipo 9' }])
    expect(c2?.tipo).toBe('llave')
    expect(c2?.venceEn).toBe('2027-01-01')
    expect(c2?.datosCifrados).toBe('secreto-2')
  })

  it('tambien repara otras tablas, no solo credenciales', async () => {
    const d1 = await db.dispositivos.get('d1')
    expect(d1?.nombre).toBe('Switch viejo')
    expect(d1?.detalles).toEqual({})
    expect(d1?.ip).toBe('')
    expect(d1?.observaciones).toBe('')
  })

  it('no altera la cola de cambios pendientes (regla anti pisado de la tarea 128)', async () => {
    const pendientes = await db.cambiosPendientes.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0].payload).toEqual({ id: 'c1', titulo: 'Credencial vieja' })
  })

  // La version que declara `db.ts`. Se actualiza con cada grupo de
  // esquema nuevo; lo que la prueba cuida es que una base que venia de
  // la 13 llegue hasta la ULTIMA sin quedarse por el camino, no el
  // numero en si.
  it('deja la base en la ultima version declarada', () => {
    expect(db.verno).toBe(16)
  })

  // Version 15 (tarea 217): la tabla de preferencias del tecnico tiene
  // que existir y quedar vacia en una base que venia de la 13, para que
  // la ejecucion arranque en el modo por defecto y no en un valor a
  // medias.
  it('crea preferenciasTecnico vacia al subir desde la 13', async () => {
    expect(await db.preferenciasTecnico.count()).toBe(0)
  })

  // Version 16 (tarea 219): la tabla de borradores del editor. Vacia al
  // subir es lo correcto: no hay trabajo a medias que recuperar de una
  // version que no lo guardaba.
  it('crea borradoresArticulo vacia al subir desde la 13', async () => {
    expect(await db.borradoresArticulo.count()).toBe(0)
  })
})
