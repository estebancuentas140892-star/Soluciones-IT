import { describe, expect, it } from 'vitest'
import type { DatosCredencial } from './sesionBoveda'
import { camposAMigrar, detectarCandidatos } from './migracionSecretos'

function datos(parcial: Partial<DatosCredencial> = {}): DatosCredencial {
  return { usuario: '', contrasena: '', ip: '', url: '', notas: '', extras: {}, ...parcial }
}

describe('detectarCandidatos', () => {
  const impresora = { id: 'd1', nombre: 'Impresora Lanier', ip: '192.168.1.50', eliminadoEn: null }
  const router = { id: 'd2', nombre: 'Router principal', ip: '192.168.1.1', eliminadoEn: null }
  const dispositivos = [impresora, router]

  it('marca por vínculo una credencial ligada a un solo equipo', () => {
    const credenciales = [
      { id: 'c1', titulo: 'Acceso impresora', dispositivos: [{ id: 'd1', nombre: 'Impresora Lanier' }], eliminadoEn: null },
    ]
    const candidatos = detectarCandidatos(credenciales, dispositivos, new Map())
    expect(candidatos).toEqual([
      {
        credencialId: 'c1',
        credencialTitulo: 'Acceso impresora',
        dispositivoId: 'd1',
        dispositivoNombre: 'Impresora Lanier',
        motivo: 'vinculo',
      },
    ])
  })

  it('no marca una credencial vinculada a varios equipos ni a ninguno', () => {
    const credenciales = [
      {
        id: 'c1',
        titulo: 'Compartida',
        dispositivos: [
          { id: 'd1', nombre: 'Impresora Lanier' },
          { id: 'd2', nombre: 'Router principal' },
        ],
        eliminadoEn: null,
      },
      { id: 'c2', titulo: 'Sin equipo', dispositivos: [], eliminadoEn: null },
    ]
    expect(detectarCandidatos(credenciales, dispositivos, new Map())).toEqual([])
  })

  it('marca por IP heredada cuando nadie la vinculó a mano', () => {
    const credenciales = [{ id: 'c1', titulo: 'Acceso viejo', dispositivos: [], eliminadoEn: null }]
    const ips = new Map([['c1', '192.168.1.50']])
    const candidatos = detectarCandidatos(credenciales, dispositivos, ips)
    expect(candidatos).toEqual([
      {
        credencialId: 'c1',
        credencialTitulo: 'Acceso viejo',
        dispositivoId: 'd1',
        dispositivoNombre: 'Impresora Lanier',
        motivo: 'ip',
      },
    ])
  })

  it('prefiere el vínculo explícito sobre una IP que apunta a otro equipo', () => {
    const credenciales = [
      { id: 'c1', titulo: 'Confusa', dispositivos: [{ id: 'd2', nombre: 'Router principal' }], eliminadoEn: null },
    ]
    const ips = new Map([['c1', '192.168.1.50']]) // coincide con d1, no con d2
    const candidatos = detectarCandidatos(credenciales, dispositivos, ips)
    expect(candidatos).toEqual([
      {
        credencialId: 'c1',
        credencialTitulo: 'Confusa',
        dispositivoId: 'd2',
        dispositivoNombre: 'Router principal',
        motivo: 'vinculo',
      },
    ])
  })

  it('ignora credenciales y dispositivos eliminados', () => {
    const credenciales = [
      { id: 'c1', titulo: 'Eliminada', dispositivos: [{ id: 'd1', nombre: 'Impresora Lanier' }], eliminadoEn: '2026-01-01' },
    ]
    expect(detectarCandidatos(credenciales, dispositivos, new Map())).toEqual([])

    const credenciales2 = [
      { id: 'c2', titulo: 'Equipo de baja', dispositivos: [{ id: 'd3', nombre: 'Fantasma' }], eliminadoEn: null },
    ]
    const dispositivosConBaja = [...dispositivos, { id: 'd3', nombre: 'Fantasma', ip: '', eliminadoEn: '2026-01-01' }]
    expect(detectarCandidatos(credenciales2, dispositivosConBaja, new Map())).toEqual([])
  })

  it('no marca por IP vacía ni por una IP que no coincide con ningún equipo', () => {
    const credenciales = [{ id: 'c1', titulo: 'Sin IP', dispositivos: [], eliminadoEn: null }]
    expect(detectarCandidatos(credenciales, dispositivos, new Map([['c1', '']]))).toEqual([])
    expect(detectarCandidatos(credenciales, dispositivos, new Map([['c1', '10.0.0.99']]))).toEqual([])
  })

  // Regresion (2026-07-22): una credencial cacheada antes del grupo N3
  // llega sin la propiedad `dispositivos`. El relleno de tablas.ts
  // (porDefecto) solo aplica a filas descargadas despues, y la
  // sincronizacion es incremental por cursor: la fila vieja nunca se
  // vuelve a bajar y conserva el hueco. Sin la guarda esto lanzaba
  // "Cannot read properties of undefined (reading 'length')" en el
  // render de la Boveda, y el ErrorBoundary tapaba la pantalla entera
  // con "No se pudo cargar la aplicacion".
  it('tolera una credencial vieja sin la propiedad dispositivos', () => {
    const vieja = { id: 'c1', titulo: 'Credencial vieja', eliminadoEn: null } as unknown as Parameters<
      typeof detectarCandidatos
    >[0][number]
    expect(() => detectarCandidatos([vieja], dispositivos, new Map())).not.toThrow()
    // y se sigue detectando por IP heredada, como cualquier otra sin vinculo
    expect(detectarCandidatos([vieja], dispositivos, new Map([['c1', '192.168.1.50']]))).toEqual([
      {
        credencialId: 'c1',
        credencialTitulo: 'Credencial vieja',
        dispositivoId: 'd1',
        dispositivoNombre: 'Impresora Lanier',
        motivo: 'ip',
      },
    ])
  })
})

