import { describe, expect, it } from 'vitest'
import type { Tarea } from '../../lib/db'
import { agruparAgenda, totalDeAgenda } from './agenda'
import { calcularPendientes } from './pendientes'
import {
  cuandoDeFecha,
  errorDeTarea,
  fechaDeCuando,
  isoDelDia,
  lineaDespues,
  opcionesCuando,
  razonTarea,
  tareasEnAgenda,
  tonoTarea,
} from './tareas'

// LAS TAREAS PROPIAS (tarea 365, D5 de la auditoría del 2026-10-27). Todo es
// inventado. «Hoy» es el martes 27 de octubre de 2026, como en el prototipo.

const HOY = new Date(2026, 9, 27, 10, 0, 0)

function tarea(id: string, cambios: Partial<Tarea> = {}): Tarea {
  return {
    id,
    titulo: `Tarea ${id}`,
    fecha: null,
    dispositivoId: null,
    nota: '',
    hechaEn: null,
    creadaPor: 'tecnico-de-prueba',
    updatedAt: '2026-10-27T00:00:00.000Z',
    updatedBy: null,
    eliminadoEn: null,
    ...cambios,
  }
}

const EQUIPOS = [
  { id: 'pc-04', nombre: 'PC-COMPRAS-04', estado: 'operativo', responsableId: null, eliminadoEn: null },
  { id: 'pc-viejo', nombre: 'PC-VIEJO', estado: 'operativo', responsableId: null, eliminadoEn: '2026-10-01T00:00:00.000Z' },
]

describe('razonTarea', () => {
  it('dice por qué está la tarea, en palabras', () => {
    expect(razonTarea(null, HOY)).toBe('Sin fecha')
    expect(razonTarea(-3, HOY)).toBe('Era para hace 3 días')
    expect(razonTarea(-1, HOY)).toBe('Era para ayer')
    expect(razonTarea(0, HOY)).toBe('Para hoy')
    expect(razonTarea(1, HOY)).toBe('Para mañana')
    expect(razonTarea(3, HOY)).toBe('Para el viernes 30')
    expect(razonTarea(9, HOY)).toBe('Para el 5 nov')
  })

  it('el tono de su fila: vencida en error, de hoy en precaución', () => {
    expect(tonoTarea(-1)).toBe('error')
    expect(tonoTarea(0)).toBe('precaucion')
    expect(tonoTarea(4)).toBe('neutro')
    expect(tonoTarea(null)).toBe('neutro')
  })
})

describe('tareasEnAgenda', () => {
  it('solo las abiertas, con su equipo vivo como origen', () => {
    const items = tareasEnAgenda(
      [
        tarea('t1', { fecha: '2026-10-26', dispositivoId: 'pc-04' }),
        tarea('t2', { hechaEn: '2026-10-27T09:00:00.000Z' }),
        tarea('t3', { eliminadoEn: '2026-10-27T09:00:00.000Z' }),
        tarea('t4', { dispositivoId: 'pc-viejo' }),
      ],
      EQUIPOS,
      HOY,
    )
    expect(items.map((i) => i.clave)).toEqual(['tarea:t1', 'tarea:t4'])
    expect(items[0]).toMatchObject({
      categoria: 'tarea',
      tareaId: 't1',
      detalle: 'Era para ayer',
      tono: 'error',
      diasRestantes: -1,
      origen: 'PC-COMPRAS-04',
    })
    // Un equipo eliminado no se nombra; la tarea sin fecha no tiene días.
    expect(items[1]).toMatchObject({ origen: '', fecha: null, diasRestantes: null, detalle: 'Sin fecha' })
  })
})

