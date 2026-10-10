import { describe, expect, it } from 'vitest'
import type { Mantenimiento } from '../../lib/db'
import { agruparAgenda } from '../inicio/agenda'
import { calcularPendientes } from '../inicio/pendientes'
import {
  conteoDeMantenimientos,
  entraEnAgenda,
  errorDeCancelacion,
  errorDeCierre,
  errorDePosposicion,
  errorDeProgramacion,
  hoyIso,
  mantenimientosEnAgenda,
  textoProgramado,
} from './mantenimiento'

// La Agenda deriva los mantenimientos (tarea 320): vencidos, hoy y
// próximos salen de la fecha programada de los ABIERTOS y CONFIRMADOS;
// un antecedente por validar, uno cerrado o uno de un equipo eliminado
// nunca entra. Y lo que pide cada gesto antes de guardar. Todo inventado.

const HOY = new Date(2026, 9, 10, 9, 0) // 10 de octubre de 2026, hora local

type DeAgenda = Parameters<typeof mantenimientosEnAgenda>[0][number]

function m(id: string, cambios: Partial<Mantenimiento> = {}): DeAgenda {
  return {
    id,
    dispositivoId: 'equipo-1',
    tipo: 'preventivo',
    fechaProgramada: '2026-10-10',
    estado: 'programado',
    validacion: 'confirmado',
    eliminadoEn: null,
    ...cambios,
  }
}

const EQUIPOS = [
  { id: 'equipo-1', nombre: 'POS de prueba', eliminadoEn: null },
  { id: 'equipo-borrado', nombre: 'Equipo borrado', eliminadoEn: '2026-10-01T00:00:00.000Z' },
]

describe('entraEnAgenda', () => {
  it('solo lo abierto, confirmado, con fecha y sin eliminar', () => {
    expect(entraEnAgenda(m('a'))).toBe(true)
    expect(entraEnAgenda(m('b', { estado: 'pospuesto' }))).toBe(true)
    expect(entraEnAgenda(m('c', { estado: 'realizado' }))).toBe(false)
    expect(entraEnAgenda(m('d', { estado: 'cancelado' }))).toBe(false)
    expect(entraEnAgenda(m('e', { validacion: 'documentado_por_validar' }))).toBe(false)
    expect(entraEnAgenda(m('f', { fechaProgramada: null }))).toBe(false)
    expect(entraEnAgenda(m('g', { eliminadoEn: '2026-10-09T00:00:00.000Z' }))).toBe(false)
  })
})

describe('mantenimientosEnAgenda', () => {
  it('reparte vencidos, hoy y próximos por la fecha programada', () => {
    const items = mantenimientosEnAgenda(
      [
        m('atrasado', { fechaProgramada: '2026-10-07' }),
        m('hoy', { fechaProgramada: '2026-10-10' }),
        m('manana', { fechaProgramada: '2026-10-11', tipo: 'correctivo' }),
        m('pospuesto', { fechaProgramada: '2026-10-25', estado: 'pospuesto' }),
      ],
      EQUIPOS,
      HOY,
    )
    const agenda = agruparAgenda(items)
    expect(agenda.vencidos.map((i) => i.clave)).toEqual(['mantenimiento:atrasado'])
    expect(agenda.hoy.map((i) => i.clave)).toEqual(['mantenimiento:hoy'])
    expect(agenda.proximos.map((i) => i.clave)).toEqual(['mantenimiento:manana', 'mantenimiento:pospuesto'])
  })

  it('cada fila dice el equipo, cuándo toca y qué mantenimiento es, y lleva a su pantalla', () => {
    const [item] = mantenimientosEnAgenda([m('a', { fechaProgramada: '2026-10-07' })], EQUIPOS, HOY)
    expect(item).toMatchObject({
      titulo: 'POS de prueba',
      detalle: 'Atrasado 3 días',
      origen: 'Mantenimiento preventivo',
      ruta: '/dispositivos/equipo-1/mantenimientos/a',
      categoria: 'mantenimiento',
      tono: 'precaucion',
      fecha: '2026-10-07',
      diasRestantes: -3,
    })
  })

  it('un antecedente por validar, uno cerrado o el de un equipo eliminado no entran', () => {
    const items = mantenimientosEnAgenda(
      [
        m('antecedente', { validacion: 'documentado_por_validar', fechaProgramada: '2025-03-12' }),
        m('realizado', { estado: 'realizado' }),
        m('cancelado', { estado: 'cancelado' }),
        m('de-equipo-borrado', { dispositivoId: 'equipo-borrado' }),
        m('de-equipo-desconocido', { dispositivoId: 'no-existe' }),
      ],
      EQUIPOS,
      HOY,
    )
    expect(items).toEqual([])
  })

  it('uno para dentro de más de 30 días todavía no pide nada', () => {
    expect(mantenimientosEnAgenda([m('lejos', { fechaProgramada: '2026-11-09' })], EQUIPOS, HOY)).toHaveLength(1)
    expect(mantenimientosEnAgenda([m('muy-lejos', { fechaProgramada: '2026-11-10' })], EQUIPOS, HOY)).toEqual([])
  })

  it('en calcularPendientes se ordena con el resto de lo que tiene fecha y deja de salir al cerrarse', () => {
    const comun = {
      articulos: [],
      credenciales: [],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map<string, string>(),
      ejecuciones: [],
      articulosDeSugerencia: [],
      dispositivos: [
        {
          id: 'equipo-1',
          nombre: 'POS de prueba',
          estado: 'Operativo',
          responsableId: null,
          eliminadoEn: null,
        },
      ],
      usuarioId: 'u1',
      puedeVerBoveda: false,
      limite: Infinity,
      hoy: HOY,
    }
    const abierto = m('a', { fechaProgramada: '2026-10-09' })
    expect(calcularPendientes({ ...comun, mantenimientos: [abierto] }).map((i) => i.clave)).toEqual(['mantenimiento:a'])
    expect(calcularPendientes({ ...comun, mantenimientos: [{ ...abierto, estado: 'realizado' }] })).toEqual([])
  })
})