describe('camposAMigrar', () => {
  it('crea un campo por cada dato no vacío, descartando la IP heredada', () => {
    const campos = camposAMigrar(
      datos({ usuario: 'admin', contrasena: 'clave123', ip: '192.168.1.50', url: 'http://10.0.0.5', notas: 'Nota' }),
      [],
    )
    expect(campos).toEqual([
      { nombre: 'Usuario', tipo: 'usuario', valor: 'admin' },
      { nombre: 'Contraseña', tipo: 'contrasena', valor: 'clave123' },
      { nombre: 'URL', tipo: 'texto', valor: 'http://10.0.0.5' },
      { nombre: 'Notas', tipo: 'texto', valor: 'Nota' },
    ])
  })

  it('agrega un campo de tipo texto por cada dato extra con valor', () => {
    const campos = camposAMigrar(datos({ extras: { 'PIN impresión': '4321', Puerto: '' } }), [])
    expect(campos).toEqual([{ nombre: 'PIN impresión', tipo: 'texto', valor: '4321' }])
  })

  it('no crea nada para una credencial completamente vacía', () => {
    expect(camposAMigrar(datos(), [])).toEqual([])
  })

  it('desambigua el nombre si el equipo ya tiene un campo igual', () => {
    const campos = camposAMigrar(datos({ usuario: 'admin' }), [
      { nombre: 'Usuario', eliminadoEn: null },
    ])
    expect(campos).toEqual([{ nombre: 'Usuario (2)', tipo: 'usuario', valor: 'admin' }])
  })

  it('ignora un campo existente eliminado al desambiguar', () => {
    const campos = camposAMigrar(datos({ usuario: 'admin' }), [
      { nombre: 'Usuario', eliminadoEn: '2026-01-01' },
    ])
    expect(campos).toEqual([{ nombre: 'Usuario', tipo: 'usuario', valor: 'admin' }])
  })

  it('desambigua sin distinguir mayúsculas ni acentos', () => {
    const campos = camposAMigrar(datos({ usuario: 'admin' }), [
      { nombre: 'usuário', eliminadoEn: null },
    ])
    expect(campos).toEqual([{ nombre: 'Usuario (2)', tipo: 'usuario', valor: 'admin' }])
  })
})
