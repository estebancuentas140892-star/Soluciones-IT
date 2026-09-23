import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Conexion, type Dispositivo, type Persona } from '../../lib/db'
import { equiposActuales } from './cicloPersona'
import { equiposAnteriores, periodosDeAsignacion } from './historialAsignaciones'
import {
  asignarEquipo,
  darDeBajaEquipo,
  liberarEquipo,
  reactivarPersona,
  retirarPersona,
} from './operaciones'

const MARCA = { updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: null, eliminadoEn: null }

function persona(id: string, nombre: string): Persona {
  return { id, nombre, notas: '', estado: 'activa', fechaIngreso: null, fechaRetiro: null, motivoRetiro: '', ...MARCA }
}

function equipo(id: string, datos: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id,
    categoriaId: 'cat-computadores',
    nombre: id,
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
    ...MARCA,
    ...datos,
  }
}

async function historialDe(dispositivoId: string) {
  return db.historial.where('[entidadTipo+entidadId]').equals(['dispositivo', dispositivoId]).toArray()
}

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
  await db.personas.bulkPut([persona('ana', 'Ana Pérez'), persona('luis', 'Luis Gómez')])
})

describe('asignar y liberar un equipo', () => {
  it('asignar fija el vínculo, la copia del nombre y pasa un Disponible a Operativo', async () => {
    await db.dispositivos.put(equipo('jp62', { estado: 'Disponible' }))
    await asignarEquipo('jp62', 'ana')

    const jp62 = await db.dispositivos.get('jp62')
    expect(jp62).toMatchObject({ responsableId: 'ana', responsable: 'Ana Pérez', estado: 'Operativo' })
  })

  it('el historial guarda el nombre (para leer) y el id (para reconstruir)', async () => {
    await db.dispositivos.put(equipo('jp62'))
    await asignarEquipo('jp62', 'ana')

    const entradas = await historialDe('jp62')
    expect(entradas.find((e) => e.campo === 'responsable')).toMatchObject({ valorAnterior: '', valorNuevo: 'Ana Pérez' })
    expect(entradas.find((e) => e.campo === 'responsableId')).toMatchObject({ valorAnterior: '', valorNuevo: 'ana' })
  })

  it('liberar deja el equipo sin responsable actual; el nombre queda solo en el historial', async () => {
    await db.dispositivos.put(equipo('jp62', { responsableId: 'ana', responsable: 'Ana Pérez' }))
    await liberarEquipo('jp62', { marcarDisponible: true, motivo: 'Cambio de equipo' })

    const jp62 = await db.dispositivos.get('jp62')
    expect(jp62).toMatchObject({ responsableId: null, responsable: '', estado: 'Disponible' })
    const entradas = await historialDe('jp62')
    expect(entradas.find((e) => e.campo === 'responsable')).toMatchObject({
      valorAnterior: 'Ana Pérez',
      valorNuevo: '',
      motivo: 'Cambio de equipo',
    })
  })

  it('liberar sin marcarlo disponible conserva el estado (un equipo en mantenimiento no se entrega)', async () => {
    await db.dispositivos.put(equipo('jp62', { responsableId: 'ana', responsable: 'Ana Pérez', estado: 'En mantenimiento' }))
    await liberarEquipo('jp62', { marcarDisponible: false })
    expect((await db.dispositivos.get('jp62'))?.estado).toBe('En mantenimiento')
  })

  it('reasignar cambia de persona en un solo guardado', async () => {
    await db.dispositivos.put(equipo('jp62', { responsableId: 'ana', responsable: 'Ana Pérez' }))
    await asignarEquipo('jp62', 'luis')

    expect(await db.dispositivos.get('jp62')).toMatchObject({ responsableId: 'luis', responsable: 'Luis Gómez' })
    const id = (await historialDe('jp62')).find((e) => e.campo === 'responsableId')
    expect(id).toMatchObject({ valorAnterior: 'ana', valorNuevo: 'luis' })
  })
})

describe('dar de baja', () => {
  it('la baja suelta al responsable: el equipo deja de ser equipo actual de la persona', async () => {
    await db.dispositivos.put(equipo('jp41', { responsableId: 'ana', responsable: 'Ana Pérez' }))
    await darDeBajaEquipo('jp41', 'Fin de vida útil')

    const jp41 = await db.dispositivos.get('jp41')
    expect(jp41).toMatchObject({ estado: 'De baja', responsableId: null, responsable: '' })
    // La ficha se conserva: la baja no es un borrado.
    expect(jp41?.eliminadoEn).toBeNull()
    expect(equiposActuales('ana', await db.dispositivos.toArray())).toEqual([])
  })

  it('la fecha y el motivo de la baja quedan en el historial (no hacen falta columnas nuevas)', async () => {
    await db.dispositivos.put(equipo('jp41'))
    await darDeBajaEquipo('jp41', 'Fin de vida útil')
    const estado = (await historialDe('jp41')).find((e) => e.campo === 'estado')
    expect(estado).toMatchObject({ valorAnterior: 'Operativo', valorNuevo: 'De baja', motivo: 'Fin de vida útil' })
    expect(estado?.fechaHora).toBeTruthy()
  })
})