describe('textoProgramado y conteoDeMantenimientos', () => {
  it('dice cuándo toca en pocas palabras', () => {
    expect(textoProgramado('2026-10-09', -1)).toBe('Atrasado 1 día')
    expect(textoProgramado('2026-10-07', -3)).toBe('Atrasado 3 días')
    expect(textoProgramado('2026-10-10', 0)).toBe('Toca hoy')
    expect(textoProgramado('2026-10-11', 1)).toBe('Toca mañana')
    expect(textoProgramado('2026-10-20', 10)).toBe('Toca el 20 oct')
  })

  it('la fila plegada de la ficha dice el abierto más cercano, sin contar antecedentes', () => {
    expect(conteoDeMantenimientos([], HOY)).toBe('Ninguno')
    expect(conteoDeMantenimientos([m('a', { validacion: 'documentado_por_validar' })], HOY)).toBe('Ninguno')
    expect(conteoDeMantenimientos([m('a', { fechaProgramada: '2026-10-20' }), m('b', { fechaProgramada: '2026-10-15' })], HOY)).toBe('15 oct')
    expect(conteoDeMantenimientos([m('a', { fechaProgramada: '2026-10-10' })], HOY)).toBe('Hoy')
    expect(conteoDeMantenimientos([m('a', { fechaProgramada: '2026-10-01' })], HOY)).toBe('Atrasado')
    // Uno lejano también se dice: la ficha no tiene ventana de aviso.
    expect(conteoDeMantenimientos([m('a', { fechaProgramada: '2027-01-15' })], HOY)).toBe('15 ene')
  })
})

describe('lo que pide cada gesto', () => {
  it('programar: una fecha válida de hoy en adelante', () => {
    expect(errorDeProgramacion('', HOY)).toBe('Elige la fecha en que toca.')
    expect(errorDeProgramacion('2026-02-31', HOY)).toBe('La fecha no es válida.')
    expect(errorDeProgramacion('2026-10-09', HOY)).toBe('La fecha no puede ser anterior a hoy.')
    expect(errorDeProgramacion('2026-10-10', HOY)).toBeNull()
  })

  it('cerrar: fecha real hasta hoy, quién y qué se hizo', () => {
    const bien = { fechaRealizada: '2026-10-10', tecnico: 'Técnico', resultado: 'Limpieza.' }
    expect(errorDeCierre(bien, HOY)).toBeNull()
    expect(errorDeCierre({ ...bien, fechaRealizada: '' }, HOY)).toBe('Di en qué fecha se hizo.')
    expect(errorDeCierre({ ...bien, fechaRealizada: '2026-10-11' }, HOY)).toBe('No puede haberse hecho en una fecha futura.')
    expect(errorDeCierre({ ...bien, tecnico: '  ' }, HOY)).toBe('Di quién lo hizo.')
    expect(errorDeCierre({ ...bien, resultado: '' }, HOY)).toBe('Di qué se hizo y cómo quedó.')
  })

  it('posponer: una fecha nueva, de hoy en adelante y distinta', () => {
    expect(errorDePosposicion('2026-10-20', '2026-10-20', HOY)).toBe('Elige una fecha distinta de la que tenía.')
    expect(errorDePosposicion('2026-10-01', '2026-10-20', HOY)).toBe('La fecha no puede ser anterior a hoy.')
    expect(errorDePosposicion('2026-11-03', '2026-10-20', HOY)).toBeNull()
  })

  it('cancelar: siempre con motivo', () => {
    expect(errorDeCancelacion(' ')).toBe('Di por qué se cancela.')
    expect(errorDeCancelacion('El equipo se dio de baja')).toBeNull()
  })

  it('hoyIso da el día del teléfono como un campo de fecha', () => {
    expect(hoyIso(HOY)).toBe('2026-10-10')
  })
})
