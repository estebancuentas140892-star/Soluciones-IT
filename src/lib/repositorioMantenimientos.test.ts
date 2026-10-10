import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Mantenimiento } from './db'
import { cerrarMantenimiento, eliminarRegistro, guardarRegistro, nuevoId } from './repositorio'

// Escribir un mantenimiento (tarea 320): programar, posponer y cancelar
// pasan por `guardarRegistro` y dejan UNA entrada en el historial del
// EQUIPO; cerrar como realizado pasa por `cerrarMantenimiento`, que
// escribe la intervención real y deja el mantenimiento apuntando a ella.
// Todo se encola para subir: así funciona sin conexión. Datos inventados.

type Nuevo = Omit<Mantenimiento, 'updatedAt' | 'updatedBy' | 'eliminadoEn'>

function mantenimientoDePrueba(cambios: Partial<Nuevo> = {}): Nuevo {
  return {
    id: nuevoId(),
    dispositivoId: 'equipo-1',
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
    ...cambios,
  }
}

beforeEach(async () => {
  await Promise.all(db.tables.map((tabla) => tabla.clear()))
})

describe('programar, posponer y cancelar', () => {
  it('programar guarda el mantenimiento, una entrada en el historial del equipo y encola los dos', async () => {
    const nuevo = mantenimientoDePrueba()
    await guardarRegistro('mantenimientos', nuevo)

    expect((await db.mantenimientos.get(nuevo.id))?.estado).toBe('programado')
    const entradas = await db.historial.toArray()
    expect(entradas).toHaveLength(1)
    expect(entradas[0]).toMatchObject({
      entidadTipo: 'dispositivo',
      entidadId: 'equipo-1',
      campo: 'mantenimiento',
      valorAnterior: '',
      valorNuevo: 'Preventivo para el 20 oct 2026',
    })
    const cola = await db.cambiosPendientes.toArray()
    expect(cola.map((c) => c.tabla).sort()).toEqual(['historial', 'mantenimientos'])
  })

  it('posponer deja una entrada con el antes y el después y el motivo', async () => {
    const nuevo = mantenimientoDePrueba()
    await guardarRegistro('mantenimientos', nuevo)
    const guardado = (await db.mantenimientos.get(nuevo.id)) as Mantenimiento
    await guardarRegistro('mantenimientos', { ...guardado, estado: 'pospuesto', fechaProgramada: '2026-11-03' }, 'Sin repuesto')

    const entradas = (await db.historial.toArray()).filter((e) => e.valorAnterior !== '')
    expect(entradas).toHaveLength(1)
    expect(entradas[0]).toMatchObject({
      campo: 'mantenimiento',
      valorAnterior: 'Preventivo para el 20 oct 2026',
      valorNuevo: 'Preventivo, pospuesto al 3 nov 2026',
      motivo: 'Sin repuesto',
    })
  })

  it('un guardado que no cambia el resumen no escribe historial', async () => {
    const nuevo = mantenimientoDePrueba()
    await guardarRegistro('mantenimientos', nuevo)
    const guardado = (await db.mantenimientos.get(nuevo.id)) as Mantenimiento
    await guardarRegistro('mantenimientos', { ...guardado, observaciones: 'Llevar aspiradora' })

    expect(await db.historial.count()).toBe(1)
    expect((await db.mantenimientos.get(nuevo.id))?.observaciones).toBe('Llevar aspiradora')
  })

  it('eliminar deja constancia en el equipo', async () => {
    const nuevo = mantenimientoDePrueba()
    await guardarRegistro('mantenimientos', nuevo)
    await eliminarRegistro('mantenimientos', nuevo.id, 'Programado por error')

    const ultima = (await db.historial.toArray()).find((e) => e.valorNuevo === '')
    expect(ultima).toMatchObject({ entidadId: 'equipo-1', campo: 'mantenimiento', motivo: 'Programado por error' })
  })
})

describe('cerrarMantenimiento', () => {
  it('escribe la intervención real en el equipo y deja el mantenimiento realizado apuntando a ella', async () => {
    const nuevo = mantenimientoDePrueba()
    await guardarRegistro('mantenimientos', nuevo)
    const entradasAntes = await db.historial.count()

    const entradaId = await cerrarMantenimiento(nuevo.id, {
      fechaRealizada: '2026-10-12',
      tecnico: ' Técnico de prueba ',
      resultado: ' Limpieza interna. ',
    })

    expect(entradaId).not.toBeNull()
    const cerrado = await db.mantenimientos.get(nuevo.id)
    expect(cerrado).toMatchObject({
      estado: 'realizado',
      fechaRealizada: '2026-10-12',
      tecnico: 'Técnico de prueba',
      resultado: 'Limpieza interna.',
      historialId: entradaId,
    })
    // Una sola entrada nueva: la intervención (no además un "mantenimiento").
    expect(await db.historial.count()).toBe(entradasAntes + 1)
    const intervencion = await db.historial.get(entradaId as string)
    expect(intervencion).toMatchObject({
      entidadTipo: 'dispositivo',
      entidadId: 'equipo-1',
      campo: 'intervencion',
      valorNuevo: 'Mantenimiento preventivo realizado el 12 oct 2026 por Técnico de prueba: Limpieza interna.',
    })
    // Sin conexión, las dos cosas esperan en la cola para subir.
    const cola = await db.cambiosPendientes.toArray()
    expect(cola.some((c) => c.tabla === 'historial' && c.entidadId === entradaId)).toBe(true)
    const pendienteMantenimiento = cola.filter((c) => c.tabla === 'mantenimientos' && c.entidadId === nuevo.id)
    expect(pendienteMantenimiento).toHaveLength(1)
    expect((pendienteMantenimiento[0].payload as Mantenimiento).estado).toBe('realizado')
  })

  it('no cierra uno ya cerrado, uno cancelado ni un antecedente por validar', async () => {
    const realizado = mantenimientoDePrueba({ estado: 'realizado', fechaRealizada: '2026-10-01' })
    const cancelado = mantenimientoDePrueba({ estado: 'cancelado' })
    const antecedente = mantenimientoDePrueba({ validacion: 'documentado_por_validar', fuente: 'Cronograma de prueba' })
    for (const m of [realizado, cancelado, antecedente]) await guardarRegistro('mantenimientos', m)
    const entradas = await db.historial.count()

    for (const m of [realizado, cancelado, antecedente]) {
      expect(await cerrarMantenimiento(m.id, { fechaRealizada: '2026-10-12', tecnico: 'X', resultado: 'Y' })).toBeNull()
    }
    expect(await db.historial.count()).toBe(entradas)
    expect((await db.mantenimientos.get(antecedente.id))?.estado).toBe('programado')
  })

  it('no cierra uno que no existe', async () => {
    expect(await cerrarMantenimiento('no-existe', { fechaRealizada: '2026-10-12', tecnico: 'X', resultado: 'Y' })).toBeNull()
    expect(await db.historial.count()).toBe(0)
  })
})