describe('retirar a una persona', () => {
  const conexion: Conexion = {
    id: 'c1',
    tipo: 'enlace',
    origenId: 'sw',
    origenNombre: 'SW',
    origenPuerto: '1',
    destinoId: 'jp03',
    destinoNombre: 'jp03',
    destinoPuerto: '',
    medio: 'UTP',
    notas: '',
    ...MARCA,
  }

  beforeEach(async () => {
    await db.dispositivos.bulkPut([
      equipo('jp62', { responsableId: 'ana', responsable: 'Ana Pérez' }),
      equipo('jp10', { responsableId: 'ana', responsable: 'Ana Pérez' }),
      equipo('jp07', { responsableId: 'ana', responsable: 'Ana Pérez' }),
      equipo('jp03', { responsableId: 'ana', responsable: 'Ana Pérez' }),
    ])
    await db.conexiones.put(conexion)
  })

  it('aplica la decisión de cada equipo y conserva la ficha de la persona', async () => {
    const resultado = await retirarPersona('ana', { fechaRetiro: '2026-09-23', motivoRetiro: 'Renuncia' }, [
      { dispositivoId: 'jp62', tipo: 'liberar', marcarDisponible: true },
      { dispositivoId: 'jp10', tipo: 'reasignar', personaId: 'luis' },
      { dispositivoId: 'jp07', tipo: 'baja' },
      { dispositivoId: 'jp03', tipo: 'baja' },
    ])

    expect(await db.dispositivos.get('jp62')).toMatchObject({ responsableId: null, estado: 'Disponible' })
    expect(await db.dispositivos.get('jp10')).toMatchObject({ responsableId: 'luis', responsable: 'Luis Gómez' })
    expect(await db.dispositivos.get('jp07')).toMatchObject({ responsableId: null, estado: 'De baja' })
    // jp03 tiene una conexión viva: queda sin responsable, pero su baja
    // se completa en la pantalla de baja, que obliga a resolverla.
    expect(await db.dispositivos.get('jp03')).toMatchObject({ responsableId: null, estado: 'Operativo' })
    expect(resultado.bajasPendientes).toEqual(['jp03'])

    const ana = await db.personas.get('ana')
    expect(ana).toMatchObject({ estado: 'retirada', fechaRetiro: '2026-09-23', motivoRetiro: 'Renuncia' })
    expect(ana?.eliminadoEn).toBeNull()
    expect(equiposActuales('ana', await db.dispositivos.toArray())).toEqual([])
  })

  it('cada cambio de equipo lleva el motivo del retiro', async () => {
    await retirarPersona('ana', { fechaRetiro: '2026-09-23', motivoRetiro: 'Renuncia' }, [
      { dispositivoId: 'jp62', tipo: 'liberar', marcarDisponible: true },
    ])
    const responsable = (await historialDe('jp62')).find((e) => e.campo === 'responsable')
    expect(responsable?.motivo).toBe('Retiro de Ana Pérez: Renuncia')
  })

  it('después del retiro, la ficha responde qué equipos tuvo', async () => {
    await db.dispositivos.put(equipo('jp99'))
    await asignarEquipo('jp99', 'ana')
    await retirarPersona('ana', { fechaRetiro: '2026-09-23', motivoRetiro: '' }, [
      { dispositivoId: 'jp99', tipo: 'liberar', marcarDisponible: true },
      { dispositivoId: 'jp62', tipo: 'liberar', marcarDisponible: true },
    ])

    const periodos = periodosDeAsignacion(await db.historial.toArray())
    const anteriores = equiposAnteriores('ana', periodos)
    expect(anteriores.map((p) => p.dispositivoId).sort()).toEqual(['jp62', 'jp99'])
    // jp99 se asignó con la app: su comienzo consta. jp62 venía del
    // inventario: solo consta cuándo se soltó.
    expect(anteriores.find((p) => p.dispositivoId === 'jp99')?.desde).not.toBeNull()
    expect(anteriores.find((p) => p.dispositivoId === 'jp62')?.desde).toBeNull()
  })

  it('reactivar vacía los datos del retiro en la ficha, pero no en su historial', async () => {
    await retirarPersona('ana', { fechaRetiro: '2026-09-23', motivoRetiro: 'Fin de contrato' }, [])
    await reactivarPersona('ana')

    expect(await db.personas.get('ana')).toMatchObject({ estado: 'activa', fechaRetiro: null, motivoRetiro: '' })
    const entradas = await db.historial.where('[entidadTipo+entidadId]').equals(['persona', 'ana']).toArray()
    expect(entradas.some((e) => e.campo === 'motivoRetiro' && e.valorNuevo === 'Fin de contrato')).toBe(true)
  })

  it('nada se borra: todo queda en la cola de sincronización como cambios', async () => {
    await retirarPersona('ana', { fechaRetiro: '2026-09-23', motivoRetiro: '' }, [
      { dispositivoId: 'jp62', tipo: 'liberar', marcarDisponible: true },
    ])
    const pendientes = await db.cambiosPendientes.toArray()
    expect(pendientes.some((c) => c.tabla === 'personas' && c.entidadId === 'ana')).toBe(true)
    expect(pendientes.some((c) => c.tabla === 'dispositivos' && c.entidadId === 'jp62')).toBe(true)
    expect(await db.personas.count()).toBe(2)
  })
})
