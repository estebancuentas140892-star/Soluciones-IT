import { describe, expect, it } from 'vitest'
import type { Dispositivo, HistorialEntrada, Persona } from '../../lib/db'
import { agruparAgenda, asuntosUrgentes } from './agenda'
import {
  equiposLiberadosRecientes,
  personasPorRecibir,
  personasRetiradasConEquipos,
  textoIngreso,
} from './asuntosDePersonas'
import { calcularPendientes } from './pendientes'

// LO QUE PIDEN LOS INGRESOS Y LOS RETIROS (tarea 270). Todo INVENTADO.
// "Hoy" es el 23 de septiembre de 2026 a mediodía, hora local.

const HOY = new Date(2026, 8, 23, 12, 0, 0)

function persona(id: string, datos: Partial<Persona> = {}): Persona {
  return {
    id,
    nombre: `Persona ${id}`,
    notas: '',
    estado: 'activa',
    fechaIngreso: null,
    fechaRetiro: null,
    motivoRetiro: '',
    updatedAt: '2026-09-01T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...datos,
  }
}

function equipo(id: string, datos: Partial<Dispositivo> = {}): Dispositivo {
  return {
    id,
    nombre: `PC-${id}`,
    estado: 'Operativo',
    responsableId: null,
    eliminadoEn: null,
    ...datos,
  } as Dispositivo
}

function liberacion(dispositivoId: string, de: string, a: string, fechaHora: string): HistorialEntrada {
  return {
    id: `h-${dispositivoId}-${fechaHora}`,
    entidadTipo: 'dispositivo',
    entidadId: dispositivoId,
    usuario: null,
    usuarioNombre: 'Técnico de prueba',
    fechaHora,
    campo: 'responsableId',
    valorAnterior: de,
    valorNuevo: a,
    motivo: '',
  }
}

describe('persona que ingresa sin equipo', () => {
  it('entra con su fecha de ingreso y se agrupa por ella', () => {
    const personas = [
      persona('manana', { fechaIngreso: '2026-09-24' }),
      persona('hoy', { fechaIngreso: '2026-09-23' }),
      persona('ayer', { fechaIngreso: '2026-09-20' }),
      persona('pronto', { fechaIngreso: '2026-10-05' }),
    ]
    const items = personasPorRecibir(personas, [], HOY)
    expect(items.map((i) => [i.titulo, i.detalle, i.diasRestantes])).toEqual([
      ['Persona manana', 'Ingresa mañana · sin equipo', 1],
      ['Persona hoy', 'Ingresa hoy · sin equipo', 0],
      ['Persona ayer', 'Ingresó hace 3 días · sin equipo', -3],
      ['Persona pronto', 'Ingresa el 5 oct · sin equipo', 12],
    ])
    expect(items[0].ruta).toBe('/personas/manana')
    const agenda = agruparAgenda(items)
    expect(agenda.vencidos.map((i) => i.titulo)).toEqual(['Persona ayer'])
    expect(agenda.hoy.map((i) => i.titulo)).toEqual(['Persona hoy'])
    expect(agenda.proximos.map((i) => i.titulo)).toEqual(['Persona manana', 'Persona pronto'])
  })

  it('no inventa: sin fecha, con equipo, retirada, lejos o hace mucho no es un asunto', () => {
    const personas = [
      persona('sin-fecha'),
      persona('con-equipo', { fechaIngreso: '2026-09-24' }),
      persona('retirada', { fechaIngreso: '2026-09-24', estado: 'retirada' }),
      persona('lejos', { fechaIngreso: '2026-12-01' }),
      persona('hace-mucho', { fechaIngreso: '2026-07-01' }),
      persona('eliminada', { fechaIngreso: '2026-09-24', eliminadoEn: '2026-09-22T00:00:00.000Z' }),
    ]
    const equipos = [equipo('1', { responsableId: 'con-equipo' })]
    expect(personasPorRecibir(personas, equipos, HOY)).toEqual([])
  })

  it('un equipo de baja a su nombre no cuenta como equipo', () => {
    const personas = [persona('p', { fechaIngreso: '2026-09-24' })]
    const equipos = [equipo('viejo', { responsableId: 'p', estado: 'De baja' })]
    expect(personasPorRecibir(personas, equipos, HOY)).toHaveLength(1)
  })

  it('el texto dice cuándo llega, sin decir "venció"', () => {
    expect(textoIngreso('2026-09-22', -1)).toBe('Ingresó hace 1 día')
    expect(textoIngreso('2026-09-30', 7)).toBe('Ingresa el 30 sep')
  })
})

