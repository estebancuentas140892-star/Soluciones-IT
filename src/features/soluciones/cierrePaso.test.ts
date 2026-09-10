import { describe, expect, it } from 'vitest'
import type { PasoProcedimiento, Procedimiento } from '../../lib/db'
import {
  cierreDelPaso,
  guiaPendienteDelPaso,
  guiaTerminada,
  type DatosCierrePaso,
} from './cierrePaso'

function datos(cambios: Partial<DatosCierrePaso> = {}): DatosCierrePaso {
  return {
    pasoHecho: false,
    totalTareas: 0,
    tareasMarcadas: 0,
    guiaPendiente: null,
    hayPasoSiguiente: true,
    numeroPasoSiguiente: 2,
    ...cambios,
  }
}

function paso(cambios: Partial<PasoProcedimiento> = {}): PasoProcedimiento {
  return {
    id: 'paso-1',
    titulo: 'Paso 1',
    objetivo: '',
    bloques: [],
    adjuntos: [],
    subArticuloId: null,
    subArticuloTitulo: '',
    solucionArticuloId: null,
    solucionArticuloTitulo: '',
    vinculoProtegido: null,
    ...cambios,
  } as PasoProcedimiento
}

describe('cierreDelPaso', () => {
  it('deja cerrar el paso cuando no queda trabajo, y lo dice', () => {
    const cierre = cierreDelPaso(datos({ totalTareas: 2, tareasMarcadas: 2 }))
    expect(cierre.accion).toBe('completar')
    expect(cierre.etiqueta).toBe('Completar paso y continuar')
  })

  it('en el ultimo paso promete terminar, no continuar', () => {
    const cierre = cierreDelPaso(datos({ hayPasoSiguiente: false }))
    expect(cierre.accion).toBe('completar')
    expect(cierre.etiqueta).toBe('Completar paso y terminar')
  })

  it('nunca dice "Paso hecho" mientras falten tareas: dice cuantas', () => {
    expect(cierreDelPaso(datos({ totalTareas: 3, tareasMarcadas: 1 }))).toMatchObject({
      accion: 'bloqueado',
      etiqueta: 'Faltan 2 tareas',
    })
    expect(cierreDelPaso(datos({ totalTareas: 3, tareasMarcadas: 2 })).etiqueta).toBe('Falta 1 tarea')
  })

  it('nombra la guia que falta', () => {
    const cierre = cierreDelPaso(datos({ guiaPendiente: 'Reiniciar el router' }))
    expect(cierre.accion).toBe('bloqueado')
    expect(cierre.etiqueta).toBe('Completa «Reiniciar el router»')
  })

  it('con guia y tareas pendientes nombra la guia, que es el trabajo que va primero', () => {
    const cierre = cierreDelPaso(
      datos({ guiaPendiente: 'Reiniciar el router', totalTareas: 4, tareasMarcadas: 0 }),
    )
    expect(cierre.etiqueta).toBe('Completa «Reiniciar el router»')
    expect(cierre.tareasPendientes).toBe(4)
  })

  it('un paso que contiene solo una guia se cierra al terminarla', () => {
    expect(cierreDelPaso(datos({ totalTareas: 0, guiaPendiente: 'Reiniciar el router' })).accion).toBe(
      'bloqueado',
    )
    expect(cierreDelPaso(datos({ totalTareas: 0, guiaPendiente: null })).accion).toBe('completar')
  })

  it('un paso ya hecho lleva al siguiente en vez de volver a cerrarse', () => {
    expect(cierreDelPaso(datos({ pasoHecho: true, numeroPasoSiguiente: 4 }))).toMatchObject({
      accion: 'navegar',
      etiqueta: 'Ir al paso 4',
    })
    expect(cierreDelPaso(datos({ pasoHecho: true, hayPasoSiguiente: false })).etiqueta).toBe(
      'Continuar',
    )
  })

  it('un paso hecho no reclama trabajo pendiente en su rotulo', () => {
    const cierre = cierreDelPaso(
      datos({ pasoHecho: true, totalTareas: 2, tareasMarcadas: 0, guiaPendiente: 'X' }),
    )
    expect(cierre.accion).toBe('navegar')
    expect(cierre.guiaPendiente).toBeNull()
  })
})

describe('guiaPendienteDelPaso', () => {
  it('no hay guia pendiente si el paso no vincula ninguna', () => {
    expect(guiaPendienteDelPaso(paso(), true)).toBeNull()
    expect(guiaPendienteDelPaso(paso(), false)).toBeNull()
  })

  it('nombra la guia mientras siga pendiente', () => {
    const p = paso({ subArticuloId: 'guia-1', subArticuloTitulo: 'Reiniciar el router' })
    expect(guiaPendienteDelPaso(p, false)).toBe('Reiniciar el router')
    expect(guiaPendienteDelPaso(p, true)).toBeNull()
  })

  it('sin titulo de referencia la nombra de forma generica', () => {
    const p = paso({ subArticuloId: 'guia-1', subArticuloTitulo: '' })
    expect(guiaPendienteDelPaso(p, false)).toBe('la guía vinculada')
  })
})

// UNA GUIA VINCULADA TERMINA CUANDO TERMINA (encargo del 2026-09-09,
// tarea 4): con sus pasos cerrados Y sus comprobaciones finales hechas.
describe('guiaTerminada', () => {
  function guia(pasos: string[], verificacionFinal: string[] = []): Procedimiento {
    return {
      descripcion: '',
      portada: null,
      objetivoGeneral: '',
      requisitos: [],
      pasos: pasos.map((id) => paso({ id })),
      verificacionFinal,
      tiempoEstimadoMin: null,
      dificultad: null,
    } as Procedimiento
  }

  it('sin comprobaciones finales termina al cerrar el ultimo paso', () => {
    const g = guia(['p1', 'p2'])
    expect(guiaTerminada(g, ['p1'], undefined)).toBe(false)
    expect(guiaTerminada(g, ['p1', 'p2'], undefined)).toBe(true)
  })

  it('con comprobaciones finales no termina hasta hacerlas todas', () => {
    const g = guia(['p1'], ['Comprobar A', 'Comprobar B'])
    expect(guiaTerminada(g, ['p1'], undefined)).toBe(false)
    expect(guiaTerminada(g, ['p1'], [0])).toBe(false)
    expect(guiaTerminada(g, ['p1'], [0, 1])).toBe(true)
  })

  it('las comprobaciones no cuentan mientras queden pasos abiertos', () => {
    const g = guia(['p1', 'p2'], ['Comprobar A'])
    expect(guiaTerminada(g, ['p1'], [0])).toBe(false)
  })

  it('una guia sin pasos que ejecutar no bloquea (caso K1)', () => {
    expect(guiaTerminada(guia([]), undefined, undefined)).toBe(true)
  })
})