describe('las tareas en la Agenda', () => {
  const base = {
    articulos: [],
    credenciales: [],
    camposProtegidos: [],
    nombresDispositivosPorId: new Map<string, string>(),
    ejecuciones: [],
    articulosDeSugerencia: [],
    dispositivos: EQUIPOS,
    usuarioId: 'tecnico-de-prueba',
    puedeVerBoveda: true,
    limite: Infinity,
    hoy: HOY,
  }

  it('con fecha entran por su día; sin fecha, en «Sin fecha», que cuenta en «Agenda completa»', () => {
    const agenda = agruparAgenda(
      calcularPendientes({
        ...base,
        tareas: [
          tarea('vencida', { fecha: '2026-10-25' }),
          tarea('hoy', { fecha: '2026-10-27' }),
          tarea('lejana', { fecha: '2027-03-01' }),
          tarea('sin', {}),
        ],
      }),
    )
    expect(agenda.vencidos.map((i) => i.tareaId)).toEqual(['vencida'])
    expect(agenda.hoy.map((i) => i.tareaId)).toEqual(['hoy'])
    // Un recordatorio propio lejano también se ve: no tiene periodo de aviso.
    expect(agenda.proximos.map((i) => i.tareaId)).toEqual(['lejana'])
    expect(agenda.sinFecha.map((i) => i.tareaId)).toEqual(['sin'])
    expect(totalDeAgenda(agenda)).toBe(4)
  })

  it('los borradores y lo del equipo no cuentan en «Agenda completa» (D7)', () => {
    const agenda = {
      vencidos: [],
      hoy: [],
      proximos: [],
      sinFecha: [],
      enCurso: [tareasEnAgenda([tarea('b')], [], HOY)[0]],
      porRevisar: [tareasEnAgenda([tarea('r')], [], HOY)[0]],
    }
    expect(totalDeAgenda(agenda)).toBe(0)
  })
})

describe('la hoja «Nueva tarea»', () => {
  it('ofrece Hoy, Mañana, el viernes de esta semana, Otra fecha y Sin fecha', () => {
    expect(opcionesCuando(HOY).map((o) => o.texto)).toEqual(['Hoy', 'Mañana', 'Viernes 30', 'Otra fecha', 'Sin fecha'])
    // Un mantenimiento necesita fecha.
    expect(opcionesCuando(HOY, false).map((o) => o.valor)).not.toContain('sin')
    // El jueves, el viernes ya es mañana: no se repite.
    const jueves = new Date(2026, 9, 29)
    expect(opcionesCuando(jueves).map((o) => o.texto)).toEqual(['Hoy', 'Mañana', 'Otra fecha', 'Sin fecha'])
  })

  it('cada elección guarda su fecha', () => {
    expect(fechaDeCuando('hoy', '', HOY)).toBe('2026-10-27')
    expect(fechaDeCuando('manana', '', HOY)).toBe('2026-10-28')
    expect(fechaDeCuando('viernes', '', HOY)).toBe('2026-10-30')
    expect(fechaDeCuando('fecha', '2026-11-12', HOY)).toBe('2026-11-12')
    expect(fechaDeCuando('fecha', '', HOY)).toBeUndefined()
    expect(fechaDeCuando('sin', '', HOY)).toBeNull()
    expect(isoDelDia(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('al editar, la opción que corresponde a la fecha guardada', () => {
    expect(cuandoDeFecha(null, HOY)).toEqual({ cuando: 'sin', otraFecha: '' })
    expect(cuandoDeFecha('2026-10-27', HOY)).toEqual({ cuando: 'hoy', otraFecha: '' })
    expect(cuandoDeFecha('2026-10-28', HOY)).toEqual({ cuando: 'manana', otraFecha: '' })
    expect(cuandoDeFecha('2026-11-12', HOY)).toEqual({ cuando: 'fecha', otraFecha: '2026-11-12' })
  })

  it('lo que falta para guardar se dice en una frase', () => {
    expect(errorDeTarea({ titulo: '  ', cuando: 'hoy', otraFecha: '', mantenimiento: false })).toBe('Escribe qué hay que hacer.')
    expect(errorDeTarea({ titulo: 'Algo', cuando: 'fecha', otraFecha: '', mantenimiento: false })).toBe('Elige la fecha.')
    expect(errorDeTarea({ titulo: '', cuando: 'sin', otraFecha: '', mantenimiento: true })).toBe('Un mantenimiento necesita fecha.')
    // Un mantenimiento no pide «qué»: es el del equipo.
    expect(errorDeTarea({ titulo: '', cuando: 'hoy', otraFecha: '', mantenimiento: true })).toBeNull()
    expect(errorDeTarea({ titulo: 'Algo', cuando: 'sin', otraFecha: '', mantenimiento: false })).toBeNull()
  })
})

describe('lineaDespues', () => {
  it('cuántos urgentes faltan o, si no, lo próximo en una línea', () => {
    expect(lineaDespues(2, null)).toEqual({ prefijo: '', texto: 'Y 2 más en la Agenda' })
    expect(lineaDespues(0, { titulo: 'Hosting', detalle: 'Vence el 6 nov' })).toEqual({
      prefijo: 'Después: ',
      texto: 'Hosting · vence el 6 nov',
    })
    expect(lineaDespues(0, null)).toBeNull()
  })
})