describe('persona retirada con equipos a su nombre', () => {
  it('con fecha de retiro es un vencido que dice cuántos equipos tiene', () => {
    const personas = [persona('rita', { estado: 'retirada', fechaRetiro: '2026-09-10', nombre: 'Rita de Prueba' })]
    const equipos = [equipo('41', { responsableId: 'rita', nombre: 'PC-PRUEBA-41' })]
    const [item] = personasRetiradasConEquipos(personas, equipos, HOY)
    expect(item.detalle).toBe('Se retiró hace 13 días · con 1 equipo')
    expect(item.diasRestantes).toBe(-13)
    expect(agruparAgenda([item]).vencidos).toEqual([item])
  })

  it('sin fecha de retiro va a "Por revisar", y con varios equipos los cuenta', () => {
    const personas = [persona('tomas', { estado: 'retirada', nombre: 'Tomás de Prueba' })]
    const equipos = [equipo('1', { responsableId: 'tomas' }), equipo('2', { responsableId: 'tomas' })]
    const [item] = personasRetiradasConEquipos(personas, equipos, HOY)
    expect(item.detalle).toBe('Retirada · con 2 equipos')
    expect(item.fecha).toBeNull()
    expect(agruparAgenda([item]).porRevisar).toEqual([item])
  })

  it('sin equipos (o solo de baja), activa o eliminada, no hay nada que resolver', () => {
    const personas = [
      persona('limpia', { estado: 'retirada', fechaRetiro: '2026-09-10' }),
      persona('solo-baja', { estado: 'retirada', fechaRetiro: '2026-09-10' }),
      persona('activa'),
    ]
    const equipos = [equipo('b', { responsableId: 'solo-baja', estado: 'De baja' }), equipo('a', { responsableId: 'activa' })]
    expect(personasRetiradasConEquipos(personas, equipos, HOY)).toEqual([])
  })
})

describe('equipo liberado hace poco que espera dueño', () => {
  const AHORA = new Date('2026-09-23T17:00:00.000Z')

  it('sale de la entrada que lo soltó, si sigue Disponible y sin responsable', () => {
    const equipos = [equipo('44', { estado: 'Disponible', nombre: 'PC-PRUEBA-44' })]
    const entradas = [liberacion('44', 'per-luis', '', '2026-09-21T15:00:00.000Z')]
    const [item] = equiposLiberadosRecientes(entradas, equipos, AHORA)
    expect(item.titulo).toBe('PC-PRUEBA-44')
    expect(item.detalle).toBe('Liberado hace 2 d · Disponible')
    expect(item.ruta).toBe('/dispositivos/44')
    expect(agruparAgenda([item]).porRevisar).toEqual([item])
  })

  it('no es un asunto si lo reasignaron, si no funciona, si no dice su estado o si fue hace mucho', () => {
    const equipos = [
      equipo('reasignado', { estado: 'Operativo', responsableId: 'per-ana' }),
      equipo('en-taller', { estado: 'En mantenimiento' }),
      equipo('sin-estado', { estado: '' }),
      equipo('antiguo', { estado: 'Disponible' }),
      equipo('siempre-libre', { estado: 'Disponible' }),
    ]
    const entradas = [
      liberacion('reasignado', 'per-luis', '', '2026-09-20T15:00:00.000Z'),
      liberacion('reasignado', '', 'per-ana', '2026-09-21T15:00:00.000Z'),
      liberacion('en-taller', 'per-luis', '', '2026-09-21T15:00:00.000Z'),
      liberacion('sin-estado', 'per-luis', '', '2026-09-21T15:00:00.000Z'),
      liberacion('antiguo', 'per-luis', '', '2026-08-01T15:00:00.000Z'),
    ]
    expect(equiposLiberadosRecientes(entradas, equipos, AHORA)).toEqual([])
  })

  it('la última entrada manda aunque lleguen desordenadas', () => {
    const equipos = [equipo('x', { estado: 'Disponible' })]
    const entradas = [
      liberacion('x', 'per-b', '', '2026-09-22T10:00:00.000Z'),
      liberacion('x', 'per-a', 'per-b', '2026-09-20T10:00:00.000Z'),
    ]
    expect(equiposLiberadosRecientes(entradas, equipos, AHORA)).toHaveLength(1)
  })
})

describe('en la agenda completa', () => {
  it('lo que tiene fecha se ordena con las credenciales; lo demás va a "Por revisar"', () => {
    const items = calcularPendientes({
      articulos: [],
      credenciales: [],
      camposProtegidos: [],
      nombresDispositivosPorId: new Map(),
      ejecuciones: [],
      articulosDeSugerencia: [],
      personas: [
        persona('nora', { nombre: 'Nora de Prueba', fechaIngreso: '2026-09-21' }),
        persona('tomas', { nombre: 'Tomás de Prueba', estado: 'retirada' }),
      ],
      dispositivos: [
        equipo('45', { responsableId: 'tomas', nombre: 'PC-PRUEBA-45' }),
        equipo('44', { estado: 'Disponible', nombre: 'PC-PRUEBA-44' }),
      ],
      liberaciones: [liberacion('44', 'per-luis', '', '2026-09-22T15:00:00.000Z')],
      usuarioId: 'yo',
      puedeVerBoveda: false,
      limite: Infinity,
      hoy: HOY,
    })
    const agenda = agruparAgenda(items)
    expect(agenda.vencidos.map((i) => i.titulo)).toEqual(['Nora de Prueba'])
    expect(agenda.porRevisar.map((i) => i.titulo)).toEqual(['Tomás de Prueba', 'PC-PRUEBA-44'])
    // Solo el vencido es urgente: lo que se revisa no suma al número.
    expect(asuntosUrgentes(agenda)).toBe(1)
  })
})
